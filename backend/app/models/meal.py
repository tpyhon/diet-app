# backend/app/models/meal.py
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class Meal(Base):
    __tablename__ = "meals"

    id                 = Column(Integer, primary_key=True, index=True)
    user_id            = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date               = Column(DateTime, default=func.now())
    meal_type          = Column(String(20))        # breakfast / lunch / dinner / snack
    food_name          = Column(String(200))
    quantity           = Column(String(100))
    estimated_calories = Column(Float)
    # ── 栄養素（PFC）────────────────────────────────────────────
    protein_g          = Column(Float, nullable=True)   # タンパク質 g
    fat_g              = Column(Float, nullable=True)   # 脂質 g
    carbs_g            = Column(Float, nullable=True)   # 炭水化物 g
    # ────────────────────────────────────────────────────────────
    notes              = Column(Text, nullable=True)
    created_at         = Column(DateTime, default=func.now())
