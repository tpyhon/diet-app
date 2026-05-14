# backend/app/routers/walking.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import json, math
from app.database import get_db
from app.models.walking import WalkingSession
from app.models.user import User
from app.auth import get_current_user

router = APIRouter(prefix="/api/walking", tags=["walking"])

class GPSPoint(BaseModel):
    lat: float
    lng: float
    timestamp: str

class WalkingCreate(BaseModel):
    start_time: datetime
    end_time: Optional[datetime] = None
    route_points: Optional[List[GPSPoint]] = []
    notes: Optional[str] = None
    manual_distance_km: Optional[float] = None
    manual_duration_minutes: Optional[float] = None


DEFAULT_WALKING_SPEED_KMH = 5.5  # GPS/時間不明時のカロリー推定に使うデフォルト速度


def haversine_km(points: List[GPSPoint]) -> float:
    """GPS座標リストから実距離(km)をHaversine公式で計算する。"""
    total, R = 0.0, 6371
    for i in range(len(points) - 1):
        lat1 = math.radians(points[i].lat);   lon1 = math.radians(points[i].lng)
        lat2 = math.radians(points[i+1].lat); lon2 = math.radians(points[i+1].lng)
        dlat = lat2 - lat1; dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
        total += R * 2 * math.asin(math.sqrt(a))
    return round(total, 3)


def speed_to_mets(speed_kmh: float) -> float:
    """
    歩行速度(km/h)からMETs値を返す。
    参考: Compendium of Physical Activities
      ~3.2 km/h  → 2.8  (ゆっくり歩き)
       3.2~4.8   → 3.5  (普通歩き)
       4.8~6.4   → 4.3  (早歩き)
       6.4~      → 5.0  (競歩・速歩き)
    """
    if speed_kmh < 3.2:
        return 2.8
    elif speed_kmh < 4.8:
        return 3.5
    elif speed_kmh < 6.4:
        return 4.3
    else:
        return 5.0


def walking_calories(
    distance_km: float,
    duration_min: float,
    weight_kg: float = 65.0,
) -> float:
    """
    距離・時間・体重から消費カロリーをMETs基準で計算する。

    計算式:
        speed   = distance_km / (duration_min / 60)   [km/h]
        METs    = speed_to_mets(speed)
        hours   = duration_min / 60
        kcal    = METs × weight_kg × hours × 1.05

    係数1.05は運動後の酸素消費（アフターバーン）の補正。
    distance_kmを使ってspeedを算出することで、
    「同じ距離を早歩きしても消費カロリーはほぼ変わらない」
    という物理的に正しい挙動になる。
    """
    if duration_min <= 0 or distance_km <= 0:
        return 0.0
    speed_kmh = distance_km / (duration_min / 60)
    mets      = speed_to_mets(speed_kmh)
    hours     = duration_min / 60
    return round(mets * weight_kg * hours * 1.05, 1)


# ── エンドポイント ────────────────────────────────────────────

@router.post("/")
def create_session(
    data: WalkingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.manual_distance_km is not None:
        distance = data.manual_distance_km
    else:
        distance = haversine_km(data.route_points or [])

    if data.manual_duration_minutes is not None:
        duration = data.manual_duration_minutes
    elif data.end_time is not None:
        duration = (data.end_time - data.start_time).total_seconds() / 60
    else:
        # 時間不明の場合はデフォルト速度から推定
        duration = (distance / DEFAULT_WALKING_SPEED_KMH) * 60 if distance > 0 else 0.0

    avg_speed = (distance / (duration / 60)) if duration > 0 else 0.0

    # ユーザーの体重を使って精度を上げる（未設定なら65kg）
    weight_kg = current_user.weight_kg or 65.0
    calories  = walking_calories(distance, duration, weight_kg)

    db_s = WalkingSession(
        user_id=current_user.id,
        start_time=data.start_time,
        end_time=data.end_time,
        duration_minutes=round(duration, 1),
        distance_km=distance,
        avg_speed_kmh=round(avg_speed, 2),
        estimated_calories=calories,
        route_json=json.dumps([p.model_dump() for p in (data.route_points or [])]),
        notes=data.notes,
    )
    db.add(db_s)
    db.commit()
    db.refresh(db_s)
    return db_s


@router.get("/")
def get_sessions(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(WalkingSession)
        .filter(WalkingSession.user_id == current_user.id)
        .order_by(WalkingSession.start_time.desc())
        .limit(limit)
        .all()
    )


@router.get("/{session_id}/route")
def get_route(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(WalkingSession).filter(
        WalkingSession.id == session_id,
        WalkingSession.user_id == current_user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    return {"route": json.loads(s.route_json) if s.route_json else []}


@router.delete("/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(WalkingSession).filter(
        WalkingSession.id == session_id,
        WalkingSession.user_id == current_user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(s)
    db.commit()
    return {"ok": True}
