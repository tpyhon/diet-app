from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import bcrypt

from ..database import get_db
from ..models.user import User
from ..auth import create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ───── Schemas ─────

class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class ProfileUpdateRequest(BaseModel):
    age: Optional[int] = None
    gender: Optional[str] = None          # "male" / "female"
    height_cm: Optional[float] = None
    current_weight_kg: Optional[float] = None
    activity_level: Optional[str] = None  # "sedentary"/"light"/"moderate"/"active"/"very_active"
    goal: Optional[str] = None            # "lose"/"maintain"/"gain"
    calorie_goal: Optional[int] = None    # 手動上書きも可


# ───── Helpers ─────

def calc_calorie_goal(age: int, gender: str, height_cm: float,
                      weight_kg: float, activity_level: str, goal: str) -> int:
    """
    Harris-Benedict式（改訂版）でTDEEを算出し、目標に応じて増減。
    """
    # BMR
    if gender == "male":
        bmr = 88.362 + (13.397 * weight_kg) + (4.799 * height_cm) - (5.677 * age)
    else:
        bmr = 447.593 + (9.247 * weight_kg) + (3.098 * height_cm) - (4.330 * age)

    # 活動係数
    multipliers = {
        "sedentary":   1.2,
        "light":       1.375,
        "moderate":    1.55,
        "active":      1.725,
        "very_active": 1.9,
    }
    tdee = bmr * multipliers.get(activity_level, 1.55)

    # 目標調整
    if goal == "lose":
        tdee -= 500   # 約0.5kg/週減
    elif goal == "gain":
        tdee += 300

    return max(1200, round(tdee))  # 最低1200kcal


# ───── Endpoints ─────

@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    user = User(username=req.username, hashed_password=hashed, calorie_goal=2000)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not bcrypt.checkpw(req.password.encode(), user.hashed_password.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "age": current_user.age,
        "gender": current_user.gender,
        "height_cm": current_user.height_cm,
        "current_weight_kg": current_user.current_weight_kg,
        "activity_level": current_user.activity_level,
        "goal": current_user.goal,
        "calorie_goal": current_user.calorie_goal or 2000,
    }


@router.put("/profile")
def update_profile(
    req: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """個人情報を更新。情報が揃っていれば calorie_goal を自動再計算する。"""
    update_fields = req.model_dump(exclude_none=True)
    for key, val in update_fields.items():
        setattr(current_user, key, val)

    # calorie_goal が手動指定されていない場合は自動計算を試みる
    if "calorie_goal" not in update_fields:
        u = current_user
        if all([u.age, u.gender, u.height_cm, u.current_weight_kg, u.activity_level, u.goal]):
            current_user.calorie_goal = calc_calorie_goal(
                u.age, u.gender, u.height_cm, u.current_weight_kg, u.activity_level, u.goal
            )

    db.commit()
    db.refresh(current_user)
    return {
        "id": current_user.id,
        "username": current_user.username,
        "age": current_user.age,
        "gender": current_user.gender,
        "height_cm": current_user.height_cm,
        "current_weight_kg": current_user.current_weight_kg,
        "activity_level": current_user.activity_level,
        "goal": current_user.goal,
        "calorie_goal": current_user.calorie_goal or 2000,
    }
