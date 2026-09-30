# Diet App Deployment Guide - Render

このガイドは、Diet AppをRender.comでインターネット公開する手順を説明します。

## 📋 前提条件

- GitHub アカウント（リポジトリ推送用）
- Render.com アカウント
- Google Gemini API キー
- Python 3.11+

## 🚀 デプロイ手順

### ステップ1: Render アカウント設定

1. [Render.com](https://render.com) にサインアップ
2. GitHub を接続（Settings → Connected accounts）
3. リポジトリへのアクセスを許可

### ステップ2: PostgreSQL インスタンス作成

1. **Dashboard → New+ → PostgreSQL**
2. 以下を設定:
   - **Name**: diet-app-postgres
   - **Plan**: Free (開発用)
   - **Region**: Ohio (米国東部)
3. 作成完了後、接続文字列をコピー
   - 例: `postgresql://user:password@host:5432/dbname`

### ステップ3: Render でサービス作成

render.yaml ファイルが既に存在するため、以下の手順で自動デプロイが可能です:

**オプションA: GitHub 統合（推奨）**
1. Dashboard → New+ → Web Service
2. GitHub リポジトリを選択
3. 以下を設定:
   - **Root Directory**: `/` (プロジェクトルート)
   - **Build Command**: `pip install -r backend/requirements.txt && npm --prefix frontend install && npm --prefix frontend run build`
   - **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. **Environment** タブで以下を設定:

### ステップ4: 環境変数設定

Render Dashboard → Services → diet-app-backend → Environment で以下を設定:

```
DATABASE_URL = postgresql://user:password@host:5432/dbname
GEMINI_API_KEY = <YOUR_GEMINI_API_KEY>
SECRET_KEY = <生成新的 キー: python3 -c "import secrets; print(secrets.token_urlsafe(32))">
GEMINI_MODEL_NAME = gemini-1.5-flash
PYTHON_VERSION = 3.11.9
CORS_ORIGINS = https://diet-app-frontend.onrender.com,http://localhost:3000
```

**SECRET_KEY 生成方法:**
```bash
cd backend
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### ステップ5: データベース移行（初回のみ）

SQLite から PostgreSQL へのデータ移行:

```bash
# 1. 環境変数を設定
export DATABASE_URL="postgresql://user:password@host:5432/dbname"

# 2. テーブルを作成
cd backend
python3 -c "from app.database import Base, engine; Base.metadata.create_all(bind=engine)"

# 3. 既存データがあれば移行スクリプトで転送
# (必要に応じて実装)
```

### ステップ6: Frontend デプロイ

**オプションA: Render Static Site**
1. Dashboard → New+ → Static Site
2. GitHub リポジトリを選択
3. 以下を設定:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. **Environment** に VITE_API_URL を設定:
   ```
   VITE_API_URL = https://diet-app-backend.onrender.com
   ```

## 🔧 設定ファイル

### render.yaml
プロジェクトルートの `render.yaml` に全サービス定義があります。
自動デプロイを有効にする場合はこのファイルを使用してください。

### backend/main.py
CORS 設定は環境変数から自動的に読み込まれます:
```python
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
```

### frontend/src/config.ts
API エンドポイントは環境別に自動選択されます:
```typescript
const API_BASE_URL = import.meta.env.MODE === 'production'
  ? import.meta.env.VITE_API_URL || 'https://diet-app-backend.onrender.com'
  : 'http://localhost:8081';
```

## 📡 デプロイ後の確認

1. **Backend**: https://diet-app-backend.onrender.com/docs
2. **Frontend**: https://diet-app-frontend.onrender.com
3. **ログ確認**: Render Dashboard → Services → Logs

## ⚠️ トラブルシューティング

### "CORS policy" エラー
- CORS_ORIGINS 環境変数を確認
- Frontend URL が含まれているか確認

### "could not translate host name to address"
- DATABASE_URL が正しいか確認
- PostgreSQL インスタンスが起動しているか確認

### 白い画面（Frontend が読み込まれない）
- Network tab で API エンドポイントを確認
- VITE_API_URL が正しく設定されているか確認

### Build エラー
- Backend の requirements.txt を確認
- Frontend の package.json を確認
- Node.js バージョン（18+）を確認

## 🔐 セキュリティチェック

- [ ] `.env` ファイルが `.gitignore` に含まれている
- [ ] GEMINI_API_KEY が環境変数に移行されている
- [ ] SECRET_KEY が新たに生成されている
- [ ] CORS_ORIGINS が適切に設定されている
- [ ] HTTPS が有効（Render は自動）
- [ ] データベースバックアップ設定確認

## 📚 参考資料

- [Render ドキュメント](https://render.com/docs)
- [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/)
- [Vite 環境変数](https://vitejs.dev/guide/env-and-modes.html)

## 🆘 サポート

問題が発生した場合:
1. Render Dashboard → Services → Logs でエラーを確認
2. GitHub で最新コミットを確認
3. 環境変数が正しく設定されているか確認
