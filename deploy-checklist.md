# デプロイ前チェックリスト

## 🔒 セキュリティチェック

- [ ] **APIキーの外部化**
  - [ ] `.env` ファイルが `.gitignore` に含まれている
  - [ ] `GEMINI_API_KEY` が `.env` に存在（Git管理外）
  - [ ] `SECRET_KEY` を新規生成している

  ```bash
  # SECRET_KEY の生成
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```

- [ ] **環境変数の確認**
  - [ ] ローカル開発環境で `.env.vpn.example` から `.env` を作成済み
  - [ ] 本番環境変数は Render Dashboard で設定予定

## 🏗️ ファイル構成の確認

- [ ] `backend/.env` が Git管理外である確認
  ```bash
  git check-ignore backend/.env  # "backend/.env" と表示されればOK
  ```

- [ ] 以下のファイルが作成されている
  - [ ] `backend/.env.example`
  - [ ] `backend/.env.vpn.example`
  - [ ] `frontend/src/config.ts`
  - [ ] `frontend/.env.production.example`
  - [ ] `render.yaml` (更新版)

## 📦 環境依存性の確認

- [ ] **Backend**
  - [ ] `pip freeze` で依存ライブラリを確認
  - [ ] `psycopg2-binary` が `requirements.txt` に含まれている（PostgreSQL用）

- [ ] **Frontend**
  - [ ] `npm list` で依存パッケージを確認
  - [ ] `package.json` で build スクリプトが定義されている

## 🗄️ データベース準備

- [ ] **ローカル開発版（VPN）**
  - [ ] SQLite DB が `backend/diet_app.db` に存在
  - [ ] テスト用データが入っている（必要な場合）

- [ ] **本番環境（Render）**
  - [ ] Render.com アカウント作成済み
  - [ ] PostgreSQL インスタンスを作成予定
  - [ ] 接続文字列を控えている

## 🔄 ローカルテスト

- [ ] **Backend テスト**
  ```bash
  cd backend
  uvicorn app.main:app --reload
  # http://localhost:8081/docs でSwagger UI を確認
  ```

- [ ] **Frontend テスト**
  ```bash
  cd frontend
  npm run dev
  # http://localhost:5173 で動作確認
  # API が `http://localhost:8081` に接続していることを確認
  ```

- [ ] **統合テスト**
  - [ ] ユーザー登録・ログインができる
  - [ ] データの送信・取得ができる
  - [ ] AI Advice が機能する

## 🚀 Render.com デプロイ準備

- [ ] GitHub リポジトリが public または Render と接続済み
- [ ] `render.yaml` が正しくコミットされている
- [ ] 環境変数を Render Dashboard で設定予定

  ```
  DATABASE_URL = postgresql://user:password@hostname:5432/dbname
  GEMINI_API_KEY = <YOUR_KEY>
  SECRET_KEY = <NEWLY_GENERATED_KEY>
  CORS_ORIGINS = https://diet-app-frontend.onrender.com
  GEMINI_MODEL_NAME = gemini-1.5-flash
  PYTHON_VERSION = 3.11.9
  VITE_API_URL = https://diet-app-backend.onrender.com
  ```

## ✅ 最終チェック

- [ ] ローカルで全機能がテスト済み
- [ ] `.env` 以外のすべての設定ファイルがコミット済み
- [ ] Git status が clean である（コミット予定でない変更がない）

  ```bash
  git status  # nothing to commit, working tree clean であること
  ```

---

## 次のステップ

すべてチェックが完了したら：

1. **Render.com にログイン**
2. **Backend サービスの作成**
   - GitHub リポジトリを接続
   - 環境変数を設定
   - デプロイ実行

3. **Frontend サービスの作成**
   - Static Site として作成
   - 環境変数を設定
   - デプロイ実行

4. **動作確認**
   - `https://diet-app-frontend.onrender.com` にアクセス
   - 機能テストを実施

5. **VPN版の保守**
   - ローカルの `.env` は VPN 用に保持
   - 必要に応じてデータバックアップ
