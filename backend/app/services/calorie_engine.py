# backend/app/services/calorie_engine.py
"""
動的TDEE算出・減量ペース設定・EA(エネルギー可用性)安全ガードの計算ロジック。
"""
from typing import Optional
from app.models.user import User

FAT_KCAL_PER_KG        = 7200   # 体脂肪1kgあたりのエネルギー(kcal)
EA_MIN_KCAL_PER_KG_LBM = 30     # EA安全下限 (kcal / kg LBM)
TARGET_FAT_RATIO       = 0.20   # 目標カロリーに対する脂質比率
PROTEIN_G_PER_KG_LBM   = 2.0    # LBM 1kgあたりのタンパク質量(g)
TRAINING_METS          = 5.0    # 筋トレのカロリー推定に使うMETs（中強度レジスタンス運動）

ACTIVITY_PAL_MAP = {
    "sedentary":  1.2,
    "lightly":    1.375,   # デフォルトPAL（軽度の活動）
    "moderately": 1.55,
    "very":       1.725,
    "super":      1.9,
}
DEFAULT_PAL = ACTIVITY_PAL_MAP["lightly"]

PACE_OPTIONS_PCT = [0.25, 0.5, 0.75, 1.0]   # 週あたり目標減量ペース(%)の選択肢
DEFAULT_PACE_PCT = 0.5

ADAPTIVE_WINDOW_DAYS   = 14    # 実測TDEE算出に使う過去データウィンドウ(日)
ADAPTIVE_MIN_VALID_DAYS = 10   # この日数未満の有効データしか無い場合は静的TDEEにフォールバック
ADAPTIVE_CALC_RATIO    = 0.7   # Final_TDEEにおける実測修正TDEEの重み
ADAPTIVE_STATIC_RATIO  = 0.3   # Final_TDEEにおける静的TDEEの重み


def calc_bmr(user: User) -> Optional[float]:
    """Harris–Benedict式による基礎代謝量(BMR)の算出。"""
    if not all([user.age, user.gender, user.height_cm, user.weight_kg]):
        return None
    w, h, a = user.weight_kg, user.height_cm, user.age
    if user.gender == "male":
        return 88.362 + 13.397 * w + 4.799 * h - 5.677 * a
    return 447.593 + 9.247 * w + 3.098 * h - 4.330 * a


def calc_target_deficit(weight_kg: float, pace_pct: float) -> float:
    """
    週あたり体重減量ペース(%)から日々の目標エネルギー赤字(kcal/日)を算出。
        Target Deficit = (体重 × ペース% × 7200) / 7
    """
    weekly_loss_kg = weight_kg * (pace_pct / 100)
    return weekly_loss_kg * FAT_KCAL_PER_KG / 7


def calc_dynamic_tdee(bmr: float, pal: float, exercise_kcal: float) -> float:
    """
    動的TDEEの算出。
        TDEE = (実測BMR × PAL) + 本日の運動消費カロリー
    """
    return bmr * pal + exercise_kcal


def calc_lbm(weight_kg: float, body_fat_pct: float) -> float:
    """除脂肪体重(LBM)の算出。 LBM = 体重 × (100 - 体脂肪率) / 100"""
    return weight_kg * (100 - body_fat_pct) / 100


def apply_ea_guard(base_target_calories: float, exercise_kcal: float, bmr: float, lbm_kg: float):
    """
    EA（エネルギー可用性）安全ガード。
        EA = (基本目標カロリー - 運動消費カロリー) / LBM
    EA < 30kcal/kgLBM または 基本目標カロリー < BMR に該当する場合、
    目標カロリーを BMR と (30 × LBM + 運動消費カロリー) の高い方に強制固定する。

    戻り値: (最終目標カロリー, ガード発動フラグ, EA値)
    """
    ea = (base_target_calories - exercise_kcal) / lbm_kg if lbm_kg > 0 else 0.0
    guard_needed = ea < EA_MIN_KCAL_PER_KG_LBM or base_target_calories < bmr
    if guard_needed:
        floor_calories = max(bmr, EA_MIN_KCAL_PER_KG_LBM * lbm_kg + exercise_kcal)
        return floor_calories, True, ea
    return base_target_calories, False, ea


def calc_pfc_from_lbm(target_calories: float, lbm_kg: float) -> dict:
    """
    LBMベースのPFC配分。
        P = LBM × 2.0g (4kcal/g)
        F = 目標カロリー × 20% (9kcal/g)
        C = 残りカロリー / 4
    """
    protein_g    = lbm_kg * PROTEIN_G_PER_KG_LBM
    protein_kcal = protein_g * 4
    fat_kcal     = target_calories * TARGET_FAT_RATIO
    fat_g        = fat_kcal / 9
    carbs_kcal   = max(target_calories - (protein_kcal + fat_kcal), 0)
    carbs_g      = carbs_kcal / 4
    total        = protein_kcal + fat_kcal + carbs_kcal
    return {
        "protein_g": round(protein_g),
        "fat_g":     round(fat_g),
        "carbs_g":   round(carbs_g),
        "ratio": {
            "protein_pct": round(protein_kcal / total * 100) if total else 0,
            "fat_pct":     round(fat_kcal     / total * 100) if total else 0,
            "carbs_pct":   round(carbs_kcal   / total * 100) if total else 0,
        },
    }


def calc_calculated_tdee(avg_cal_in: float, delta_weight_kg: float, window_days: int = ADAPTIVE_WINDOW_DAYS) -> float:
    """
    過去Nウィンドウの実測データから逆算した「実測修正TDEE」の算出。
        Energy_Balance   = (ΔWeight × 7200) / window_days
        Calculated_TDEE  = Avg_CalIn - Energy_Balance
    体重が増えた(ΔWeight>0)ならエネルギー余剰があった=摂取から差し引き、
    体重が減った(ΔWeight<0)ならエネルギー赤字があった=摂取に上乗せしてTDEEを推定する。
    """
    energy_balance = (delta_weight_kg * FAT_KCAL_PER_KG) / window_days
    return avg_cal_in - energy_balance


def blend_final_tdee(calculated_tdee: float, static_tdee: float) -> float:
    """
    実測修正TDEEと静的TDEEをEMA的にブレンドし、急激な変動を防ぐ。
        Final_TDEE = (Calculated_TDEE × 0.7) + (静的TDEE × 0.3)
    """
    return calculated_tdee * ADAPTIVE_CALC_RATIO + static_tdee * ADAPTIVE_STATIC_RATIO


def estimate_training_calories(duration_minutes: Optional[float], weight_kg: float) -> float:
    """
    筋トレ(TrainingLog)の消費カロリーを推定する。
    TrainingLogにはカロリー実測値のカラムが無いため、中強度レジスタンス運動の
    METs値を使い、ウォーキングと同じMETs式（walking.pyのwalking_calories）で概算する。
    """
    if not duration_minutes or duration_minutes <= 0:
        return 0.0
    hours = duration_minutes / 60
    return round(TRAINING_METS * weight_kg * hours * 1.05, 1)
