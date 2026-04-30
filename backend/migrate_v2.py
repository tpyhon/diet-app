"""
migrate_v2.py
既存DBに栄養素カラム・ユーザープロフィールカラムを追加する。
既にカラムが存在する場合はスキップ（冪等）。
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "diet_app.db")


def column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def add_column_if_not_exists(cursor, table: str, column: str, col_type: str):
    if not column_exists(cursor, table, column):
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        print(f"  Added: {table}.{column}")
    else:
        print(f"  Skip (exists): {table}.{column}")


def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("=== migrate_v2: 栄養素 & プロフィールカラム追加 ===")

    # meals テーブルに栄養素カラム追加
    print("\n[meals]")
    add_column_if_not_exists(cur, "meals", "protein_g", "REAL")
    add_column_if_not_exists(cur, "meals", "fat_g", "REAL")
    add_column_if_not_exists(cur, "meals", "carbs_g", "REAL")

    # users テーブルにプロフィール・カロリー目標カラム追加
    print("\n[users]")
    add_column_if_not_exists(cur, "users", "age", "INTEGER")
    add_column_if_not_exists(cur, "users", "gender", "TEXT")
    add_column_if_not_exists(cur, "users", "height_cm", "REAL")
    add_column_if_not_exists(cur, "users", "current_weight_kg", "REAL")
    add_column_if_not_exists(cur, "users", "activity_level", "TEXT")
    add_column_if_not_exists(cur, "users", "goal", "TEXT")
    add_column_if_not_exists(cur, "users", "calorie_goal", "INTEGER DEFAULT 2000")

    conn.commit()
    conn.close()
    print("\n=== 完了 ===")


if __name__ == "__main__":
    run()
