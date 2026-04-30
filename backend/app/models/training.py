from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.database import Base

class TrainingPlan(Base):
    __tablename__ = "training_plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200))
    body_part = Column(String(50))  # arms/chest/abs/back/legs
    exercises_json = Column(Text)   # JSON: [{name, sets, reps, weight}]
    day_of_week = Column(Integer, nullable=True)  # 0=月〜6=日
    created_at = Column(DateTime, default=func.now())

class TrainingLog(Base):
    __tablename__ = "training_logs"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, nullable=True)
    date = Column(DateTime, default=func.now())
    body_part = Column(String(50))
    exercises_json = Column(Text)  # 実際にやった内容
    duration_minutes = Column(Float, nullable=True)
    completed = Column(Boolean, default=False)
    xp_earned = Column(Integer, default=0)  # ゲーム要素
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())

class UserGameStatus(Base):
    __tablename__ = "user_game_status"

    id = Column(Integer, primary_key=True, index=True)
    total_xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    streak_days = Column(Integer, default=0)
    last_training_date = Column(DateTime, nullable=True)
    badges_json = Column(Text, default="[]")  # 獲得バッジリスト
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
