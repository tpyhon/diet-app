# backend/app/utils.py
"""
タイムゾーンユーティリティ
全ルーターはここから now_jst() をインポートして使用する。
SQLAlchemy の func.now() はUTCを返すため、
明示的な datetime 操作にはすべてこの関数を使う。
"""
from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9), name="JST")

def now_jst() -> datetime:
    """現在のJST時刻を返す（タイムゾーン情報なし・naive datetime）。
    SQLiteはtz-naiveで保存するため、naiveのまま返す。
    ただしPC上の `datetime.now()` と違い、
    どの環境でも必ずJST基準になる。
    """
    return datetime.now(tz=timezone.utc).astimezone(JST).replace(tzinfo=None)

def today_jst():
    """今日のJST日付を返す。"""
    return now_jst().date()

def jst_range_today():
    """今日(JST)の 00:00:00 〜 23:59:59 を返す。"""
    today = today_jst()
    start = datetime(today.year, today.month, today.day, 0, 0, 0)
    end   = datetime(today.year, today.month, today.day, 23, 59, 59)
    return start, end
