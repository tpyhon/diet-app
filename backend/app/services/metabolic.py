# backend/app/services/metabolic.py
"""
代謝適応（Metabolic Adaptation）自動検知と、Gemma AIへ渡す動的コンテキスト生成。

検知は「体重計で実測したBMR」を直接持たないため、過去の摂取カロリー・体重変化・
運動消費から逆算した Calculated_TDEE（calc_calculated_tdee）を運動消費とPALで
正規化した値を「実測BMR」の代理指標として扱う。
「7日以上継続」の判定は、日次スナップショットを保存する仕組みが無いため、
直近7日間ウィンドウでの集計値が条件を満たすかどうかで簡易的に代替する。
"""
from datetime import timedelta, datetime, time
from typing import Optional
from sqlalchemy.orm import Session
from app.models.meal import Meal
from app.models.walking import WalkingSession
from app.models.training import TrainingLog
from app.models.weight import WeightRecord
from app.models.user import User
from app.utils import today_jst
from app.services.calorie_engine import (
    ADAPTIVE_WINDOW_DAYS,
    ADAPTIVE_MIN_VALID_DAYS,
    calc_calculated_tdee,
    estimate_training_calories,
)

ADAPTATION_RECENT_WINDOW_DAYS     = 7     # 条件A・BMR傾向判定に使う直近ウィンドウ(日)
ADAPTATION_MIN_VALID_DAYS_7       = 4     # 7日ウィンドウで測定BMRを算出するのに必要な最低有効日数

CUNNINGHAM_BMR_BASE               = 500   # Cunningham式 定数項(kcal)
CUNNINGHAM_BMR_COEF               = 22    # Cunningham式 LBM係数(kcal/kg)
BMR_DEVIATION_ALERT_PCT           = 5     # 予測BMRに対しこの%以上実測BMRが低ければ条件A成立

DEFICIT_STALL_MIN_KCAL            = 300   # 条件B: 14日間平均赤字がこれ以上
DEFICIT_STALL_MAX_WEEKLY_LOSS_PCT = 0.1   # 条件B: 週あたり体重減少率がこれ未満


def calc_cunningham_bmr(lbm_kg: float) -> float:
    """Cunningham式による予測BMR。 BMR = 500 + 22 × LBM"""
    return CUNNINGHAM_BMR_BASE + CUNNINGHAM_BMR_COEF * lbm_kg


def calc_measured_bmr(avg_cal_in: float, delta_weight_kg: float, avg_exercise_kcal: float,
                       pal: float, window_days: int) -> float:
    """実測データから逆算したTDEEを運動消費とPALで正規化し、BMR相当の値に戻す。"""
    calculated_tdee = calc_calculated_tdee(avg_cal_in, delta_weight_kg, window_days)
    if not pal:
        return calculated_tdee - avg_exercise_kcal
    return (calculated_tdee - avg_exercise_kcal) / pal


def _avg_in_date_range(daily_totals: dict, start_date, end_date, min_valid_days: int) -> Optional[float]:
    days = {d: v for d, v in daily_totals.items() if start_date <= d <= end_date}
    if len(days) < min_valid_days:
        return None
    return sum(days.values()) / len(days)


def _sum_all_days_in_range(daily_totals: dict, start_date, end_date):
    n = (end_date - start_date).days + 1
    total = sum(daily_totals.get(start_date + timedelta(days=i), 0.0) for i in range(n))
    return total, n


def _delta_weight_in_range(weight_points: list, start_date, end_date) -> Optional[float]:
    pts = sorted((d, w) for d, w in weight_points if start_date <= d <= end_date)
    if len(pts) < 2:
        return None
    return pts[-1][1] - pts[0][1]


