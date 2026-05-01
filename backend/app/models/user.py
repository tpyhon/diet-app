# backend/app/models/user.py
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    display_name  = Column(String(100), nullable=True)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=func.now())

    # ── 個人情報（カロリー目標・AI推定用） ──────────────────────
    age              = Column(Integer,  nullable=True)          # 年齢
    gender           = Column(String(10), nullable=True)        # "male" / "female" / "other"
    height_cm        = Column(Float,    nullable=True)          # 身長 cm
    weight_kg        = Column(Float,    nullable=True)          # 体重 kg（プロフィール用基準値）
    activity_level   = Column(String(20), nullable=True)        # sedentary/lightly/moderately/very/super
    diet_goal        = Column(String(20), nullable=True)        # lose / maintain / gain
    calorie_goal     = Column(Integer,  nullable=True)          # 1日カロリー目標 kcal（手動 or AI設定）
