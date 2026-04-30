from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models.meal import Meal
from google import genai
from google.genai import types
import os, base64

router = APIRouter(prefix="/api/meals", tags=["meals"])

def get_client():
    return genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

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
    notes: Optional[str] = None

async def estimate_calories(food_name: str, quantity: str) -> float:
    """テキストからカロリーを推定"""
    prompt = (
        f"食品名: {food_name}\n量: {quantity}\n\n"
        "このメニューのカロリーをkcalの数値のみで答えてください。"
        "数字以外は一切含めないでください。例: 320"
    )
    try:
        client = get_client()
        response = client.models.generate_content(
            model="gemma-4-26b-a4b-it",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction="あなたは栄養士です。カロリーの数値のみを返してください。"
            )
        )
        return float(response.text.strip().replace("kcal","").replace("Kcal","").strip())
    except Exception:
        return 0.0

async def analyze_food_image(image_bytes: bytes, mime_type: str) -> dict:
    """画像から料理名・カロリー・量を推定"""
    prompt = """
この食事の写真を分析してください。
以下のJSON形式のみで返してください。説明文は不要です。

{
  "food_name": "料理名（日本語）",
  "quantity": "量の推定（例：1人前、茶碗1杯、約200g）",
  "estimated_calories": 数値のみ（kcal）,
  "description": "簡単な説明（1文）"
}
"""
    try:
        client = get_client()

        # 画像をbase64エンコード
        image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

        response = client.models.generate_content(
            model="gemma-4-26b-a4b-it",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt
            ],
            config=types.GenerateContentConfig(
                system_instruction="あなたは栄養士です。食事の画像を分析してJSONのみを返してください。"
            )
        )

        raw = response.text.strip()
        # コードブロック除去
        if "```" in raw:
            parts = raw.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("{"):
                    raw = part
                    break
        raw = raw.strip()
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]

        import json
        data = json.loads(raw)
        return {
            "food_name": data.get("food_name", "不明な料理"),
            "quantity":  data.get("quantity", "1人前"),
            "estimated_calories": float(data.get("estimated_calories", 0)),
            "description": data.get("description", ""),
        }
    except Exception as e:
        print(f"画像解析エラー: {e}")
        return {
            "food_name": "解析できませんでした",
            "quantity": "不明",
            "estimated_calories": 0.0,
            "description": str(e),
        }

# ── エンドポイント ────────────────────────────────────────

@router.post("/analyze-image")
async def analyze_image(
    file: UploadFile = File(...),
    meal_type: str = "lunch"
):
    """画像をアップロードして料理名・カロリーを推定（保存はしない）"""
    # ファイルサイズチェック（10MB以下）
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="ファイルサイズは10MB以下にしてください")

    # MIMEタイプチェック
    mime_type = file.content_type or "image/jpeg"
    if not mime_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="画像ファイルのみ対応しています")

    result = await analyze_food_image(contents, mime_type)
    return {
        "meal_type": meal_type,
        **result
    }

@router.post("/from-image")
async def create_meal_from_image(
    file: UploadFile = File(...),
    meal_type: str = "lunch",
    db: Session = Depends(get_db)
):
    """画像から料理を解析してそのままDBに保存"""
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="ファイルサイズは10MB以下にしてください")

    mime_type = file.content_type or "image/jpeg"
    result = await analyze_food_image(contents, mime_type)

    db_meal = Meal(
        meal_type=meal_type,
        food_name=result["food_name"],
        quantity=result["quantity"],
        estimated_calories=result["estimated_calories"],
        notes=result.get("description"),
    )
    db.add(db_meal)
    db.commit()
    db.refresh(db_meal)
    return db_meal

@router.post("/")
async def create_meal(meal: MealCreate, db: Session = Depends(get_db)):
    calories = await estimate_calories(meal.food_name, meal.quantity)
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

@router.post("/with-calories")
async def create_meal_with_calories(
    meal: MealCreateWithCalories,
    db: Session = Depends(get_db)
):
    """カロリー確認済みの食事を保存（画像解析後の確認保存用）"""
    db_meal = Meal(
        meal_type=meal.meal_type,
        food_name=meal.food_name,
        quantity=meal.quantity,
        estimated_calories=meal.estimated_calories,
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
    total_calories = sum(m.estimated_calories or 0 for m in meals)
    return {"meals": meals, "total_calories": round(total_calories, 1)}

@router.delete("/{meal_id}")
def delete_meal(meal_id: int, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.delete(meal)
    db.commit()
    return {"ok": True}
