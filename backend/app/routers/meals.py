from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import json, re, base64
from datetime import date, datetime, timezone

from ..database import get_db
from ..models.meal import Meal
from ..models.user import User
from ..auth import get_current_user

import google.generativeai as genai
import os

router = APIRouter(prefix="/api/meals", tags=["meals"])

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemma-4-26b-a4b-it"


# ───── Schemas ─────

class MealCreate(BaseModel):
    description: str
    meal_type: Optional[str] = None

class MealWithCalories(BaseModel):
    description: str
    calories: float
    protein_g: Optional[float] = None
    fat_g: Optional[float] = None
    carbs_g: Optional[float] = None
    meal_type: Optional[str] = None


# ───── AI Helper ─────

def parse_nutrition_from_ai(text: str) -> dict:
    """
    AIレスポンスから calories / protein_g / fat_g / carbs_g を抽出。
    JSON形式で返すようプロンプト設計するが、失敗時は正規表現でフォールバック。
    """
    # JSON抽出を試みる
    json_match = re.search(r'\{[^{}]+\}', text, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group())
            return {
                "calories": float(data.get("calories", 0)),
                "protein_g": float(data.get("protein_g", 0)) if data.get("protein_g") is not None else None,
                "fat_g": float(data.get("fat_g", 0)) if data.get("fat_g") is not None else None,
                "carbs_g": float(data.get("carbs_g", 0)) if data.get("carbs_g") is not None else None,
            }
        except Exception:
            pass

    # フォールバック: caloriesだけ正規表現で取得
    cal_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:kcal|カロリー|cal)', text, re.IGNORECASE)
    calories = float(cal_match.group(1)) if cal_match else 0.0
    return {"calories": calories, "protein_g": None, "fat_g": None, "carbs_g": None}


NUTRITION_PROMPT_TEMPLATE = """
以下の食事の栄養情報を推定してください。
食事: {description}

必ず以下のJSON形式のみで回答してください（説明文不要）:
{{
  "calories": 推定カロリー（数値・kcal）,
  "protein_g": タンパク質（g・数値）,
  "fat_g": 脂質（g・数値）,
  "carbs_g": 炭水化物（g・数値）
}}
"""

IMAGE_NUTRITION_PROMPT = """
この画像の料理を識別し、栄養情報を推定してください。

必ず以下のJSON形式のみで回答してください（説明文不要）:
{
  "description": "料理名",
  "calories": 推定カロリー（数値・kcal）,
  "protein_g": タンパク質（g・数値）,
  "fat_g": 脂質（g・数値）,
  "carbs_g": 炭水化物（g・数値）
}
"""


# ───── Endpoints ─────

@router.post("/")
def create_meal_from_text(
    req: MealCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prompt = NUTRITION_PROMPT_TEMPLATE.format(description=req.description)
    model = genai.GenerativeModel(MODEL)
    response = model.generate_content(prompt)
    nutrition = parse_nutrition_from_ai(response.text)

    meal = Meal(
        user_id=current_user.id,
        description=req.description,
        calories=nutrition["calories"],
        protein_g=nutrition["protein_g"],
        fat_g=nutrition["fat_g"],
        carbs_g=nutrition["carbs_g"],
        meal_type=req.meal_type,
    )
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return meal


@router.post("/analyze-image")
async def analyze_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    image_data = await file.read()
    b64 = base64.b64encode(image_data).decode()
    model = genai.GenerativeModel(MODEL)
    response = model.generate_content([
        {"mime_type": file.content_type, "data": b64},
        IMAGE_NUTRITION_PROMPT,
    ])

    # JSON全体をパース（description含む）
    json_match = re.search(r'\{[^{}]+\}', response.text, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group())
            return {
                "description": data.get("description", "不明な料理"),
                "calories": float(data.get("calories", 0)),
                "protein_g": float(data.get("protein_g", 0)) if data.get("protein_g") is not None else None,
                "fat_g": float(data.get("fat_g", 0)) if data.get("fat_g") is not None else None,
                "carbs_g": float(data.get("carbs_g", 0)) if data.get("carbs_g") is not None else None,
            }
        except Exception:
            pass

    return {"description": "解析失敗", "calories": 0, "protein_g": None, "fat_g": None, "carbs_g": None}


@router.post("/from-image")
async def create_meal_from_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await analyze_image(file=file, current_user=current_user)
    meal = Meal(
        user_id=current_user.id,
        description=result["description"],
        calories=result["calories"],
        protein_g=result.get("protein_g"),
        fat_g=result.get("fat_g"),
        carbs_g=result.get("carbs_g"),
    )
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return meal


@router.post("/with-calories")
def create_meal_with_calories(
    req: MealWithCalories,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meal = Meal(
        user_id=current_user.id,
        description=req.description,
        calories=req.calories,
        protein_g=req.protein_g,
        fat_g=req.fat_g,
        carbs_g=req.carbs_g,
        meal_type=req.meal_type,
    )
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return meal


@router.get("/")
def get_meals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Meal).filter(Meal.user_id == current_user.id).order_by(Meal.recorded_at.desc()).all()


@router.get("/today")
def get_today_meals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    meals = (
        db.query(Meal)
        .filter(Meal.user_id == current_user.id)
        .all()
    )
    today_meals = [m for m in meals if m.recorded_at and m.recorded_at.date() == today]
    total_calories = sum(m.calories for m in today_meals)
    total_protein = sum(m.protein_g or 0 for m in today_meals)
    total_fat = sum(m.fat_g or 0 for m in today_meals)
    total_carbs = sum(m.carbs_g or 0 for m in today_meals)
    return {
        "meals": today_meals,
        "total_calories": total_calories,
        "total_protein_g": round(total_protein, 1),
        "total_fat_g": round(total_fat, 1),
        "total_carbs_g": round(total_carbs, 1),
        "calorie_goal": current_user.calorie_goal or 2000,
    }


@router.delete("/{meal_id}")
def delete_meal(
    meal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meal = db.query(Meal).filter(Meal.id == meal_id, Meal.user_id == current_user.id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.delete(meal)
    db.commit()
    return {"ok": True}
