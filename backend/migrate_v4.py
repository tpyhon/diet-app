# backend/migrate_v4.py
"""
migrate_v4.py
動的TDEE / 減量ペース / EAガード機能用のカラムを users テーブルに追加する。
SQLAlchemy の inspect を使うため SQLite / PostgreSQL(Supabase) 両対応。冪等。
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import inspect, text
from app.database import engine

USERS_COLUMNS = {
    "body_fat_pct": "FLOAT",
    "pace_pct":     "FLOAT",
}


def column_exists(inspector, table: str, column: str) -> bool:
    return column in [c["name"] for c in inspector.get_columns(table)]


def run():
    print("=== migrate_v4: 動的TDEE用カラム追加 ===")
    inspector = inspect(engine)
    with engine.connect() as conn:
        for col, col_type in USERS_COLUMNS.items():
            if not column_exists(inspector, "users", col):
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
                conn.commit()
                print(f"  ✅ users.{col} を追加しました")
            else:
                print(f"  ⏭️  users.{col} は既に存在します（スキップ）")
    print("\n✨ migrate_v4 完了！")


if __name__ == "__main__":
    run()
