# backend/app/routers/meals.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models.meal import Meal
from app.models.user import User
from app.auth import get_current_user
from app.utils import now_jst, today_jst
from google import genai
from google.genai import types
import os, json

router = APIRouter(prefix="/api/meals", tags=["meals"])

def get_client():
    return genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


# ── Pydanticスキーマ ──────────────────────────────────────────

class NutritionInfo(BaseModel):
    estimated_calories: float
    protein_g: float
    fat_g: float
    carbs_g: float

class MealCreate(BaseModel):
    meal_type: str
    food_name: str
    quantity: str
    notes: Optional[str] = None

class MealCreateWithCalories(BaseModel):
    meal_type: str
    food_name: str
    quantity: str
    estimated_calories: float
    protein_g: Optional[float] = None
    fat_g: Optional[float] = None
    carbs_g: Optional[float] = None
    notes: Optional[str] = None


# ── AI推定：カロリー＋PFC ─────────────────────────────────────

async def estimate_nutrition(food_name: str, quantity: str) -> NutritionInfo:
    prompt = (
        f"食品名: {food_name}\n量: {quantity}\n\n"
        "この食事の栄養素を以下のJSON形式のみで返してください。説明文は不要です。\n"
        '{"calories": 数値, "protein_g": 数値, "fat_g": 数値, "carbs_g": 数値}'
    )
    try:
        client = get_client()
        response = client.models.generate_content(
            model="gemma-4-26b-a4b-it",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=(
                    "あなたは栄養士です。食品のカロリーとPFC（タンパク質・脂質・炭水化物）を"
                    "JSONのみで返してください。"
                )
            )
        )
        raw = response.text.strip()
        if "```" in raw:
            for part in raw.split("```"):
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("{"):
                    raw = part
                    break
        start = raw.find("{"); end = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]
        data = json.loads(raw)
        return NutritionInfo(
            estimated_calories=float(data.get("calories", 0)),
            protein_g=float(data.get("protein_g", 0)),
            fat_g=float(data.get("fat_g", 0)),
            carbs_g=float(data.get("carbs_g", 0)),
        )
    except Exception as e:
        print(f"栄養推定エラー: {e}")
        return NutritionInfo(estimated_calories=0.0, protein_g=0.0, fat_g=0.0, carbs_g=0.0)


async def analyze_food_image(image_bytes: bytes, mime_type: str) -> dict:
    prompt = """
この食事の写真を分析してください。
以下のJSON形式のみで返してください。説明文は不要です。

{
  "food_name": "料理名（日本語）",
  "quantity": "量の推定（例：1人前、茶碗1杯、約200g）",
  "estimated_calories": 数値のみ（kcal）,
  "protein_g": 数値のみ（g）,
  "fat_g": 数値のみ（g）,
  "carbs_g": 数値のみ（g）,
  "description": "簡単な説明（1文）"
}
"""
    try:
        client = get_client()
        response = client.models.generate_content(
            model="gemma-4-26b-a4b-it",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt
            ],
            config=types.GenerateContentConfig(
                system_instruction=(
                    "あなたは栄養士です。食事の画像を分析してカロリーとPFCを含むJSONのみを返してください。"
                )
            )
        )
        raw = response.text.strip()
        if "```" in raw:
            for part in raw.split("```"):
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("{"):
                    raw = part
                    break
        raw = raw.strip()
        start = raw.find("{"); end = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]
        data = json.loads(raw)
        return {
            "food_name":          data.get("food_name", "不明な料理"),
            "quantity":           data.get("quantity", "1人前"),
            "estimated_calories": float(data.get("estimated_calories", 0)),
            "protein_g":          float(data.get("protein_g", 0)),
            "fat_g":              float(data.get("fat_g", 0)),
            "carbs_g":            float(data.get("carbs_g", 0)),
            "description":        data.get("description", ""),
        }
    except Exception as e:
        print(f"画像解析エラー: {e}")
        return {
            "food_name": "解析できませんでした",
            "quantity": "不明",
            "estimated_calories": 0.0,
            "protein_g": 0.0,
            "fat_g": 0.0,
            "carbs_g": 0.0,
            "description": str(e),
        }


