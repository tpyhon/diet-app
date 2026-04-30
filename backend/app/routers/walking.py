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

class WalkingCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    route_points: List[GPSPoint]
    notes: Optional[str] = None
    manual_distance_km: Optional[float] = None  # ← 追加：手動入力時の距離

def haversine_km(points: List[GPSPoint]) -> float:
    total, R = 0.0, 6371
    for i in range(len(points) - 1):
        lat1 = math.radians(points[i].lat);   lon1 = math.radians(points[i].lng)
        lat2 = math.radians(points[i+1].lat); lon2 = math.radians(points[i+1].lng)
        dlat = lat2 - lat1; dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
        total += R * 2 * math.asin(math.sqrt(a))
    return round(total, 3)

def walking_calories(distance_km: float, duration_min: float) -> float:
    return round(3.5 * 60 * (duration_min / 60), 1)

@router.post("/")
def create_session(data: WalkingCreate, db: Session = Depends(get_db)):
    duration = (data.end_time - data.start_time).total_seconds() / 60

    # 手動入力距離があればそちらを優先、なければGPSから計算
    if data.manual_distance_km is not None:
        distance = data.manual_distance_km
    else:
        distance = haversine_km(data.route_points)

    avg_speed = (distance / (duration / 60)) if duration > 0 else 0
    calories  = walking_calories(distance, duration)

    db_s = WalkingSession(
        start_time=data.start_time,
        end_time=data.end_time,
        duration_minutes=round(duration, 1),
        distance_km=distance,
        avg_speed_kmh=round(avg_speed, 2),
        estimated_calories=calories,
        route_json=json.dumps([p.model_dump() for p in data.route_points]),
        notes=data.notes
    )
    db.add(db_s); db.commit(); db.refresh(db_s)
    return db_s

@router.get("/")
def get_sessions(limit: int = 20, db: Session = Depends(get_db)):
    return db.query(WalkingSession).order_by(
        WalkingSession.start_time.desc()).limit(limit).all()

@router.get("/{session_id}/route")
def get_route(session_id: int, db: Session = Depends(get_db)):
    s = db.query(WalkingSession).filter(WalkingSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    return {"route": json.loads(s.route_json) if s.route_json else []}

@router.delete("/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(WalkingSession).filter(WalkingSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(s)
    db.commit()
    return {"ok": True}
