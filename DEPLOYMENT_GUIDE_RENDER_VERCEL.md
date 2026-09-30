# デプロイガイド：Render + Vercel（正式版）

## 🏗️ アーキテクチャ

```
┌─────────────────────┐
│   Vercel Frontend   │ (React + TypeScript)
│ diet-app-frontend.  │
│ vercel.app          │
└──────────┬──────────┘
           │ /api/* → プロキシ
           ↓
┌─────────────────────┐
│  Render Backend     │ (FastAPI)
│ diet-app-backend.   │
│ onrender.com        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   PostgreSQL        │ (Render)
│  (Production DB)    │
└─────────────────────┘

VPN内：SQLite (ローカル開発)
```

---

## 📋 デプロイ前チェック

### ✅ Backend（Render 準備）
- [ ] `render.yaml` が Backend のみ対応
- [ ] `backend/.env` が `.gitignore` に登録
- [ ] PostgreSQL 依存: `psycopg2-binary` が `requirements.txt` に含まれている
- [ ] CORS_ORIGINS が vercel.app に設定

### ✅ Frontend（Vercel 準備）
- [ ] `vercel.json` が `/api` をプロキシする設定になっている
- [ ] `package.json` に `build` スクリプトがある
- [ ] GitHub にコミット済み

---

## 🚀 デプロイ手順

### **Step 1: Render.com に Backend をデプロイ**

#### 1-1. Render アカウント作成
- https://render.com へサインアップ

#### 1-2. PostgreSQL インスタンス作成
1. Render Dashboard → **New+** → **PostgreSQL**
2. Name: `diet-app-db`
3. Database: `diet_app` (任意)
4. Region: **Tokyo** (低遅延）
5. Plan: **Free** (テスト用)
6. 接続情報をコピー：
   ```
   postgresql://user:password@hostname:5432/dbname
   ```

#### 1-3. Backend サービス作成
1. Render Dashboard → **New+** → **Web Service**
2. GitHub リポジトリを接続
3. 設定：
   - **Name**: `diet-app-backend`
   - **Runtime**: Python 3.11
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

#### 1-4. 環境変数設定（Render Dashboard）
Service → Environment → Add Variable:

```
DATABASE_URL = postgresql://...  ← PostgreSQL接続文字列
GEMINI_API_KEY = your_api_key
SECRET_KEY = <新規生成したキー>
CORS_ORIGINS = https://diet-app-frontend.vercel.app
GEMINI_MODEL_NAME = gemini-1.5-flash
PYTHON_VERSION = 3.11.9
```

SECRET_KEY の生成：
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

#### 1-5. デプロイ実行
GitHub push で自動デプロイ、または Render Dashboard で手動トリガー

**デプロイ完了後、Backend URL を記録**：
```
https://diet-app-backend.onrender.com
```

---

### **Step 2: Vercel に Frontend をデプロイ**

#### 2-1. Vercel アカウント作成
- https://vercel.com へサインアップ（GitHub で連携推奨）

#### 2-2. Frontend プロジェクト追加
1. Vercel Dashboard → **Add New** → **Project**
2. GitHub リポジトリを選択
3. Framework: **Vite** を選択
4. Root Directory: `frontend`

#### 2-3. ビルド設定
- **Build Command**: `npm install && npm run build`
- **Output Directory**: `dist`

#### 2-4. 環境変数設定（Vercel Dashboard）
Project → Settings → Environment Variables:

```
VITE_API_URL = https://diet-app-backend.onrender.com
```

#### 2-5. デプロイ実行
GitHub push で自動デプロイ開始

**デプロイ完了後、Frontend URL**：
```
https://diet-app-frontend.vercel.app
```

---

### **Step 3: Render の CORS 設定を更新**

Backend が Vercel Frontend からのリクエストを受け入れるよう修正：

Render Dashboard → `diet-app-backend` Service → Environment → 編集：

```
CORS_ORIGINS = https://diet-app-frontend.vercel.app
```

---

### **Step 4: API プロキシが動作することを確認**

#### 4-1. vercel.json が正しいか確認
```bash
cd frontend
cat vercel.json
```

以下のような設定であること：
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://diet-app-backend.onrender.com/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

#### 4-2. Frontend でテスト
1. https://diet-app-frontend.vercel.app にアクセス
2. ユーザー登録 → API が Render に届いているか確認
3. Browser DevTools → Network tab → `/api/` リクエストが成功（200）か確認

---

## 🗄️ データベース移行（初回のみ）

現在、VPN環境では SQLite を使用しています。本番環境に初めてデプロイする場合、既存データを PostgreSQL に移行する必要があります。

```bash
# 1. Render PostgreSQL に接続
export DATABASE_URL="postgresql://user:password@hostname:5432/dbname"

# 2. テーブルを作成
python -c "from app.database import Base, engine; Base.metadata.create_all(bind=engine)"

# 3. SQLite のデータをエクスポート（スクリプトがあれば）
python backend/migrate_sqlite_to_pg.py
```

---

## ✅ デプロイ後の確認

- [ ] Frontend: https://diet-app-frontend.vercel.app にアクセス可能
- [ ] Backend: https://diet-app-backend.onrender.com/docs にアクセス可能
- [ ] ユーザー登録ができる
- [ ] ログインできる
- [ ] データ送信・取得ができる
- [ ] AI Advice が機能する

---

## 🔧 トラブルシューティング

### "CORS policy: Access to XMLHttpRequest blocked"
- ✓ Render の CORS_ORIGINS が正しく設定されているか確認
- ✓ Vercel デプロイが完了しているか確認（数分要す）

### "Cannot GET /api/..."
- ✓ vercel.json の rewrites が正しいか確認
- ✓ Backend URL が `https://diet-app-backend.onrender.com` か確認

### "Cannot find module"
- ✓ Render: `pip install -r requirements.txt` が成功しているか確認
- ✓ Vercel: `npm install` が成功しているか確認

### Database connection error
- ✓ PostgreSQL インスタンスが起動しているか確認
- ✓ DATABASE_URL が正しいか確認

---

## VPN 環境との使い分け

**VPN 内（開発・テスト）**：
```bash
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev
# http://localhost:5173 でアクセス
```

**インターネット公開版**：
- Frontend: https://diet-app-frontend.vercel.app
- Backend API: 自動的に Render にプロキシ

両環境は完全に独立しており、相互影響なし。
