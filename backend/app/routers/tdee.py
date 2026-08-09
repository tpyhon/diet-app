# backend/app/routers/tdee.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import timedelta
from app.database import get_db
from app.models.user import User
from app.models.walking import WalkingSession
from app.models.training import TrainingLog
from app.models.meal import Meal
from app.models.weight import WeightRecord
from app.auth import get_current_user
from app.utils import jst_range_today, now_jst, today_jst
from app.services.calorie_engine import (
    calc_bmr,
    calc_target_deficit,
    calc_dynamic_tdee,
    calc_calculated_tdee,
    blend_final_tdee,
    calc_lbm,
    apply_ea_guard,
    calc_pfc_from_lbm,
    calc_missing_data_status,
    estimate_training_calories,
    ACTIVITY_PAL_MAP,
    DEFAULT_PAL,
    DEFAULT_PACE_PCT,
    PACE_OPTIONS_PCT,
    ADAPTIVE_WINDOW_DAYS,
    ADAPTIVE_MIN_VALID_DAYS,
    DEFAULT_TDEE_FALLBACK,
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

    static_tdee = calc_dynamic_tdee(bmr, pal, exercise_kcal)

    # ── アダプティブTDEE（過去14日間の実績から逆算した実測修正TDEE） ──
    window_start = now_jst() - timedelta(days=ADAPTIVE_WINDOW_DAYS)

    meals_in_window = db.query(Meal).filter(
        Meal.user_id == current_user.id,
        Meal.date >= window_start,
    ).all()
    daily_cal_totals: dict = {}
    for m in meals_in_window:
        day = m.date.date()
        daily_cal_totals[day] = daily_cal_totals.get(day, 0.0) + (m.estimated_calories or 0.0)
    valid_days_count = len(daily_cal_totals)

    weight_records_in_window = (
        db.query(WeightRecord)
        .filter(WeightRecord.user_id == current_user.id, WeightRecord.date >= window_start)
        .order_by(WeightRecord.date.asc())
        .all()
    )

    # ── 欠損期間フォールバック（体重・食事記録が途絶えている連続日数を判定） ──
    last_meal_date   = db.query(func.max(Meal.date)).filter(Meal.user_id == current_user.id).scalar()
    last_weight_date = db.query(func.max(WeightRecord.date)).filter(WeightRecord.user_id == current_user.id).scalar()
    last_activity_dates = [d for d in (last_meal_date, last_weight_date) if d is not None]
    consecutive_missing_days = (
        (today_jst() - max(last_activity_dates).date()).days if last_activity_dates else None
    )
    missing_status       = calc_missing_data_status(consecutive_missing_days)
    is_estimated_mode    = missing_status["is_estimated_mode"]
    needs_recalibration  = missing_status["needs_recalibration"]

    avg_cal_in      = None
    delta_weight_kg = None
    calculated_tdee = None
    adaptive_active = False

    if needs_recalibration:
        # 14日以上の連続欠損 or 記録なし: 動的モデルをリセットしデフォルトTDEEへ復帰
        final_tdee = DEFAULT_TDEE_FALLBACK
    elif is_estimated_mode:
        # 4〜13日の連続欠損: 動的TDEE更新を一時停止し静的TDEEへ切替
        final_tdee = static_tdee
    elif valid_days_count >= ADAPTIVE_MIN_VALID_DAYS and len(weight_records_in_window) >= 2:
        avg_cal_in      = sum(daily_cal_totals.values()) / valid_days_count
        delta_weight_kg = weight_records_in_window[-1].weight_kg - weight_records_in_window[0].weight_kg
        calculated_tdee = calc_calculated_tdee(avg_cal_in, delta_weight_kg, ADAPTIVE_WINDOW_DAYS)
        final_tdee      = blend_final_tdee(calculated_tdee, static_tdee)
        adaptive_active = True
    else:
        final_tdee = static_tdee

    pace_pct = current_user.pace_pct or DEFAULT_PACE_PCT
    target_deficit = calc_target_deficit(current_user.weight_kg, pace_pct)

    base_target_calories = final_tdee - target_deficit

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
        "static_tdee":             round(static_tdee),
        "avg_cal_in_14d":          round(avg_cal_in) if avg_cal_in is not None else None,
        "delta_weight_kg_14d":     round(delta_weight_kg, 2) if delta_weight_kg is not None else None,
        "calculated_tdee":         round(calculated_tdee) if calculated_tdee is not None else None,
        "valid_days_count_14d":    valid_days_count,
        "adaptive_tdee_active":    adaptive_active,
        "consecutive_missing_days": consecutive_missing_days,
        "is_estimated_mode":       is_estimated_mode,
        "needs_recalibration":     needs_recalibration,
        "tdee":                    round(final_tdee),
        "pace_pct":                pace_pct,
        "target_deficit":          round(target_deficit),
        "base_target_calories":    round(base_target_calories),
        "target_calories":         final_target_calories,
        "lbm_kg":                  round(lbm_kg, 1) if lbm_kg is not None else None,
        "ea_value":                round(ea_value, 1) if ea_value is not None else None,
        "ea_guard_active":         ea_guard_active,
        "recommended_pfc":         pfc,
    }
