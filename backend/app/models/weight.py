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
