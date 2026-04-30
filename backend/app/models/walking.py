from sqlalchemy import Column, Integer, Float, DateTime, Text, String
from sqlalchemy.sql import func
from app.database import Base

class WalkingSession(Base):
    __tablename__ = "walking_sessions"

    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Float, nullable=True)
    distance_km = Column(Float, nullable=True)
    avg_speed_kmh = Column(Float, nullable=True)
    estimated_calories = Column(Float, nullable=True)
    route_json = Column(Text, nullable=True)  # JSON: [{lat, lng, timestamp}]
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=func.now())
