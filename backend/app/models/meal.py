from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from datetime import datetime, timezone
from ..database import Base

class Meal(Base):
    __tablename__ = "meals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    description = Column(String, nullable=False)
    calories = Column(Float, nullable=False)

    # 栄養素（AI推定・nullable）
    protein_g = Column(Float, nullable=True)   # タンパク質（g）
    fat_g = Column(Float, nullable=True)       # 脂質（g）
    carbs_g = Column(Float, nullable=True)     # 炭水化物（g）

    meal_type = Column(String, nullable=True)  # breakfast / lunch / dinner / snack
    recorded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    image_path = Column(String, nullable=True)
