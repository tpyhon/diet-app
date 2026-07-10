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
from app.utils import now_jst, today_jst, parse_json_from_llm
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
        "【システム指示：あなたは栄養士です。食品のカロリーとPFC（タンパク質・脂質・炭水化物）をJSONのみで返してください。】\n\n"
        f"食品名: {food_name}\n量: {quantity}\n\n"
        "この食事の栄養素を以下のJSON形式のみで返してください。説明文は不要です。\n"
        '{"calories": 数値, "protein_g": 数値, "fat_g": 数値, "carbs_g": 数値}'
    )
    try:
        client = get_client()
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash"),
            contents=prompt
        )
        raw = response.text
        data = parse_json_from_llm(raw)
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
    prompt = f"【システム指示：あなたは栄養士です。食事の画像を分析してカロリーとPFCを含むJSONのみを返してください。】\n\n{prompt}"
    try:
        client = get_client()
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash"),
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt
            ]
        )
        raw = response.text
        data = parse_json_from_llm(raw)
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
        f"バーコード(JANコード): {barcode}\n\n"
        "このバーコードに対応する商品を特定し、一般的な1食分の量と栄養素を推測してください。\n"
        "以下のJSON形式のみで返してください。余計な説明文は一切含めないでください。\n"
        '{"food_name": "商品名", "calories": 数値, "protein_g": 数値, "fat_g": 数値, "carbs_g": 数値}'
    )
    prompt = f"【システム指示：あなたは栄養士です。JSONのみを返してください。】\n\n{prompt}"
    try:
        client = get_client()
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash"),
            contents=prompt
        )
        raw = response.text
        ai_data = parse_json_from_llm(raw)
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


@router.post("/ai-plan")
async def get_ai_meal_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.routers.auth import calc_recommended_pfc
    from datetime import timedelta

    # 1. 今日の食事を取得
    today = today_jst()
    start = datetime(today.year, today.month, today.day, 0, 0, 0)
    today_meals = db.query(Meal).filter(
        Meal.user_id == current_user.id,
        Meal.date >= start,
    ).all()

    # 2. 入力済みの食事タイプをチェック
    has_breakfast = any(m.meal_type == "breakfast" for m in today_meals)
    has_lunch = any(m.meal_type == "lunch" for m in today_meals)
    has_dinner = any(m.meal_type == "dinner" for m in today_meals)

    # 3. 提案する食事タイプを決定 (朝食・昼食・夕食)
    now = now_jst()
    current_hour = now.hour

    suggest_meals = []
    if has_breakfast and has_lunch:
        suggest_meals = ["dinner"]
    elif has_breakfast and not has_lunch:
        suggest_meals = ["lunch", "dinner"]
    elif not has_breakfast and has_lunch:
        suggest_meals = ["dinner"]
    else:  # 朝食も昼食もまだ
        if current_hour >= 16:
            suggest_meals = ["dinner"]
        elif current_hour >= 10:
            suggest_meals = ["lunch", "dinner"]
        else:
            suggest_meals = ["breakfast", "lunch", "dinner"]

    # 4. 今日の摂取栄養素と目標値
    total_calories = sum(m.estimated_calories or 0 for m in today_meals)
    total_protein  = sum(m.protein_g or 0 for m in today_meals)
    total_fat      = sum(m.fat_g     or 0 for m in today_meals)
    total_carbs    = sum(m.carbs_g   or 0 for m in today_meals)

    calorie_goal = current_user.calorie_goal or 2000
    pfc_goals = calc_recommended_pfc(calorie_goal, current_user.diet_goal)
    
    target_protein = pfc_goals["protein_g"]
    target_fat     = pfc_goals["fat_g"]
    target_carbs   = pfc_goals["carbs_g"]

    rem_cal = calorie_goal - total_calories
    rem_p   = target_protein - total_protein
    rem_f   = target_fat - total_fat
    rem_c   = target_carbs - total_carbs

    # 5. 最近5日間に食べたメニューを取得（同じメニューの重複を防ぐ）
    past_since = today - timedelta(days=5)
    past_start = datetime(past_since.year, past_since.month, past_since.day, 0, 0, 0)
    recent_meals = db.query(Meal).filter(
        Meal.user_id == current_user.id,
        Meal.date >= past_start,
        Meal.date < start
    ).order_by(Meal.date.desc()).all()
    recent_menu_names = list(set([m.food_name for m in recent_meals if m.food_name]))

    meal_labels = {"breakfast": "朝食", "lunch": "昼食", "dinner": "夕食", "snack": "間食"}
    target_str = ", ".join([meal_labels.get(m, m) for m in suggest_meals]) if suggest_meals else "間食または栄養調整用の軽食"

    prompt = (
        "ユーザーの今日の目標達成に向けて、最適な食事プラン（PFCバランス考慮）を提案してください。\n\n"
        f"【今日の状況】\n"
        f"- 提案対象の食事: {target_str}\n"
        f"- 残りカロリー目標: {rem_cal:.1f} kcal\n"
        f"- 残りタンパク質(P): {rem_p:.1f} g\n"
        f"- 残り脂質(F): {rem_f:.1f} g\n"
        f"- 残り炭水化物(C): {rem_c:.1f} g\n\n"
        f"【重複禁止ルール】\n"
        f"最近の食事メニュー: {recent_menu_names}\n"
        "これらのメニューと似た、あるいは重複する料理は絶対に提案しないでください。新しいバリエーションの料理を提案してください。\n\n"
        "【出力フォーマット】\n"
        "以下のJSONフォーマットのみを返してください。マークダウンの ```json のような囲みや、JSON以外の説明テキストは一切含めないでください。\n"
        "{\n"
        "  \"suggestions\": [\n"
        "    {\n"
        "      \"meal_type\": \"breakfast\" または \"lunch\" または \"dinner\",\n"
        "      \"food_name\": \"料理名\",\n"
        "      \"quantity\": \"量の目安（例: 1人前、150g等）\",\n"
        "      \"estimated_calories\": カロリー（数値）,\n"
        "      \"protein_g\": タンパク質（数値）,\n"
        "      \"fat_g\": 脂質（数値）,\n"
        "      \"carbs_g\": 炭水化物（数値）,\n"
        "      \"description\": \"この食事を提案する理由・栄養アドバイス（1〜2文）\"\n"
        "    }\n"
        "  ],\n"
        "  \"general_comment\": \"今日全体の食事・栄養バランスについてのアドバイス・応援メッセージ\"\n"
        "}"
    )
    prompt = f"【システム指示：あなたは優秀な栄養プランナーです。必ずJSONのみを返してください。】\n\n{prompt}"
    try:
        client = get_client()
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash"),
            contents=prompt
        )
        data = parse_json_from_llm(response.text)
        return data
    except Exception as e:
        print(f"AI食事プラン生成エラー: {e}")
        return {
            "suggestions": [],
            "general_comment": "AIの提案を作成できませんでした。残りカロリーとPFC目標を意識して食事を記録してみましょう！"
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
