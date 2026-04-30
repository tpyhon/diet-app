from sqlalchemy import Column, Integer, String, Float
from ..database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    # 個人情報（カロリー目標自動計算用）
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)          # "male" / "female"
    height_cm = Column(Float, nullable=True)
    current_weight_kg = Column(Float, nullable=True)
    activity_level = Column(String, nullable=True)  # "sedentary" / "light" / "moderate" / "active" / "very_active"
    goal = Column(String, nullable=True)            # "lose" / "maintain" / "gain"

    # カロリー目標（手動設定 or AI自動計算結果を保存）
    calorie_goal = Column(Integer, nullable=True, default=2000)