def gather_window_data(db: Session, user: User, window_days: int = ADAPTIVE_WINDOW_DAYS):
    """過去window_days日分の日別摂取カロリー・日別運動消費カロリー・体重記録を集計する。"""
    today = today_jst()
    window_start_date = today - timedelta(days=window_days - 1)
    window_start_dt = datetime.combine(window_start_date, time.min)

    meals = db.query(Meal).filter(Meal.user_id == user.id, Meal.date >= window_start_dt).all()
    daily_cal_totals: dict = {}
    for m in meals:
        d = m.date.date()
        daily_cal_totals[d] = daily_cal_totals.get(d, 0.0) + (m.estimated_calories or 0.0)

    walks = db.query(WalkingSession).filter(
        WalkingSession.user_id == user.id, WalkingSession.start_time >= window_start_dt
    ).all()
    trains = db.query(TrainingLog).filter(
        TrainingLog.user_id == user.id, TrainingLog.date >= window_start_dt
    ).all()
    daily_exercise_totals: dict = {}
    for w in walks:
        d = w.start_time.date()
        daily_exercise_totals[d] = daily_exercise_totals.get(d, 0.0) + (w.estimated_calories or 0.0)
    for t in trains:
        d = t.date.date()
        daily_exercise_totals[d] = daily_exercise_totals.get(d, 0.0) + estimate_training_calories(
            t.duration_minutes, user.weight_kg
        )

    weights = db.query(WeightRecord).filter(
        WeightRecord.user_id == user.id, WeightRecord.date >= window_start_dt
    ).all()
    weight_points = [(w.date.date(), w.weight_kg) for w in weights]

    return today, daily_cal_totals, daily_exercise_totals, weight_points


def calc_metabolic_adaptation_status(
    *,
    today,
    daily_cal_totals: dict,
    daily_exercise_totals: dict,
    weight_points: list,
    weight_kg: Optional[float],
    pal: float,
    static_tdee: Optional[float],
    lbm_kg: Optional[float],
) -> dict:
    """
    METABOLIC_ADAPTATION_ALERT の検知。
        条件A: 直近7日間の実測BMRが予測BMR(Cunningham式)より5%以上低い
        条件B: 過去14日間の平均赤字が300kcal/日以上あるのに週0.1%未満の減量率、
               かつ実測BMRが直近7日で前の7日より低下している
    """
    window14_start = today - timedelta(days=ADAPTIVE_WINDOW_DAYS - 1)
    window7r_start = today - timedelta(days=ADAPTATION_RECENT_WINDOW_DAYS - 1)
    window7p_start = window14_start
    window7p_end   = today - timedelta(days=ADAPTATION_RECENT_WINDOW_DAYS)

    avg_cal_in_14 = _avg_in_date_range(daily_cal_totals, window14_start, today, ADAPTIVE_MIN_VALID_DAYS)
    delta_weight_14 = _delta_weight_in_range(weight_points, window14_start, today)

    avg_deficit_14 = (static_tdee - avg_cal_in_14) if (static_tdee is not None and avg_cal_in_14 is not None) else None

    avg_cal_in_recent_7 = _avg_in_date_range(daily_cal_totals, window7r_start, today, ADAPTATION_MIN_VALID_DAYS_7)
    avg_deficit_recent_7 = (
        (static_tdee - avg_cal_in_recent_7) if (static_tdee is not None and avg_cal_in_recent_7 is not None) else None
    )

    weekly_loss_pct = None
    if delta_weight_14 is not None and weight_kg:
        weekly_loss_pct = (-delta_weight_14 / weight_kg / (ADAPTIVE_WINDOW_DAYS / 7)) * 100

    predicted_bmr = calc_cunningham_bmr(lbm_kg) if lbm_kg else None

    def _measured_bmr_for(start_date, end_date):
        avg_cal = _avg_in_date_range(daily_cal_totals, start_date, end_date, ADAPTATION_MIN_VALID_DAYS_7)
        delta_w = _delta_weight_in_range(weight_points, start_date, end_date)
        if avg_cal is None or delta_w is None:
            return None
        exercise_total, n_days = _sum_all_days_in_range(daily_exercise_totals, start_date, end_date)
        avg_exercise = exercise_total / n_days
        return calc_measured_bmr(avg_cal, delta_w, avg_exercise, pal, n_days)

    measured_bmr_recent = _measured_bmr_for(window7r_start, today)
    measured_bmr_prior  = _measured_bmr_for(window7p_start, window7p_end)

    condition_a = (
        predicted_bmr is not None and measured_bmr_recent is not None
        and measured_bmr_recent <= predicted_bmr * (1 - BMR_DEVIATION_ALERT_PCT / 100)
    )
    condition_b = (
        avg_deficit_14 is not None and avg_deficit_14 >= DEFICIT_STALL_MIN_KCAL
        and weekly_loss_pct is not None and weekly_loss_pct < DEFICIT_STALL_MAX_WEEKLY_LOSS_PCT
        and measured_bmr_recent is not None and measured_bmr_prior is not None
        and measured_bmr_recent < measured_bmr_prior
    )

    has_alert = condition_a or condition_b
    return {
        "has_alert":   has_alert,
        "alert_type":  "METABOLIC_ADAPTATION" if has_alert else None,
        "title":       "代謝適応（省エネモード）を検知しました" if has_alert else None,
        "message":     "カロリー制限に対し体が適応し、基礎代謝が低下しています。努力不足ではありません。" if has_alert else None,
        "condition_a_bmr_deviation": condition_a,
        "condition_b_deficit_stall": condition_b,
        "predicted_bmr":             round(predicted_bmr) if predicted_bmr is not None else None,
        "measured_bmr_recent_7d":    round(measured_bmr_recent) if measured_bmr_recent is not None else None,
        "measured_bmr_prior_7d":     round(measured_bmr_prior) if measured_bmr_prior is not None else None,
        "avg_deficit_14d":           round(avg_deficit_14) if avg_deficit_14 is not None else None,
        "avg_deficit_recent_7d":     round(avg_deficit_recent_7) if avg_deficit_recent_7 is not None else None,
        "weekly_loss_pct":           round(weekly_loss_pct, 2) if weekly_loss_pct is not None else None,
    }


