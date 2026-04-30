from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app.models.meal import Meal
from app.models.walking import WalkingSession
from app.models.training import TrainingLog, TrainingPlan
from app.models.weight import WeightRecord
from google import genai
from google.genai import types
import os, json

router = APIRouter(prefix="/api/ai", tags=["ai"])

# ── 既存の /advice エンドポイント（変更なし）──────────────
@router.get("/advice")
async def get_advice(db: Session = Depends(get_db)):
    since = datetime.now() - timedelta(days=7)

    meals = db.query(Meal).filter(Meal.date >= since).all()
    avg_cal = sum(m.estimated_calories or 0 for m in meals) / 7

    walks = db.query(WalkingSession).filter(WalkingSession.start_time >= since).all()
    walk_km  = sum(w.distance_km or 0 for w in walks)
    walk_cal = sum(w.estimated_calories or 0 for w in walks)
    walk_cnt = len(walks)

    trains = db.query(TrainingLog).filter(TrainingLog.date >= since).all()
    train_cnt = len(trains)

    weights = db.query(WeightRecord).filter(
        WeightRecord.date >= since
    ).order_by(WeightRecord.date.asc()).all()
    w_start = weights[0].weight_kg if weights else None
    w_end   = weights[-1].weight_kg if weights else None

    prompt = f"""
あなたは経験豊富なパーソナルトレーナー兼栄養士です。
以下のユーザーの過去7日間のデータを分析し、日本語で具体的なアドバイスを提供してください。

【過去7日間のデータ】
- 1日平均摂取カロリー: {avg_cal:.0f} kcal
- ウォーキング回数: {walk_cnt}回 / 合計 {walk_km:.1f}km / 消費 {walk_cal:.0f}kcal
- 筋トレ実施回数: {train_cnt}回
- 体重変化: {w_start}kg → {w_end}kg

【出力形式】
■ 今週の総評
■ 食事アドバイス
■ 運動アドバイス
■ 来週の目標（具体的に2つ）
■ 激励メッセージ
"""
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    response = client.models.generate_content(
        model="gemma-4-26b-a4b-it",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction="あなたは親しみやすく熱心なダイエットコーチです。"
        )
    )
    return {
        "advice": response.text,
        "summary": {
            "avg_daily_calories": round(avg_cal, 1),
            "walk_km": round(walk_km, 2),
            "walk_calories": round(walk_cal, 1),
            "walk_count": walk_cnt,
            "training_count": train_cnt,
            "weight_start": w_start,
            "weight_end": w_end,
        }
    }


# ── 新規：AIトレーニングプラン生成 ────────────────────────
from pydantic import BaseModel
from typing import Optional

class AiPlanRequest(BaseModel):
    fitness_level: str        # beginner / intermediate / advanced
    goal: str                 # diet / muscle / health
    available_days: int       # 週何日できるか (1-7)
    target_parts: list[str]   # ["arms","chest","abs","back","legs"] から選択
    equipment: str            # none / dumbbell / gym
    minutes_per_session: int  # 1回あたりの時間（分）
    notes: Optional[str] = None  # 自由記述（怪我・苦手など）

@router.post("/generate-plan")
async def generate_training_plan(
    req: AiPlanRequest,
    db: Session = Depends(get_db)
):
    """Gemmaがユーザー情報からトレーニングプランを生成しDBに保存する"""

    level_map = {"beginner": "初心者", "intermediate": "中級者", "advanced": "上級者"}
    goal_map  = {"diet": "ダイエット・脂肪燃焼", "muscle": "筋肥大・筋力向上", "health": "健康維持・体力向上"}
    equip_map = {"none": "自重のみ（器具なし）", "dumbbell": "ダンベルあり", "gym": "ジム（全器具使用可）"}
    parts_map = {"arms": "腕", "chest": "胸", "abs": "腹筋", "back": "背筋", "legs": "脚"}

    target_str = "・".join([parts_map.get(p, p) for p in req.target_parts])

    prompt = f"""
あなたは優秀なパーソナルトレーナーです。
以下のユーザー情報に基づいて、最適なトレーニングプランを作成してください。

【ユーザー情報】
- フィットネスレベル: {level_map.get(req.fitness_level, req.fitness_level)}
- 目標: {goal_map.get(req.goal, req.goal)}
- 週のトレーニング可能日数: {req.available_days}日
- 鍛えたい部位: {target_str}
- 使用可能な器具: {equip_map.get(req.equipment, req.equipment)}
- 1回あたりの時間: {req.minutes_per_session}分
- 備考・制約: {req.notes or "特になし"}

【出力形式】
必ず以下のJSON形式のみで返してください。説明文・マークダウン・コードブロックは不要です。
JSONのみを返してください。

{{
  "plans": [
    {{
      "name": "プラン名（例：胸トレA）",
      "body_part": "chest",
      "day_of_week": 0,
      "exercises": [
        {{
          "name": "種目名",
          "sets": 3,
          "reps": 10,
          "weight_kg": null
        }}
      ]
    }}
  ],
  "comment": "プラン全体についての一言コメント（日本語・2〜3文）"
}}

【ルール】
- body_part は arms / chest / abs / back / legs のいずれか
- day_of_week は 0=月曜〜6=日曜
- weight_kg は自重種目の場合 null
- 週{req.available_days}日分のプランを作成する
- 1回{req.minutes_per_session}分に収まる種目数にする
- {level_map.get(req.fitness_level)}向けの適切な負荷にする
"""

    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    response = client.models.generate_content(
        model="gemma-4-26b-a4b-it",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction="あなたはトレーニングの専門家です。必ずJSONのみを返してください。"
        )
    )

    # JSONパース（余分なテキストを除去）
    raw = response.text.strip()
    # コードブロックが含まれる場合に除去
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # JSON部分だけ抽出を試みる
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        if start != -1 and end > start:
            data = json.loads(raw[start:end])
        else:
            return {"error": "AIの応答をパースできませんでした", "raw": raw}

    # DBに保存
    saved_plans = []
    for plan_data in data.get("plans", []):
        db_plan = TrainingPlan(
            name=plan_data.get("name", "AIプラン"),
            body_part=plan_data.get("body_part", "chest"),
            exercises_json=json.dumps(
                plan_data.get("exercises", []),
                ensure_ascii=False
            ),
            day_of_week=plan_data.get("day_of_week"),
        )
        db.add(db_plan)
        saved_plans.append(plan_data)

    db.commit()

    return {
        "saved_count": len(saved_plans),
        "plans": saved_plans,
        "comment": data.get("comment", ""),
    }
