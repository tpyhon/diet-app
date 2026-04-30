from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models.weight import WeightRecord

router = APIRouter(prefix="/api/weight", tags=["weight"])

class WeightCreate(BaseModel):
    weight_kg: float
    body_fat_pct: Optional[float] = None
    notes: Optional[str] = None

@router.post("/")
def create_weight(record: WeightCreate, db: Session = Depends(get_db)):
    db_record = WeightRecord(
        weight_kg=record.weight_kg,
        body_fat_pct=record.body_fat_pct,
        notes=record.notes
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

@router.get("/history")
def get_weight_history(period: str = "1month", db: Session = Depends(get_db)):
    """period: 1week / 1month / 6months / 1year"""
    period_map = {
        "1week": timedelta(weeks=1),
        "1month": timedelta(days=30),
        "6months": timedelta(days=180),
        "1year": timedelta(days=365)
    }
    delta = period_map.get(period, timedelta(days=30))
    since = datetime.now() - delta
    records = db.query(WeightRecord).filter(
        WeightRecord.date >= since
    ).order_by(WeightRecord.date.asc()).all()
    return records
