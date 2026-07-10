import os
import sys
from sqlalchemy import create_engine, inspect
from sqlalchemy.sql import text

# AppのモデルとBaseをインポートしてmetadataにテーブル情報をロードします
from app.database import Base
from app.models import user, meal, walking, training, weight

def migrate_data(sqlite_url, pg_url):
    print("データベースエンジンの初期化中...")
    sqlite_engine = create_engine(sqlite_url)
    
    # SQLAlchemyは postgres:// ではなく postgresql:// を要求するため修正
    if pg_url.startswith("postgres://"):
        pg_url = pg_url.replace("postgres://", "postgresql://", 1)
        
    pg_engine = create_engine(pg_url)
    
    # 1. PostgreSQL (Supabase) 側にテーブルを自動作成
    print("PostgreSQL (Supabase) 上にテーブルを作成中（存在しない場合のみ）...")
    Base.metadata.create_all(bind=pg_engine)
    
    # 2. 接続確立
    sqlite_conn = sqlite_engine.connect()
    pg_conn = pg_engine.connect()
    
    try:
        # 外部キー依存関係を考慮してテーブルをソート（親テーブルが先にくる）
        sorted_tables = Base.metadata.sorted_tables
        
        for table in sorted_tables:
            table_name = table.name
            print(f"\n--- テーブル移行: '{table_name}' ---")
            
            # SQLiteから全件読み出し
            select_stmt = table.select()
            rows = sqlite_conn.execute(select_stmt).fetchall()
            
            if not rows:
                print(f"SQLiteのテーブル '{table_name}' は空です。スキップします。")
                continue
                
            print(f"SQLiteから {len(rows)} 件のレコードを取得しました。Supabaseにコピーします...")
            
            # SQLAlchemy RowオブジェクトをDictにマッピング
            row_dicts = [dict(row._mapping) for row in rows]
            
            # 重複エラーを防ぐため、再実行時は対象のテーブルデータをクリア (CASCADEで子テーブルも考慮)
            pg_conn.execute(text(f"TRUNCATE TABLE {table_name} CASCADE"))
            pg_conn.commit()
            
            # PostgreSQLにインサート
            insert_stmt = table.insert()
            pg_conn.execute(insert_stmt, row_dicts)
            pg_conn.commit()
            
            print(f"テーブル '{table_name}' の移行が完了しました（{len(row_dicts)} 件）。")
            
            # 3. PostgreSQLのシーケンス（自動増分ID）のカウンターを最新の最大値に更新する
            # これをやらないと、移行後に新規登録したデータが「ID重複エラー」で書き込めなくなります
            inspector = inspect(pg_engine)
            pk_constraint = inspector.get_pk_constraint(table_name)
            pk_cols = pk_constraint.get('constrained_columns', [])
            
            if pk_cols and len(pk_cols) == 1:
                pk_col = pk_cols[0]
                # 列の型を判定し、Integerである場合のみシーケンスを更新
                col_info = next((col for col in inspector.get_columns(table_name) if col['name'] == pk_col), None)
                if col_info and "INTEGER" in str(col_info['type']).upper():
                    print(f"自動増分シリアルシーケンス '{table_name}_{pk_col}_seq' を更新中...")
                    # 最大IDを取得してシーケンスを更新
                    reset_seq_query = text(f"""
                        SELECT setval(
                            pg_get_serial_sequence('{table_name}', '{pk_col}'), 
                            coalesce(max({pk_col}), 1)
                        ) FROM {table_name};
                    """)
                    pg_conn.execute(reset_seq_query)
                    pg_conn.commit()
        
        print("\n[SUCCESS] Data migration completed successfully!")
        
    except Exception as e:
        print(f"\n[ERROR] Migration failed with error: {e}")
        raise e
    finally:
        sqlite_conn.close()
        pg_conn.close()
        sqlite_engine.dispose()
        pg_engine.dispose()

if __name__ == '__main__':
    # バックアップされたSQLiteファイルのパスを取得
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backup_db_path = os.path.join(script_dir, 'diet_app_backup.db')
    
    if not os.path.exists(backup_db_path):
        print(f"エラー: バックアップファイルが見つかりません: {backup_db_path}")
        print("先に backup_db.py を実行してバックアップを作成してください。")
        sys.exit(1)
        
    sqlite_url = f"sqlite:///{backup_db_path}"
    
    # コマンドライン引数または環境変数から接続URIを取得
    pg_url = os.getenv("SUPABASE_DATABASE_URL")
    
    if not pg_url and len(sys.argv) > 1:
        pg_url = sys.argv[1]
        
    if not pg_url:
        print("使い方:")
        print("python migrate_sqlite_to_pg.py <Supabase接続URI>")
        print("または、環境変数 SUPABASE_DATABASE_URL を設定して実行してください。")
        sys.exit(1)
        
    migrate_data(sqlite_url, pg_url)
