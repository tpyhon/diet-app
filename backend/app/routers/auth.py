# backend/app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.user import User
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from google import genai
from google.genai import types
from app.utils import parse_json_from_llm
import os, json

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Pydanticスキーマ ──────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: str | None = None

class ProfileUpdate(BaseModel):
    display_name:   Optional[str]   = None
    age:            Optional[int]   = None
    gender:         Optional[str]   = None   # male / female / other
    height_cm:      Optional[float] = None
    weight_kg:      Optional[float] = None
    activity_level: Optional[str]   = None   # sedentary/lightly/moderately/very/super
    diet_goal:      Optional[str]   = None   # lose / maintain / gain
    calorie_goal:   Optional[int]   = None   # 手動設定


# ── ヘルパー ──────────────────────────────────────────────────

ACTIVITY_MAP = {
    "sedentary":  1.2,
    "lightly":    1.375,
    "moderately": 1.55,
    "very":       1.725,
    "super":      1.9,
}

def calc_tdee(user: User) -> Optional[int]:
    """Harris–Benedict式でTDEEを計算してカロリー目標を返す。"""
    if not all([user.age, user.gender, user.height_cm, user.weight_kg, user.activity_level]):
        return None
    w = user.weight_kg
    h = user.height_cm
    a = user.age
    if user.gender == "male":
        bmr = 88.362 + 13.397 * w + 4.799 * h - 5.677 * a
    else:
        bmr = 447.593 + 9.247 * w + 3.098 * h - 4.330 * a
    tdee = bmr * ACTIVITY_MAP.get(user.activity_level, 1.55)
    if user.diet_goal == "lose":
        tdee -= 500
    elif user.diet_goal == "gain":
        tdee += 300
    return max(1200, round(tdee))


def calc_recommended_pfc(calorie_goal: int, diet_goal: Optional[str]) -> dict:
    """
    カロリー目標と目的に応じた推奨PFC(g)を計算する。

    PFCカロリー換算:
        タンパク質 4 kcal/g
        脂質      9 kcal/g
        炭水化物  4 kcal/g

    比率の根拠（厚生労働省・一般的なスポーツ栄養学より）:
        減量 (lose)    : P30% / F25% / C45%  ← タンパク質多め・糖質控えめ
        維持 (maintain): P25% / F25% / C50%  ← バランス重視
        増量 (gain)    : P25% / F20% / C55%  ← 糖質多め・エネルギー重視
    """
    ratio_map = {
        "lose":     {"p": 0.30, "f": 0.25, "c": 0.45},
        "maintain": {"p": 0.25, "f": 0.25, "c": 0.50},
        "gain":     {"p": 0.25, "f": 0.20, "c": 0.55},
    }
    ratio = ratio_map.get(diet_goal or "maintain", ratio_map["maintain"])
    return {
        "protein_g": round(calorie_goal * ratio["p"] / 4),
        "fat_g":     round(calorie_goal * ratio["f"] / 9),
        "carbs_g":   round(calorie_goal * ratio["c"] / 4),
        "ratio": {
            "protein_pct": round(ratio["p"] * 100),
            "fat_pct":     round(ratio["f"] * 100),
            "carbs_pct":   round(ratio["c"] * 100),
        }
    }


# ── エンドポイント ────────────────────────────────────────────

@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="このユーザー名は既に使われています")
    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        display_name=req.display_name or req.username,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, user.username)
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "display_name": user.display_name,
    }


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="ユーザー名またはパスワードが間違っています")
    token = create_access_token(user.id, user.username)
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "display_name": user.display_name,
    }


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    calorie_goal = current_user.calorie_goal or 2000
    pfc = calc_recommended_pfc(calorie_goal, current_user.diet_goal)
    return {
        "id":             current_user.id,
        "username":       current_user.username,
        "display_name":   current_user.display_name,
        "age":            current_user.age,
        "gender":         current_user.gender,
        "height_cm":      current_user.height_cm,
        "weight_kg":      current_user.weight_kg,
        "activity_level": current_user.activity_level,
        "diet_goal":      current_user.diet_goal,
        "calorie_goal":   calorie_goal,
        "recommended_pfc": pfc,
    }


