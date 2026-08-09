# backend/app/routers/tdee.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.walking import WalkingSession
from app.models.training import TrainingLog
from app.auth import get_current_user
from app.utils import jst_range_today
from app.services.calorie_engine import (
    calc_bmr,
    calc_target_deficit,
    calc_dynamic_tdee,
    calc_lbm,
    apply_ea_guard,
    calc_pfc_from_lbm,
    estimate_training_calories,
    ACTIVITY_PAL_MAP,
    DEFAULT_PAL,
    DEFAULT_PACE_PCT,
    PACE_OPTIONS_PCT,
)

router = APIRouter(prefix="/api/tdee", tags=["tdee"])


@router.get("/pace-options")
def get_pace_options():
    return {"options": PACE_OPTIONS_PCT, "default": DEFAULT_PACE_PCT}


@router.get("/today")
def get_today_tdee(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    本日の動的TDEE・減量ペースに基づく目標カロリー・EAガード・LBMベースPFCを算出する。
    """
    bmr = calc_bmr(current_user)
    if bmr is None:
        raise HTTPException(
            status_code=400,
            detail="TDEE計算にはプロフィール（年齢・性別・身長・体重）の入力が必要です",
        )

    pal = ACTIVITY_PAL_MAP.get(current_user.activity_level, DEFAULT_PAL)

    start, end = jst_range_today()

    walking_kcal = sum(
        s.estimated_calories or 0.0
        for s in db.query(WalkingSession).filter(
            WalkingSession.user_id == current_user.id,
            WalkingSession.start_time >= start,
            WalkingSession.start_time <= end,
        )
    )
    training_kcal = sum(
        estimate_training_calories(t.duration_minutes, current_user.weight_kg)
        for t in db.query(TrainingLog).filter(
            TrainingLog.user_id == current_user.id,
            TrainingLog.date >= start,
            TrainingLog.date <= end,
        )
    )
    exercise_kcal = round(walking_kcal + training_kcal, 1)

    tdee = calc_dynamic_tdee(bmr, pal, exercise_kcal)

    pace_pct = current_user.pace_pct or DEFAULT_PACE_PCT
    target_deficit = calc_target_deficit(current_user.weight_kg, pace_pct)

    base_target_calories = tdee - target_deficit

    lbm_kg = None
    ea_value = None
    ea_guard_active = False
    pfc = None
    final_target_calories = round(base_target_calories)

    if current_user.body_fat_pct is not None:
        lbm_kg = calc_lbm(current_user.weight_kg, current_user.body_fat_pct)
        final_calories, ea_guard_active, ea_value = apply_ea_guard(
            base_target_calories, exercise_kcal, bmr, lbm_kg
        )
        final_target_calories = round(final_calories)
        pfc = calc_pfc_from_lbm(final_target_calories, lbm_kg)

    return {
        "bmr":                     round(bmr),
        "pal":                     pal,
        "exercise_calories_today": exercise_kcal,
        "tdee":                    round(tdee),
        "pace_pct":                pace_pct,
        "target_deficit":          round(target_deficit),
        "base_target_calories":    round(base_target_calories),
        "target_calories":         final_target_calories,
        "lbm_kg":                  round(lbm_kg, 1) if lbm_kg is not None else None,
        "ea_value":                round(ea_value, 1) if ea_value is not None else None,
        "ea_guard_active":         ea_guard_active,
        "recommended_pfc":         pfc,
    }
