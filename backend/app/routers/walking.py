from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import json, math
from app.database import get_db
from app.models.walking import WalkingSession

router = APIRouter(prefix="/api/walking", tags=["walking"])

class GPSPoint(BaseModel):
    lat: float
    lng: float
    timestamp: str

class WalkingSessionCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    route_points: List[GPSPoint]
    notes: Optional[str] = None

def calculate_distance(points: List[GPSPoint]) -> float:
    """ハーバーサイン公式で総距離(km)を計算"""
    total = 0.0
    R = 6371  # 地球半径 km
    for i in range(len(points) - 1):
        lat1, lon1 = math.radians(points[i].lat), math.radians(points[i].lng)
        lat2, lon2 = math.radians(points[i+1].lat), math.radians(points[i+1].lng)
        dlat, dlon = lat2 - lat1, lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
        total += R * 2 * math.asin(math.sqrt(a))
    return round(total, 3)

def calculate_walking_calories(distance_km: float, duration_minutes: float) -> float:
    """体重60kg想定、METs法でカロリー推定"""
    weight_kg = 60
    mets = 3.5  # ウォーキング平均METs
    hours = duration_minutes / 60
    return round(mets * weight_kg * hours, 1)

@router.post("/")
def create_walking_session(session: WalkingSessionCreate, db: Session = Depends(get_db)):
    duration = (session.end_time - session.start_time).total_seconds() / 60
    distance = calculate_distance(session.route_points)
    avg_speed = (distance / (duration / 60)) if duration > 0 else 0
    calories = calculate_walking_calories(distance, duration)

    db_session = WalkingSession(
        start_time=session.start_time,
        end_time=session.end_time,
        duration_minutes=round(duration, 1),
        distance_km=distance,
        avg_speed_kmh=round(avg_speed, 2),
        estimated_calories=calories,
        route_json=json.dumps([p.model_dump() for p in session.route_points]),
        notes=session.notes
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@router.get("/")
def get_walking_sessions(limit: int = 20, db: Session = Depends(get_db)):
    return db.query(WalkingSession).order_by(
        WalkingSession.start_time.desc()
    ).limit(limit).all()

@router.get("/{session_id}/route")
def get_route(session_id: int, db: Session = Depends(get_db)):
    session = db.query(WalkingSession).filter(WalkingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"route": json.loads(session.route_json) if session.route_json else []}
