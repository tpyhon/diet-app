# backend/app/routers/training.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import json
from app.database import get_db
from app.models.training import TrainingPlan, TrainingLog, UserGameStatus
from app.models.user import User
from app.auth import get_current_user
from app.utils import now_jst

router = APIRouter(prefix="/api/training", tags=["training"])

XP_PER_WORKOUT   = 50
XP_STREAK_BONUS  = 20
LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4500, 6000]

class ExerciseItem(BaseModel):
    name: str
    sets: int
    reps: int
    weight_kg: Optional[float] = None

class PlanCreate(BaseModel):
    name: str
    body_part: str
    exercises: List[ExerciseItem]
    day_of_week: Optional[int] = None

class LogCreate(BaseModel):
    plan_id: Optional[int] = None
    body_part: str
    exercises: List[ExerciseItem]
    duration_minutes: Optional[float] = None
    notes: Optional[str] = None

def get_level(xp: int) -> int:
    for i, threshold in enumerate(reversed(LEVEL_THRESHOLDS)):
        if xp >= threshold:
            return len(LEVEL_THRESHOLDS) - i
    return 1


@router.post("/plans")
def create_plan(
    plan: PlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_plan = TrainingPlan(
        user_id=current_user.id,
        name=plan.name,
        body_part=plan.body_part,
        exercises_json=json.dumps([e.model_dump() for e in plan.exercises]),
        day_of_week=plan.day_of_week,
    )
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan


@router.get("/plans")
def get_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plans = db.query(TrainingPlan).filter(
        TrainingPlan.user_id == current_user.id
    ).all()
    result = []
    for p in plans:
        d = {c.name: getattr(p, c.name) for c in p.__table__.columns}
        d["exercises"] = json.loads(p.exercises_json)
        result.append(d)
    return result


@router.get("/today-suggestion")
def get_today_suggestion(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today_dow = now_jst().weekday()   # ← JST明示
    plans = db.query(TrainingPlan).filter(
        TrainingPlan.user_id == current_user.id,
        TrainingPlan.day_of_week == today_dow,
    ).all()
    return {"day_of_week": today_dow, "suggested_plans": plans}


@router.post("/logs")
def create_log(
    log: LogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    jst_now = now_jst()   # ← JST明示（複数箇所で使うので変数化）

    db_log = TrainingLog(
        user_id=current_user.id,
        plan_id=log.plan_id,
        body_part=log.body_part,
        exercises_json=json.dumps([e.model_dump() for e in log.exercises]),
        duration_minutes=log.duration_minutes,
        completed=True,
        xp_earned=XP_PER_WORKOUT,
        notes=log.notes,
        date=jst_now,
    )
    db.add(db_log)

    status = db.query(UserGameStatus).filter(
        UserGameStatus.user_id == current_user.id
    ).first()
    if not status:
        status = UserGameStatus(
            user_id=current_user.id,
            total_xp=0,
            level=1,
            streak_days=0,
        )
        db.add(status)

    status.total_xp += XP_PER_WORKOUT

    if status.last_training_date:
        # ← last_training_date もJSTで保存されているので差分計算は正確
        diff = (jst_now.date() - status.last_training_date.date()).days
        if diff == 1:
            status.streak_days += 1
            status.total_xp    += XP_STREAK_BONUS
            db_log.xp_earned   += XP_STREAK_BONUS
        elif diff > 1:
            status.streak_days = 1
    else:
        status.streak_days = 1

    status.level               = get_level(status.total_xp)
    status.last_training_date  = jst_now   # ← JST明示

    db.commit()
    db.refresh(db_log)
    return {"log": db_log, "game_status": status}


@router.get("/game-status")
def get_game_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    status = db.query(UserGameStatus).filter(
        UserGameStatus.user_id == current_user.id
    ).first()
    if not status:
        return {"total_xp": 0, "level": 1, "streak_days": 0, "badges": []}
    next_level_xp = LEVEL_THRESHOLDS[min(status.level, len(LEVEL_THRESHOLDS) - 1)]
    return {
        "total_xp":     status.total_xp,
        "level":        status.level,
        "streak_days":  status.streak_days,
        "next_level_xp": next_level_xp,
        "badges":       json.loads(status.badges_json),
    }


@router.get("/logs")
def get_logs(
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(TrainingLog)
        .filter(TrainingLog.user_id == current_user.id)
        .order_by(TrainingLog.date.desc())
        .limit(limit)
        .all()
    )


@router.delete("/logs/{log_id}")
def delete_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.query(TrainingLog).filter(
        TrainingLog.id == log_id,
        TrainingLog.user_id == current_user.id,
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(log)
    db.commit()
    return {"ok": True}


@router.delete("/plans/{plan_id}")
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = db.query(TrainingPlan).filter(
        TrainingPlan.id == plan_id,
        TrainingPlan.user_id == current_user.id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(plan)
    db.commit()
    return {"ok": True}