# ── エンドポイント ────────────────────────────────────────────

@router.post("/analyze-image")
async def analyze_image(
    file: UploadFile = File(...),
    meal_type: str = "lunch",
    current_user: User = Depends(get_current_user),
):
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="ファイルサイズは10MB以下にしてください")
    mime_type = file.content_type or "image/jpeg"
    if not mime_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="画像ファイルのみ対応しています")
    result = await analyze_food_image(contents, mime_type)
    return {"meal_type": meal_type, **result}


@router.post("/from-image")
async def create_meal_from_image(
    file: UploadFile = File(...),
    meal_type: str = "lunch",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="ファイルサイズは10MB以下にしてください")
    mime_type = file.content_type or "image/jpeg"
    result = await analyze_food_image(contents, mime_type)
    db_meal = Meal(
        user_id=current_user.id,
        meal_type=meal_type,
        food_name=result["food_name"],
        quantity=result["quantity"],
        estimated_calories=result["estimated_calories"],
        protein_g=result.get("protein_g"),
        fat_g=result.get("fat_g"),
        carbs_g=result.get("carbs_g"),
        notes=result.get("description"),
        date=now_jst(),       # ← JST明示
    )
    db.add(db_meal)
    db.commit()
    db.refresh(db_meal)
    return db_meal


@router.post("/")
async def create_meal(
    meal: MealCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    nutrition = await estimate_nutrition(meal.food_name, meal.quantity)
    db_meal = Meal(
        user_id=current_user.id,
        meal_type=meal.meal_type,
        food_name=meal.food_name,
        quantity=meal.quantity,
        estimated_calories=nutrition.estimated_calories,
        protein_g=nutrition.protein_g,
        fat_g=nutrition.fat_g,
        carbs_g=nutrition.carbs_g,
        notes=meal.notes,
        date=now_jst(),       # ← JST明示
    )
    db.add(db_meal)
    db.commit()
    db.refresh(db_meal)
    return db_meal


@router.post("/with-calories")
async def create_meal_with_calories(
    meal: MealCreateWithCalories,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_meal = Meal(
        user_id=current_user.id,
        meal_type=meal.meal_type,
        food_name=meal.food_name,
        quantity=meal.quantity,
        estimated_calories=meal.estimated_calories,
        protein_g=meal.protein_g,
        fat_g=meal.fat_g,
        carbs_g=meal.carbs_g,
        notes=meal.notes,
        date=now_jst(),       # ← JST明示
    )
    db.add(db_meal)
    db.commit()
    db.refresh(db_meal)
    return db_meal


@router.get("/")
def get_meals(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Meal)
        .filter(Meal.user_id == current_user.id)
        .order_by(Meal.date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/today")
def get_today_meals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = today_jst()      # ← JST明示
    start = datetime(today.year, today.month, today.day, 0, 0, 0)
    meals = db.query(Meal).filter(
        Meal.user_id == current_user.id,
        Meal.date >= start,
    ).all()
    total_calories = sum(m.estimated_calories or 0 for m in meals)
    total_protein  = sum(m.protein_g or 0 for m in meals)
    total_fat      = sum(m.fat_g     or 0 for m in meals)
    total_carbs    = sum(m.carbs_g   or 0 for m in meals)
    return {
        "meals":          meals,
        "total_calories": round(total_calories, 1),
        "total_protein":  round(total_protein, 1),
        "total_fat":      round(total_fat, 1),
        "total_carbs":    round(total_carbs, 1),
    }


@router.delete("/{meal_id}")
def delete_meal(
    meal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meal = db.query(Meal).filter(
        Meal.id == meal_id,
        Meal.user_id == current_user.id,
    ).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.delete(meal)
    db.commit()
    return {"ok": True}
