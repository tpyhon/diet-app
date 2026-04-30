from sqlalchemy import Column, Integer, Float, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base

class WeightRecord(Base):
    __tablename__ = "weight_records"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=func.now())
    weight_kg = Column(Float)
    body_fat_pct = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())

class WeightGoal(Base):
    __tablename__ = "weight_goals"
    id = Column(Integer, primary_key=True, index=True)
    target_weight_kg = Column(Float)
    target_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
