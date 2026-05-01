# backend/migrate.py
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "diet_app.db")

def column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    # ── users テーブルへのカラム追加 ──────────────────────────
    users_columns = {
        "age":            "INTEGER",
        "gender":         "VARCHAR(10)",
        "height_cm":      "FLOAT",
        "weight_kg":      "FLOAT",
        "activity_level": "VARCHAR(20)",
        "diet_goal":      "VARCHAR(20)",
        "calorie_goal":   "INTEGER",
    }
    for col, col_type in users_columns.items():
        if not column_exists(cur, "users", col):
            cur.execute(f"ALTER TABLE users ADD COLUMN {col} {col_type}")
            print(f"  ✅ users.{col} を追加しました")
        else:
            print(f"  ⏭️  users.{col} は既に存在します（スキップ）")

    # ── meals テーブルへのカラム追加 ──────────────────────────
    meals_columns = {
        "protein_g": "FLOAT",
        "fat_g":     "FLOAT",
        "carbs_g":   "FLOAT",
    }
    for col, col_type in meals_columns.items():
        if not column_exists(cur, "meals", col):
            cur.execute(f"ALTER TABLE meals ADD COLUMN {col} {col_type}")
            print(f"  ✅ meals.{col} を追加しました")
        else:
            print(f"  ⏭️  meals.{col} は既に存在します（スキップ）")

    conn.commit()
    conn.close()
    print("\n✨ マイグレーション完了！")

if __name__ == "__main__":
    migrate()
