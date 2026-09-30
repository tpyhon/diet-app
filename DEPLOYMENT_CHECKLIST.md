# Diet App Render デプロイ チェックリスト

## 準備フェーズ

- [ ] GitHub リポジトリが公開されている
- [ ] Render.com アカウントを作成
- [ ] GitHub を Render に接続
- [ ] Google Gemini API キーを取得

## データベース設定

- [ ] Render で PostgreSQL インスタンスを作成（Free プラン）
- [ ] 接続文字列をコピー: `postgresql://...`
- [ ] データベース名を決定

## Backend デプロイ

- [ ] `backend/.env.example` を確認
- [ ] Render に Backend Web Service を作成
- [ ] Build Command: `pip install -r requirements.txt`
- [ ] Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### 環境変数（Backend）

- [ ] `DATABASE_URL`: PostgreSQL 接続文字列
  ```
  postgresql://user:password@host:5432/diet_app
  ```
- [ ] `GEMINI_API_KEY`: Google Gemini API キー
- [ ] `SECRET_KEY`: 新規生成（python3 -c "import secrets; print(secrets.token_urlsafe(32))"）
- [ ] `GEMINI_MODEL_NAME`: gemini-1.5-flash
- [ ] `PYTHON_VERSION`: 3.11.9
- [ ] `CORS_ORIGINS`: https://diet-app-frontend.onrender.com,http://localhost:3000

## Frontend デプロイ

- [ ] Render に Static Site を作成
- [ ] Root Directory: `frontend`
- [ ] Build Command: `npm install && npm run build`
- [ ] Publish Directory: `dist`
- [ ] `VITE_API_URL`: https://diet-app-backend.onrender.com

## デプロイ後検証

- [ ] Backend Swagger UI にアクセス: https://diet-app-backend.onrender.com/docs
- [ ] Frontend ページが読み込まれるか確認: https://diet-app-frontend.onrender.com
- [ ] API エンドポイントが正常に動作: Network tab で確認
- [ ] ログにエラーがないか確認

## VPN 環境（既存環境保持）

- [ ] ローカル SQLite は変更なし
- [ ] VPN 経由のアクセスは引き続き利用可能
- [ ] `backend/.env.vpn.example` を参照して VPN 環境変数を設定（必要に応じて）

## セキュリティ

- [ ] `.env` ファイルが `.gitignore` に含まれている
- [ ] GEMINI_API_KEY が Render 環境変数に設定（コミットしていない）
- [ ] SECRET_KEY が新規生成
- [ ] CORS_ORIGINS が適切に制限されている

## 運用

- [ ] Render Dashboard をブックマーク
- [ ] ログ監視の頻度を決定
- [ ] バックアップ戦略を決定
- [ ] 本番環境での動作をテスト

## トラブルシューティング準備

- [ ] Render ドキュメント: https://render.com/docs
- [ ] Backend ログをチェック方法を理解
- [ ] Frontend ネットワークエラーをデバッグ方法を理解

---

## デプロイ実行コマンド

### 1. ローカルテスト（本番前）
```bash
# Backend テスト
cd backend
export DATABASE_URL="sqlite:///./diet_app.db"
uvicorn app.main:app --reload

# Frontend テスト
cd ../frontend
npm run dev
```

### 2. Git Push でデプロイ開始
```bash
git add .
git commit -m "Setup Render deployment: render.yaml and configuration"
git push origin master
```

Render は自動的に `render.yaml` を検出してデプロイを開始します。

### 3. デプロイ状態確認
```
https://dashboard.render.com → Services を監視
```

---

## よくある問題と解決策

| 問題 | 原因 | 解決策 |
|------|------|--------|
| CORS エラー | CORS_ORIGINS が設定されていない | Render > Environment で CORS_ORIGINS を確認 |
| Database エラー | DATABASE_URL が間違っている | PostgreSQL 接続文字列を再確認 |
| 白い画面 | VITE_API_URL が設定されていない | Frontend の Environment 変数を確認 |
| Build 失敗 | requirements.txt または package.json が古い | ローカルでテスト後に git push |

