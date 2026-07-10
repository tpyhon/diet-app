import sqlite3
import os
import shutil

def backup_sqlite_db(source_path='diet_app.db', dest_path='diet_app_backup.db'):
    if not os.path.exists(source_path):
        print(f"Source database file '{source_path}' does not exist: {source_path}")
        return False
    
    print(f"Starting online backup of '{source_path}' to '{dest_path}'...")
    try:
        # SQLiteオンラインバックアップAPIを使用して、稼働中のDBを安全にコピーします
        src_conn = sqlite3.connect(source_path)
        dest_conn = sqlite3.connect(dest_path)
        
        with dest_conn:
            src_conn.backup(dest_conn)
            
        src_conn.close()
        dest_conn.close()
        print(f"Backup completed successfully! Saved to: {dest_path}")
        return True
    except Exception as e:
        print(f"Error occurred during backup: {e}")
        try:
            print("Attempting file copy as fallback...")
            shutil.copy2(source_path, dest_path)
            print("Fallback file copy completed.")
            return True
        except Exception as copy_err:
            print(f"Fallback copy failed: {copy_err}")
            return False

if __name__ == '__main__':
    # スクリプトのカレントディレクトリを基準にパスを設定
    script_dir = os.path.dirname(os.path.abspath(__file__))
    source = os.path.join(script_dir, 'diet_app.db')
    dest = os.path.join(script_dir, 'diet_app_backup.db')
    backup_sqlite_db(source, dest)
