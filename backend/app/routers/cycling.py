# backend/app/routers/cycling.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models.cycling import CyclingSession
from app.models.user import User
from app.auth import get_current_user

router = APIRouter(prefix="/api/cycling", tags=["cycling"])

class CyclingCreate(BaseModel):
    start_time: datetime
    end_time: Optional[datetime] = None
    distance_km: Optional[float] = None
    manual_duration_minutes: Optional[float] = None
    notes: Optional[str] = None


CYCLING_DEFAULT_SPEED_KMH = 15.0  # 距離のみ入力時に使うデフォルト巡航速度
CYCLING_METS              = 5.8   # 適用強度


def cycling_calories(duration_min: float, weight_kg: float = 65.0) -> float:
    """
    時間・体重から消費カロリーをMETs基準で計算する。
        kcal = METs × weight_kg × (duration_min / 60) × 1.05
    係数1.05はウォーキングと同様、運動後の酸素消費（アフターバーン）の補正。
    """
    if duration_min <= 0:
        return 0.0
    hours = duration_min / 60
    return round(CYCLING_METS * weight_kg * hours * 1.05, 1)


# ── エンドポイント ────────────────────────────────────────────

@router.post("/")
def create_session(
    data: CyclingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    distance = data.distance_km or 0.0

    if data.manual_duration_minutes is not None:
        duration = data.manual_duration_minutes
    elif data.end_time is not None:
        duration = (data.end_time - data.start_time).total_seconds() / 60
    elif distance > 0:
        # 距離のみ入力時のフォールバック: デフォルト巡航速度15.0km/hから時間を推定
        duration = (distance / CYCLING_DEFAULT_SPEED_KMH) * 60
    else:
        duration = 0.0

    avg_speed = (distance / (duration / 60)) if duration > 0 else 0.0

    weight_kg = current_user.weight_kg or 65.0
    calories  = cycling_calories(duration, weight_kg)

    db_s = CyclingSession(
        user_id=current_user.id,
        start_time=data.start_time,
        end_time=data.end_time,
        duration_minutes=round(duration, 1),
        distance_km=distance,
        avg_speed_kmh=round(avg_speed, 2),
        estimated_calories=calories,
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
        db.query(CyclingSession)
        .filter(CyclingSession.user_id == current_user.id)
        .order_by(CyclingSession.start_time.desc())
        .limit(limit)
        .all()
    )


@router.delete("/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(CyclingSession).filter(
        CyclingSession.id == session_id,
        CyclingSession.user_id == current_user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(s)
    db.commit()
    return {"ok": True}