@router.put("/profile")
def update_profile(
    req: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """プロフィール更新。calorie_goalが未指定の場合はTDEEから自動計算。"""
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)

    if req.calorie_goal is None:
        auto = calc_tdee(current_user)
        if auto:
            current_user.calorie_goal = auto

    db.commit()
    db.refresh(current_user)

    calorie_goal = current_user.calorie_goal or 2000
    pfc = calc_recommended_pfc(calorie_goal, current_user.diet_goal)
    return {
        "id":             current_user.id,
        "username":       current_user.username,
        "display_name":   current_user.display_name,
        "age":            current_user.age,
        "gender":         current_user.gender,
        "height_cm":      current_user.height_cm,
        "weight_kg":      current_user.weight_kg,
        "activity_level": current_user.activity_level,
        "diet_goal":      current_user.diet_goal,
        "calorie_goal":   calorie_goal,
        "recommended_pfc": pfc,
    }


@router.post("/suggest-calorie-goal")
async def suggest_calorie_goal(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    登録済みの個人情報をもとにGemmaがカロリー目標と推奨PFCを提案し、
    自動でDBに保存する。
    """
    if not all([current_user.age, current_user.gender, current_user.height_cm,
                current_user.weight_kg, current_user.activity_level, current_user.diet_goal]):
        raise HTTPException(
            status_code=400,
            detail="AI提案にはプロフィール（年齢・性別・身長・体重・活動レベル・目標）の入力が必要です"
        )

    activity_label = {
        "sedentary":  "ほぼ座りっぱなし",
        "lightly":    "軽い運動（週1〜3回）",
        "moderately": "適度な運動（週3〜5回）",
        "very":       "活発な運動（週6〜7回）",
        "super":      "非常に活発（肉体労働など）",
    }.get(current_user.activity_level, current_user.activity_level)

    goal_label = {
        "lose":     "体重を減らしたい",
        "maintain": "体重を維持したい",
        "gain":     "体重を増やしたい",
    }.get(current_user.diet_goal, current_user.diet_goal)

    gender_label = {
        "male": "男性", "female": "女性", "other": "その他"
    }.get(current_user.gender, current_user.gender)

    prompt = f"""
あなたは専門の栄養士です。以下のユーザー情報に基づいて、最適な1日の摂取カロリー目標と
理想的なPFCバランスを提案してください。

【ユーザー情報】
- 年齢: {current_user.age}歳
- 性別: {gender_label}
- 身長: {current_user.height_cm}cm
- 体重: {current_user.weight_kg}kg
- 活動レベル: {activity_label}
- 目標: {goal_label}

以下のJSON形式のみで返してください。説明文は不要です。
{{
  "calorie_goal": 数値（kcal整数）,
  "protein_g": 数値（g整数）,
  "fat_g": 数値（g整数）,
  "carbs_g": 数値（g整数）,
  "reason": "提案理由（2〜3文、日本語）"
}}
"""
    suggested    = None
    ai_protein_g = None
    ai_fat_g     = None
    ai_carbs_g   = None
    reason       = ""

    try:
        prompt = f"【システム指示：あなたは栄養の専門家です。JSONのみを返してください。】\n\n{prompt}"
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash"),
            contents=prompt
        )
        raw = response.text
        data = parse_json_from_llm(raw)
        suggested   = int(data.get("calorie_goal", 2000))
        ai_protein_g = data.get("protein_g")
        ai_fat_g     = data.get("fat_g")
        ai_carbs_g   = data.get("carbs_g")
        reason       = data.get("reason", "")
    except Exception as e:
        print(f"AI提案エラー: {e}")
        suggested = calc_tdee(current_user) or 2000
        reason    = "Harris–Benedict式による自動計算"

    # DBに保存
    current_user.calorie_goal = suggested
    db.commit()

    # PFC: AIが返した値があればそちらを優先、なければ比率計算で補完
    if ai_protein_g and ai_fat_g and ai_carbs_g:
        total_pfc_cal = ai_protein_g * 4 + ai_fat_g * 9 + ai_carbs_g * 4
        pfc = {
            "protein_g": ai_protein_g,
            "fat_g":     ai_fat_g,
            "carbs_g":   ai_carbs_g,
            "ratio": {
                "protein_pct": round(ai_protein_g * 4 / total_pfc_cal * 100) if total_pfc_cal else 25,
                "fat_pct":     round(ai_fat_g     * 9 / total_pfc_cal * 100) if total_pfc_cal else 25,
                "carbs_pct":   round(ai_carbs_g   * 4 / total_pfc_cal * 100) if total_pfc_cal else 50,
            }
        }
    else:
        pfc = calc_recommended_pfc(suggested, current_user.diet_goal)

    return {
        "calorie_goal":    suggested,
        "reason":          reason,
        "recommended_pfc": pfc,
    }
