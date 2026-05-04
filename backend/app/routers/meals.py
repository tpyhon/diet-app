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
import os, json, httpx

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


# ── バーコード検索 ────────────────────────────────────────────

async def lookup_barcode_off(barcode: str) -> Optional[dict]:
    """
    Open Food Facts API でバーコードを検索する。
    100g あたりの栄養素データを返す。
    商品が見つからない場合は None を返す。
    """
    url = (
        f"https://world.openfoodfacts.org/api/v2/product/{barcode}"
        "?fields=product_name,product_name_ja,nutriments,serving_size,serving_quantity"
    )
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(url, headers={"User-Agent": "DietApp/1.0"})
        if res.status_code != 200:
            return None
        data = res.json()
        if data.get("status") != 1:
            return None

        product    = data["product"]
        nutriments = product.get("nutriments", {})

        # 商品名：日本語優先、なければ汎用名
        name = (
            product.get("product_name_ja")
            or product.get("product_name")
            or "不明な商品"
        )

        # 100gあたりの栄養素
        cal_100g     = nutriments.get("energy-kcal_100g")
        protein_100g = nutriments.get("proteins_100g")
        fat_100g     = nutriments.get("fat_100g")
        carbs_100g   = nutriments.get("carbohydrates_100g")

        # 1食分の量（serving_quantity があればそちらを使う）
        serving_qty  = product.get("serving_quantity")   # g数
        serving_size = product.get("serving_size") or "1食分"

        # いずれかの栄養素がある場合のみ返す
        if any(v is not None for v in [cal_100g, protein_100g, fat_100g, carbs_100g]):
            return {
                "food_name":      name,
                "serving_size":   serving_size,
                "serving_qty_g":  float(serving_qty) if serving_qty else None,
                "cal_100g":       float(cal_100g)     if cal_100g     is not None else None,
                "protein_100g":   float(protein_100g) if protein_100g is not None else None,
                "fat_100g":       float(fat_100g)     if fat_100g     is not None else None,
                "carbs_100g":     float(carbs_100g)   if carbs_100g   is not None else None,
                "source":         "open_food_facts",
            }
        # 商品名だけある場合（栄養素なし）
        if name != "不明な商品":
            return {
                "food_name":    name,
                "serving_size": serving_size,
                "source":       "open_food_facts_name_only",
            }
        return None
    except Exception as e:
        print(f"Open Food Facts エラー: {e}")
        return None


@router.get("/barcode/{barcode}")
async def lookup_barcode(
    barcode: str,
    current_user: User = Depends(get_current_user),
):
    """
    バーコード（JANコード）から食品の栄養素情報を取得する。

    優先順位:
      1. Open Food Facts に栄養素データあり → そのまま返す
      2. 商品名のみ取得できた → Gemma AI で栄養素を推定
      3. データなし → Gemma AI に商品コードで推定させる（精度低め）

    レスポンスには source フィールドで情報源を明示する:
      "open_food_facts"          … OFFから栄養素を取得
      "ai_estimated_with_name"   … 商品名あり・AIが栄養素を推定
      "ai_estimated_no_data"     … 商品不明・AIが推定（精度低）
    """
    off_result = await lookup_barcode_off(barcode)

    # ── ケース1: OFFに栄養素データあり ──────────────────────
    if off_result and off_result.get("source") == "open_food_facts":
        qty_g = off_result.get("serving_qty_g") or 100.0
        ratio = qty_g / 100.0

        def scale(val):
            return round(val * ratio, 1) if val is not None else 0.0

        return {
            "barcode":            barcode,
            "food_name":          off_result["food_name"],
            "quantity":           off_result.get("serving_size", f"{qty_g}g"),
            "estimated_calories": scale(off_result.get("cal_100g")),
            "protein_g":          scale(off_result.get("protein_100g")),
            "fat_g":              scale(off_result.get("fat_100g")),
            "carbs_g":            scale(off_result.get("carbs_100g")),
            "per_100g": {
                "calories":  off_result.get("cal_100g"),
                "protein_g": off_result.get("protein_100g"),
                "fat_g":     off_result.get("fat_100g"),
                "carbs_g":   off_result.get("carbs_100g"),
            },
            "source":      "open_food_facts",
            "description": "Open Food Facts のデータを使用しています",
        }

    # ── ケース2: 商品名のみ取得 → AIで推定 ──────────────────
    if off_result and off_result.get("source") == "open_food_facts_name_only":
        food_name = off_result["food_name"]
        nutrition = await estimate_nutrition(food_name, "1食分")
        return {
            "barcode":            barcode,
            "food_name":          food_name,
            "quantity":           "1食分",
            "estimated_calories": nutrition.estimated_calories,
            "protein_g":          nutrition.protein_g,
            "fat_g":              nutrition.fat_g,
            "carbs_g":            nutrition.carbs_g,
            "source":             "ai_estimated_with_name",
            "description":        f"「{food_name}」の栄養素をAIが推定しました（目安値）",
        }

    # ── ケース3: データなし → AIに商品コードで推定させる ────
    prompt = (
        f"JANコード {barcode} の食品について知っていますか？\n"
        "知っている場合は商品名と栄養素を、知らない場合でも一般的な同種食品の平均値を以下のJSON形式のみで返してください。\n"
        '{"food_name": "商品名または推定名", "calories": 数値, "protein_g": 数値, "fat_g": 数値, "carbs_g": 数値, "confidence": "high/low"}'
    )
    try:
        client = get_client()
        response = client.models.generate_content(
            model="gemma-4-26b-a4b-it",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction="あなたは栄養士です。JSONのみを返してください。"
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
        ai_data = json.loads(raw)
        return {
            "barcode":            barcode,
            "food_name":          ai_data.get("food_name", "不明な商品"),
            "quantity":           "1食分",
            "estimated_calories": float(ai_data.get("calories", 0)),
            "protein_g":          float(ai_data.get("protein_g", 0)),
            "fat_g":              float(ai_data.get("fat_g", 0)),
            "carbs_g":            float(ai_data.get("carbs_g", 0)),
            "source":             "ai_estimated_no_data",
            "description":        "データベースに登録がないため、AIが推定した目安値です",
        }
    except Exception as e:
        print(f"AI推定エラー: {e}")
        raise HTTPException(
            status_code=404,
            detail="商品が見つからず、AI推定にも失敗しました"
        )


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
        date=now_jst(),
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
        date=now_jst(),
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
        date=now_jst(),
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
    today = today_jst()
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
