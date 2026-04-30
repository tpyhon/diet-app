from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models.weight import WeightRecord, WeightGoal
from app.models.user import User
from app.auth import get_current_user

router = APIRouter(prefix="/api/weight", tags=["weight"])

PERIOD_MAP = {
    "1week":   timedelta(weeks=1),
    "1month":  timedelta(days=30),
    "6months": timedelta(days=180),
    "1year":   timedelta(days=365),
}

class WeightCreate(BaseModel):
    weight_kg: float
    body_fat_pct: Optional[float] = None
    notes: Optional[str] = None

class WeightGoalCreate(BaseModel):
    target_weight_kg: float
    target_date: Optional[datetime] = None

@router.post("/")
def create_record(
    record: WeightCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # ← 追加
):
    db_r = WeightRecord(
        user_id=current_user.id,               # ← 追加
        weight_kg=record.weight_kg,
        body_fat_pct=record.body_fat_pct,
        notes=record.notes
    )
    db.add(db_r); db.commit(); db.refresh(db_r)
    return db_r

@router.get("/history")
def get_history(
    period: str = "1month",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # ← 追加
):
    delta = PERIOD_MAP.get(period, timedelta(days=30))
    since = datetime.now() - delta
    return (
        db.query(WeightRecord)
        .filter(
            WeightRecord.user_id == current_user.id,  # ← 追加
            WeightRecord.date >= since
        )
        .order_by(WeightRecord.date.asc())
        .all()
    )

@router.delete("/{record_id}")
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # ← 追加
):
    r = db.query(WeightRecord).filter(
        WeightRecord.id == record_id,
        WeightRecord.user_id == current_user.id,      # ← 追加
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(r); db.commit()
    return {"ok": True}

@router.post("/goal")
def set_goal(
    goal: WeightGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # ← 追加
):
    existing = db.query(WeightGoal).filter(
        WeightGoal.user_id == current_user.id          # ← 追加
    ).first()
    if existing:
        existing.target_weight_kg = goal.target_weight_kg
        existing.target_date = goal.target_date
        existing.updated_at = datetime.now()
    else:
        existing = WeightGoal(
            user_id=current_user.id,                   # ← 追加
            target_weight_kg=goal.target_weight_kg,
            target_date=goal.target_date,
        )
        db.add(existing)
    db.commit(); db.refresh(existing)
    return existing

@router.get("/goal")
def get_goal(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # ← 追加
):
    goal = db.query(WeightGoal).filter(
        WeightGoal.user_id == current_user.id          # ← 追加
    ).first()
    if not goal:
        return {"goal": None, "prediction": None}

    since = datetime.now() - timedelta(days=30)
    records = db.query(WeightRecord).filter(
        WeightRecord.user_id == current_user.id,       # ← 追加
        WeightRecord.date >= since
    ).order_by(WeightRecord.date.asc()).all()

    prediction = None
    if len(records) >= 2:
        days_span = (records[-1].date - records[0].date).days
        if days_span > 0:
            weight_change = records[-1].weight_kg - records[0].weight_kg
            daily_change  = weight_change / days_span
            current_weight = records[-1].weight_kg
            target_weight  = goal.target_weight_kg
            remaining      = current_weight - target_weight
            if daily_change < 0 and remaining > 0:
                days_to_goal   = remaining / abs(daily_change)
                predicted_date = datetime.now() + timedelta(days=days_to_goal)
                prediction = {
                    "predicted_date": predicted_date.isoformat(),
                    "days_remaining": round(days_to_goal),
                    "daily_change_kg": round(daily_change, 3),
                    "current_weight": current_weight,
                    "remaining_kg": round(remaining, 1),
                }
            elif remaining <= 0:
                prediction = {
                    "achieved": True,
                    "current_weight": current_weight,
                    "remaining_kg": round(remaining, 1),
                }
            else:
                prediction = {
                    "on_track": False,
                    "daily_change_kg": round(daily_change, 3),
                    "message": "現在の傾向では目標達成が難しい状態です。食事・運動を見直しましょう。"
                }
    return {"goal": goal, "prediction": prediction}

@router.get("/prediction-data")
def get_prediction_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # ← 追加
):
    goal = db.query(WeightGoal).filter(
        WeightGoal.user_id == current_user.id          # ← 追加
    ).first()
    records = (
        db.query(WeightRecord)
        .filter(WeightRecord.user_id == current_user.id)  # ← 追加
        .order_by(WeightRecord.date.asc())
        .limit(365)
        .all()
    )
    actual = [
        {
            "date": r.date.strftime("%m/%d"),
            "actual": r.weight_kg,
            "target": goal.target_weight_kg if goal else None,
        }
        for r in records
    ]
    prediction_line = []
    if len(records) >= 2 and goal:
        since  = datetime.now() - timedelta(days=30)
        recent = [r for r in records if r.date >= since]
        if len(recent) >= 2:
            days_span = (recent[-1].date - recent[0].date).days
            if days_span > 0:
                daily_change = (recent[-1].weight_kg - recent[0].weight_kg) / days_span
                current = recent[-1].weight_kg
                for i in range(1, 181):
                    predicted  = current + daily_change * i
                    date_label = (datetime.now() + timedelta(days=i)).strftime("%m/%d")
                    prediction_line.append({
                        "date": date_label,
                        "predicted": round(predicted, 2),
                        "target": goal.target_weight_kg,
                    })
                    if (daily_change < 0 and predicted <= goal.target_weight_kg) or \
                       (daily_change > 0 and predicted >= goal.target_weight_kg):
                        break
    return {"actual": actual, "prediction": prediction_line}
