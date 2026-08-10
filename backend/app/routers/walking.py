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
    steps: Optional[int] = None


DEFAULT_WALKING_SPEED_KMH = 5.5  # GPS/時間不明時のカロリー推定に使うデフォルト速度
DEFAULT_HEIGHT_CM         = 165.0  # 身長未設定時に仮定する身長
STEP_LENGTH_RATIO         = 0.45   # 歩幅 = 身長 × この比率
STEP_PITCH_PER_MIN        = 100    # 歩数から時間を推定する際のピッチ(歩/分)


def estimate_distance_km_from_steps(steps: int, height_cm: float) -> float:
    """歩数と身長から推定距離(km)を算出する。 歩幅(m) = 身長(cm) × 0.45 / 100"""
    stride_m = height_cm * STEP_LENGTH_RATIO / 100
    return (steps * stride_m) / 1000


def estimate_duration_min_from_steps(steps: int) -> float:
    """歩数からピッチ100歩/分で推定時間(分)を算出する。"""
    return steps / STEP_PITCH_PER_MIN


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


def _lerp(x: float, x0: float, x1: float, y0: float, y1: float) -> float:
    """x0〜x1の範囲でxをy0〜y1へ線形補間する。"""
    return y0 + (x - x0) / (x1 - x0) * (y1 - y0)


def speed_to_mets(speed_kmh: float) -> float:
    """
    歩行速度(km/h)からMETs値を線形補間で返す。
    参考: Compendium of Physical Activities
      <= 3.2 km/h        : 2.8  (ゆっくり歩き)
       3.2 ~  4.8 (補間)  : 2.8 → 3.5
       4.8 ~  6.4 (補間)  : 3.5 → 4.3  (早歩き)
       6.4 ~  8.0 (補間)  : 4.3 → 5.0  (競歩・速歩き)
      >= 8.0 km/h        : 5.0 + (速度-8.0)×0.5 （上限8.0 METs、ランニング域）
    """
    if speed_kmh <= 3.2:
        return 2.8
    elif speed_kmh < 4.8:
        return _lerp(speed_kmh, 3.2, 4.8, 2.8, 3.5)
    elif speed_kmh < 6.4:
        return _lerp(speed_kmh, 4.8, 6.4, 3.5, 4.3)
    elif speed_kmh < 8.0:
        return _lerp(speed_kmh, 6.4, 8.0, 4.3, 5.0)
    else:
        return min(5.0 + (speed_kmh - 8.0) * 0.5, 8.0)


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
    elif data.route_points:
        distance = haversine_km(data.route_points)
    elif data.steps is not None and data.steps > 0:
        # 歩数のみ入力時のフォールバック: 身長から歩幅を推定して距離を算出
        height_cm = current_user.height_cm or DEFAULT_HEIGHT_CM
        distance = estimate_distance_km_from_steps(data.steps, height_cm)
    else:
        distance = 0.0

    if data.manual_duration_minutes is not None:
        duration = data.manual_duration_minutes
    elif data.end_time is not None:
        duration = (data.end_time - data.start_time).total_seconds() / 60
    elif data.steps is not None and data.steps > 0:
        # 歩数のみ入力時のフォールバック: ピッチ100歩/分で時間を推定
        duration = estimate_duration_min_from_steps(data.steps)
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
