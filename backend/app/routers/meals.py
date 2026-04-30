from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models.meal import Meal
from google import genai
import os, json

router = APIRouter(prefix="/api/meals", tags=["meals"])

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

class MealCreate(BaseModel):
    meal_type: str
    food_name: str
    quantity: str
    notes: Optional[str] = None

class MealResponse(BaseModel):
    id: int
    date: datetime
    meal_type: str
    food_name: str
    quantity: str
    estimated_calories: float
    notes: Optional[str]

    class Config:
        from_attributes = True

async def estimate_calories_with_gemini(food_name: str, quantity: str) -> float:
    """Gemini APIを使って食品のカロリーを推定する"""
    prompt = f"""
食品名: {food_name}
量: {quantity}

上記の食品のカロリーを推定してください。
数値のみをkcal単位で返してください（例: 320）。
説明文は不要です。数字だけ返してください。
"""
    response = client.models.generate_content(
        model="gemma-3-27b-it",
        contents=prompt
    )
    text = response.text.strip().replace("kcal", "").replace("Kcal", "").strip()
    try:
        return float(text)
    except ValueError:
        return 0.0

@router.post("/", response_model=MealResponse)
async def create_meal(meal: MealCreate, db: Session = Depends(get_db)):
    calories = await estimate_calories_with_gemini(meal.food_name, meal.quantity)
    db_meal = Meal(
        meal_type=meal.meal_type,
        food_name=meal.food_name,
        quantity=meal.quantity,
        estimated_calories=calories,
        notes=meal.notes
    )
    db.add(db_meal)
    db.commit()
    db.refresh(db_meal)
    return db_meal

@router.get("/")
def get_meals(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Meal).order_by(Meal.date.desc()).offset(skip).limit(limit).all()

@router.get("/today")
def get_today_meals(db: Session = Depends(get_db)):
    today = datetime.now().date()
    meals = db.query(Meal).filter(
        Meal.date >= datetime.combine(today, datetime.min.time())
    ).all()
    total_calories = sum(m.estimated_calories for m in meals)
    return {"meals": meals, "total_calories": total_calories}

@router.delete("/{meal_id}")
def delete_meal(meal_id: int, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.delete(meal)
    db.commit()
    return {"ok": True}
