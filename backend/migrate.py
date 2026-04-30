# backend/migrate.py
"""
既存DBを壊さずにマルチユーザー対応へマイグレーションするスクリプト。
実行方法（backendディレクトリで）:
  python migrate.py
"""

import sqlite3
import os
import bcrypt  # passlibを使わず直接呼び出す

DB_PATH = os.path.join(os.path.dirname(__file__), "diet_app.db")

def column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    print(f"DBパス: {DB_PATH}")

    # ── 1. users テーブル作成 ──────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    NOT NULL UNIQUE,
            password_hash TEXT    NOT NULL,
            display_name  TEXT,
            is_active     INTEGER NOT NULL DEFAULT 1,
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("✅ users テーブル: OK")

    # ── 2. デフォルトユーザーを挿入 ───────────────────────
    hashed = bcrypt.hashpw("password123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    cur.execute("SELECT id FROM users WHERE username = 'default_user'")
    row = cur.fetchone()
    if row is None:
        cur.execute(
            "INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)",
            ("default_user", hashed, "デフォルトユーザー")
        )
        default_user_id = cur.lastrowid
        print(f"✅ デフォルトユーザー作成: id={default_user_id}")
    else:
        default_user_id = row[0]
        print(f"ℹ️  デフォルトユーザー既存: id={default_user_id}")

    conn.commit()

    # ── 3. 各テーブルに user_id カラムを追加 ──────────────
    tables = [
        "meals",
        "walking_sessions",
        "training_plans",
        "training_logs",
        "user_game_status",
        "weight_records",
        "weight_goals",
    ]

    for table in tables:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
        if cur.fetchone() is None:
            print(f"⚠️  テーブル未存在（スキップ）: {table}")
            continue

        if not column_exists(cur, table, "user_id"):
            cur.execute(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER REFERENCES users(id)")
            print(f"✅ {table}: user_id カラム追加")
        else:
            print(f"ℹ️  {table}: user_id カラム既存（スキップ）")

    conn.commit()

    # ── 4. 既存データを全てデフォルトユーザーに割り当て ────
    for table in tables:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
        if cur.fetchone() is None:
            continue
        cur.execute(
            f"UPDATE {table} SET user_id = ? WHERE user_id IS NULL",
            (default_user_id,)
        )
        updated = cur.rowcount
        if updated > 0:
            print(f"✅ {table}: {updated} 件を default_user (id={default_user_id}) に割り当て")
        else:
            print(f"ℹ️  {table}: 割り当て対象なし")

    conn.commit()

    # ── 5. user_game_status の重複行を削除 ────────────────
    cur.execute("""
        DELETE FROM user_game_status
        WHERE id NOT IN (
            SELECT MAX(id) FROM user_game_status GROUP BY user_id
        )
    """)
    if cur.rowcount > 0:
        print(f"✅ user_game_status: 重複行を {cur.rowcount} 件削除")

    conn.commit()
    conn.close()

    print("\n🎉 マイグレーション完了！")
    print("   デフォルトユーザーのログイン情報:")
    print("   ユーザー名: default_user")
    print("   パスワード: password123")

if __name__ == "__main__":
    migrate()
