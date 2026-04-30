from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.database import get_db
from app.models.meal import Meal
from app.models.walking import WalkingSession
from app.models.training import TrainingLog
from app.models.weight import WeightRecord
from google import genai
import os

router = APIRouter(prefix="/api/ai", tags=["ai"])
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

@router.get("/advice")
async def get_ai_advice(db: Session = Depends(get_db)):
    """過去7日間のデータを集計しGeminiにアドバイスを求める"""
    since = datetime.now() - timedelta(days=7)

    # 食事データ集計
    meals = db.query(Meal).filter(Meal.date >= since).all()
    avg_calories = sum(m.estimated_calories for m in meals) / 7 if meals else 0

    # ウォーキングデータ集計
    walks = db.query(WalkingSession).filter(WalkingSession.start_time >= since).all()
    total_walk_km = sum(w.distance_km or 0 for w in walks)
    total_walk_cal = sum(w.estimated_calories or 0 for w in walks)

    # 筋トレデータ集計
    trainings = db.query(TrainingLog).filter(TrainingLog.date >= since).all()
    training_count = len(trainings)

    # 体重推移
    weights = db.query(WeightRecord).filter(
        WeightRecord.date >= since
    ).order_by(WeightRecord.date.asc()).all()
    weight_start = weights[0].weight_kg if weights else None
    weight_end = weights[-1].weight_kg if weights else None

    prompt = f"""
あなたは優秀なダイエットコーチです。以下のユーザーの過去7日間のデータを分析し、
日本語で具体的なアドバイスと激励メッセージを提供してください。

【過去7日間のデータ】
・平均摂取カロリー: {avg_calories:.0f} kcal/日
・ウォーキング合計距離: {total_walk_km:.1f} km
・ウォーキング消費カロリー合計: {total_walk_cal:.0f} kcal
・筋トレ実施回数: {training_count} 回
・体重変化: {weight_start} kg → {weight_end} kg

【出力フォーマット】
1. 今週の総評（2〜3文）
2. 食事面のアドバイス（具体的に）
3. 運動面のアドバイス（具体的に）
4. 来週に向けての目標提案（1〜2つ）
5. 激励メッセージ（熱く、親しみやすく）
"""

    response = client.models.generate_content(
        model="gemma-3-27b-it",
        contents=prompt
    )
    return {"advice": response.text, "data_summary": {
        "avg_daily_calories": round(avg_calories, 1),
        "total_walk_km": round(total_walk_km, 2),
        "total_walk_calories": round(total_walk_cal, 1),
        "training_sessions": training_count,
        "weight_start": weight_start,
        "weight_end": weight_end,
    }}
