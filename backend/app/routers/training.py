from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
import json
from app.database import get_db
from app.models.training import TrainingPlan, TrainingLog, UserGameStatus

router = APIRouter(prefix="/api/training", tags=["training"])

# XP設定
XP_PER_WORKOUT = 50
XP_STREAK_BONUS = 20
LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4500, 6000]

class ExerciseItem(BaseModel):
    name: str
    sets: int
    reps: int
    weight_kg: Optional[float] = None

class PlanCreate(BaseModel):
    name: str
    body_part: str  # arms/chest/abs/back/legs
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
def create_plan(plan: PlanCreate, db: Session = Depends(get_db)):
    db_plan = TrainingPlan(
        name=plan.name,
        body_part=plan.body_part,
        exercises_json=json.dumps([e.model_dump() for e in plan.exercises]),
        day_of_week=plan.day_of_week
    )
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan

@router.get("/plans")
def get_plans(db: Session = Depends(get_db)):
    plans = db.query(TrainingPlan).all()
    result = []
    for p in plans:
        d = {c.name: getattr(p, c.name) for c in p.__table__.columns}
        d["exercises"] = json.loads(p.exercises_json)
        result.append(d)
    return result

@router.get("/today-suggestion")
def get_today_suggestion(db: Session = Depends(get_db)):
    """今日の曜日に対応するプランを提案"""
    today_dow = datetime.now().weekday()  # 0=月曜
    plans = db.query(TrainingPlan).filter(
        TrainingPlan.day_of_week == today_dow
    ).all()
    return {"day_of_week": today_dow, "suggested_plans": plans}

@router.post("/logs")
def create_log(log: LogCreate, db: Session = Depends(get_db)):
    db_log = TrainingLog(
        plan_id=log.plan_id,
        body_part=log.body_part,
        exercises_json=json.dumps([e.model_dump() for e in log.exercises]),
        duration_minutes=log.duration_minutes,
        completed=True,
        xp_earned=XP_PER_WORKOUT,
        notes=log.notes
    )
    db.add(db_log)

    # ゲームステータス更新
    status = db.query(UserGameStatus).first()
    if not status:
        status = UserGameStatus(total_xp=0, level=1, streak_days=0)
        db.add(status)

    status.total_xp += XP_PER_WORKOUT
    if status.last_training_date:
        diff = (datetime.now().date() - status.last_training_date.date()).days
        if diff == 1:
            status.streak_days += 1
            status.total_xp += XP_STREAK_BONUS
            db_log.xp_earned += XP_STREAK_BONUS
        elif diff > 1:
            status.streak_days = 1
    else:
        status.streak_days = 1

    status.level = get_level(status.total_xp)
    status.last_training_date = datetime.now()
    db.commit()
    db.refresh(db_log)
    return {"log": db_log, "game_status": status}

@router.get("/game-status")
def get_game_status(db: Session = Depends(get_db)):
    status = db.query(UserGameStatus).first()
    if not status:
        return {"total_xp": 0, "level": 1, "streak_days": 0, "badges": []}
    next_level_xp = LEVEL_THRESHOLDS[min(status.level, len(LEVEL_THRESHOLDS)-1)]
    return {
        "total_xp": status.total_xp,
        "level": status.level,
        "streak_days": status.streak_days,
        "next_level_xp": next_level_xp,
        "badges": json.loads(status.badges_json)
    }

@router.get("/logs")
def get_logs(limit: int = 30, db: Session = Depends(get_db)):
    return db.query(TrainingLog).order_by(TrainingLog.date.desc()).limit(limit).all()

@router.delete("/logs/{log_id}")
def delete_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(TrainingLog).filter(TrainingLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(log)
    db.commit()
    return {"ok": True}
