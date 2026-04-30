from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.database import Base, engine
from app.routers import meals, walking, training, weight, ai_advice
from app.models import meal as meal_model          # エイリアスで区別
from app.models import walking as walking_model    # エイリアスで区別
from app.models import training as training_model  # エイリアスで区別
from app.models import weight as weight_model      # エイリアスで区別

load_dotenv()

# テーブル自動作成
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Diet App API", version="1.0.0")

# CORS設定（React開発サーバーとTailscale経由のアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meals.router)
app.include_router(walking.router)
app.include_router(training.router)
app.include_router(weight.router)
app.include_router(ai_advice.router)

@app.get("/")
def root():
    return {"status": "ok", "message": "Diet App API is running!"}
