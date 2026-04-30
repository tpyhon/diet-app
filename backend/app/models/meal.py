from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base

class Meal(Base):
    __tablename__ = "meals"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=func.now())
    meal_type = Column(String(20))   # breakfast / lunch / dinner / snack
    food_name = Column(String(200))
    quantity = Column(String(100))
    estimated_calories = Column(Float)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