def get_metabolic_alert(db: Session, user: User, pal: float,
                         static_tdee: Optional[float], lbm_kg: Optional[float]) -> dict:
    """DBから直近14日分のデータを集計し、代謝適応ステータスを算出する。"""
    today, daily_cal_totals, daily_exercise_totals, weight_points = gather_window_data(db, user)
    return calc_metabolic_adaptation_status(
        today=today,
        daily_cal_totals=daily_cal_totals,
        daily_exercise_totals=daily_exercise_totals,
        weight_points=weight_points,
        weight_kg=user.weight_kg,
        pal=pal,
        static_tdee=static_tdee,
        lbm_kg=lbm_kg,
    )


def format_weight_trend(weight_points: list, today, window_days: int = ADAPTATION_RECENT_WINDOW_DAYS) -> str:
    """過去window_days日間の体重推移を「MM/DD:xx.xkg → ...」形式の文字列にする。"""
    start = today - timedelta(days=window_days - 1)
    pts = sorted((d, w) for d, w in weight_points if start <= d <= today)
    if not pts:
        return "記録なし"
    return " → ".join(f"{d.strftime('%m/%d')}:{w}kg" for d, w in pts)


def format_measured_bmr_trend(status: dict) -> str:
    """実測BMRの推移（前の7日間 → 直近7日間）を文字列にする。"""
    prior  = status.get("measured_bmr_prior_7d")
    recent = status.get("measured_bmr_recent_7d")
    if prior is None and recent is None:
        return "データ不足のため算出不可"
    prior_str  = f"{prior}kcal" if prior is not None else "不明"
    recent_str = f"{recent}kcal" if recent is not None else "不明"
    return f"{prior_str}（8〜14日前） → {recent_str}（直近7日間）"


def build_metabolic_system_context(status: dict, weight_trend: str, bmr_trend: str) -> str:
    """
    AIアドバイスリクエスト時にシステムプロンプトへ注入する、代謝適応チェック用の
    動的コンテキストを生成する。

    注入データ: 体重推移 / 実測BMR推移 / 平均エネルギー赤字量 / 代謝適応フラグ(bool)
    """
    deficit = status.get("avg_deficit_recent_7d")
    deficit_str = f"{deficit}kcal/日" if deficit is not None else "データ不足のため算出不可"
    flag_str = "true（検知あり）" if status.get("has_alert") else "false（検知なし）"

    return "\n".join([
        "【代謝適応チェック用データ（過去7日間）】",
        f"- 体重推移: {weight_trend}",
        f"- 実測BMR推移: {bmr_trend}",
        f"- 平均エネルギー赤字量: {deficit_str}",
        f"- 代謝適応フラグ: {flag_str}",
        "",
        "【ルール】",
        "代謝適応フラグがtrueの場合は、過度なカロリー制限を戒め、"
        "1〜2日間のリフィード（ハイカーボデイ）または1〜2週間のダイエットブレイクを、"
        "学術的な理由（レプチン分泌の低下・適応性熱産生の増加など）とともに提案すること。",
    ])
