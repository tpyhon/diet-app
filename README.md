# 💪 My Diet App

食事・ウォーキング・筋トレ・体重を統合管理する個人用ダイエットアプリ。  
Gemma 4 AI がカロリー推定・栄養素分析・アドバイス生成をすべて自動で行います。

---

## 📱 対応デバイス

| デバイス | 方法 |
|---|---|
| PC | ブラウザで直接アクセス |
| iPhone / Android | PWA としてホーム画面に追加 |
| 外出先 | Tailscale VPN 経由でどこからでもアクセス可能 |

---

## ✨ 機能一覧

### 🏠 ダッシュボード
- 今日の摂取カロリー進捗バー（個人目標kcal対応）
- PFCバランスバー＋「残りg数」リアルタイム表示
- 体重変化・ウォーキング距離・筋トレストリーク サマリー
- トレーニングXP / レベル表示

### 🍽️ 食事記録
- **テキスト入力** → Gemma AI がカロリー＋PFC（タンパク質・脂質・炭水化物）を自動推定
- **写真入力** → 料理名・量・カロリー・PFC をAIが画像から推定（編集可能）
- 日付グループ表示・日合計PFC表示

### 🚶 ウォーキング
- GPS トラッキング・Leaflet 地図でコース可視化
- 手動距離入力にも対応
- 消費カロリーを **距離×速度→METs×体重** で正確計算（早歩きも適切に反映）
- Wake Lock API でウォーキング中の画面スリープを防止

### 💪 筋トレ
- トレーニングプラン管理（曜日別）
- Gemma AI によるプラン自動生成
- 実施ログ記録
- XP・レベル・連続日数ストリークのゲーム要素

### ⚖️ 体重記録
- Recharts グラフで 1週間〜1年の推移を表示
- 目標体重の設定と達成予測日の自動計算

### 👤 プロフィール設定
- 年齢・性別・身長・体重・活動レベル・目標を登録
- Harris–Benedict 式により TDEE からカロリー目標を自動計算
- **Gemma AI による個人最適カロリー目標＆推奨PFC提案**
  - 目標別PFC比率（減量: P30/F25/C45、維持: P25/F25/C50、増量: P25/F20/C55）

### 🤖 AIアドバイス
- 過去7日間の食事・栄養素・運動・体重データを分析
- カロリー目標との比較・PFC平均を踏まえたアドバイス
- 来週の目標提案・激励メッセージ生成

---

## 🛠️ 技術スタック

### バックエンド

| 技術 | 用途 |
|---|---|
| Python 3.11 | 実行環境 |
| FastAPI | REST API フレームワーク |
| SQLAlchemy 2.0 | ORM |
| SQLite | データベース |
| Google Gen AI SDK | Gemma 4 (gemma-4-26b-a4b-it) 連携 |
| python-jose | JWT 認証 |
| bcrypt | パスワードハッシュ |

### フロントエンド

| 技術 | 用途 |
|---|---|
| React 19 + TypeScript | UI フレームワーク |
| Vite | ビルドツール |
| Tailwind CSS v4 | スタイリング |
| React Router v6 | ルーティング |
| TanStack Query v5 | サーバー状態管理・キャッシュ |
| Recharts | グラフ描画 |
| Leaflet + React Leaflet | 地図・GPS 表示 |
| Lucide React | アイコン |
| React Hot Toast | トースト通知 |

### インフラ・その他

| 技術 | 用途 |
|---|---|
| Tailscale | VPN（外部・スマホからのアクセス） |
| PWA | ホーム画面追加・スタンドアロン動作 |
| Wake Lock API | ウォーキング中の画面スリープ防止 |

---

## 📁 ディレクトリ構成

```
diet-app/
│
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI エントリポイント・ミドルウェア設定
│   │   ├── database.py          # DB接続・セッション管理
│   │   ├── auth.py              # JWT認証・パスワードハッシュ
│   │   │
│   │   ├── models/              # SQLAlchemy モデル
│   │   │   ├── user.py          # ユーザー・プロフィール・カロリー目標
│   │   │   ├── meal.py          # 食事記録（カロリー・PFC）
│   │   │   ├── walking.py       # ウォーキングセッション・GPSルート
│   │   │   ├── training.py      # 筋トレプラン・ログ・ゲームステータス
│   │   │   └── weight.py        # 体重記録・目標体重
│   │   │
│   │   └── routers/             # API エンドポイント
│   │       ├── auth.py          # 認証・プロフィール・AI カロリー提案
│   │       ├── meals.py         # 食事CRUD・画像解析・PFC推定
│   │       ├── walking.py       # ウォーキングCRUD・METs消費カロリー計算
│   │       ├── training.py      # 筋トレプラン・ログ・XP管理
│   │       ├── weight.py        # 体重記録・目標・予測
│   │       └── ai_advice.py     # 週次アドバイス・トレーニングプラン生成
│   │
│   ├── migrate.py               # DBマイグレーションスクリプト
│   ├── requirements.txt
│   ├── .env                     # APIキー（Git管理外）
│   └── diet_app.db              # SQLite DB（自動生成）
│
├── frontend/
│   ├── public/
│   │   ├── manifest.json        # PWA 設定
│   │   └── icons/               # PWA アイコン各サイズ
│   │
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx    # ホーム・カロリー進捗・PFCバー
│       │   ├── MealPage.tsx     # 食事記録・テキスト＆写真入力
│       │   ├── WalkingPage.tsx  # ウォーキング記録・地図表示
│       │   ├── TrainingPage.tsx # 筋トレプラン・ログ・XP
│       │   ├── WeightPage.tsx   # 体重グラフ・目標設定
│       │   ├── AiPage.tsx       # AIアドバイスレポート
│       │   ├── ProfilePage.tsx  # プロフィール・カロリー目標・推奨PFC
│       │   └── LoginPage.tsx    # ログイン・新規登録
│       │
│       ├── components/
│       │   └── AiPlanGenerator.tsx  # AIトレーニングプラン生成フォーム
│       │
│       ├── utils/
│       │   └── leafletIcons.ts  # Leaflet デフォルトアイコン修正
│       │
│       ├── api.ts               # Axios API通信・型定義
│       ├── App.tsx              # ルーティング・ナビゲーション・プロフィールパネル
│       ├── main.tsx             # エントリポイント
│       └── index.css            # グローバルスタイル
│
├── index.html
├── vite.config.ts
├── package.json
├── .gitignore
├── start.bat                    # Windows 用一発起動スクリプト
└── README.md
```

---

## 🚀 セットアップ

### 必要なもの

- Python 3.11+
- Node.js 18+
- Gemini API キー（[Google AI Studio](https://aistudio.google.com/apikey) で取得）
- Tailscale（スマホ・外出先からのアクセスに使用）

---

### 1. リポジトリをクローン

```bash
git clone <repository-url>
cd diet-app
```

### 2. バックエンドのセットアップ

```bash
# 仮想環境を作成・有効化
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac / Linux

# 依存パッケージをインストール
pip install -r backend/requirements.txt
```

### 3. 環境変数を設定

`backend/.env` を作成して以下を記入します。

```env
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_secret_key_here
DATABASE_URL=sqlite:///./diet_app.db
```

### 4. フロントエンドのセットアップ

```bash
cd frontend
npm install
```

### 5. 起動

**Windows の場合（推奨）**

プロジェクトルートの `start.bat` をダブルクリック、または

```bash
start.bat
```

**手動起動の場合**

ターミナルを2つ開いて、それぞれで実行します。

```bash
# ターミナル①：バックエンド
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
# ターミナル②：フロントエンド
cd frontend
npm run dev
```

### 6. アクセス

| 用途 | URL |
|---|---|
| ブラウザ（PC） | http://localhost:5173 |
| API ドキュメント | http://localhost:8000/docs |
| スマホ（Tailscale 経由） | http://[TailscaleのIP]:5173 |

---

## 🗄️ DBマイグレーション

既存データを保持したままカラムを追加する場合は、付属のスクリプトを使用してください。

```bash
python backend/migrate.py
```

冪等設計のため、すでにカラムが存在する場合はスキップされます。何度実行しても安全です。

---

## 🔐 認証

JWT（JSON Web Token）によるユーザー認証を実装しています。

- トークン有効期限：**7日間**
- 全データはユーザーIDで分離されており、他ユーザーのデータにはアクセスできません
- 401エラー時はフロントエンドが自動でログアウト・ログインページへリダイレクト

---

## 📊 カロリー・PFC計算の仕様

### カロリー目標の自動計算

Harris–Benedict 式により基礎代謝（BMR）を算出し、活動レベル係数を掛けてTDEEを計算します。


$$BMR_{男性} = 88.362 + 13.397w + 4.799h - 5.677a$$


$$BMR_{女性} = 447.593 + 9.247w + 3.098h - 4.330a$$


$$TDEE = BMR \times \text{活動係数}$$

目標別補正として、減量時は `-500 kcal`、増量時は `+300 kcal` を適用します。

### 推奨PFC比率

| 目標 | タンパク質 | 脂質 | 炭水化物 |
|---|---|---|---|
| 減量 | 30% | 25% | 45% |
| 維持 | 25% | 25% | 50% |
| 増量 | 25% | 20% | 55% |

### ウォーキング消費カロリー

速度からMETs値を決定し、体重・時間を掛けて算出します。


$$\text{消費kcal} = METs \times \text{体重(kg)} \times \text{時間(h)} \times 1.05$$

| 速度 | METs |
|---|---|
| ～3.2 km/h（ゆっくり） | 2.8 |
| 3.2～4.8 km/h（普通歩き） | 3.5 |
| 4.8～6.4 km/h（早歩き） | 4.3 |
| 6.4 km/h～（競歩） | 5.0 |

---

## 🤖 AI 機能一覧

| 機能 | エンドポイント | モデル |
|---|---|---|
| カロリー＋PFC推定（テキスト） | `POST /api/meals/` | gemma-4-26b-a4b-it |
| 料理認識＋PFC推定（画像） | `POST /api/meals/analyze-image` | gemma-4-26b-a4b-it |
| カロリー目標＆推奨PFC提案 | `POST /api/auth/suggest-calorie-goal` | gemma-4-26b-a4b-it |
| 週次アドバイスレポート | `GET /api/ai/advice` | gemma-4-26b-a4b-it |
| トレーニングプラン自動生成 | `POST /api/ai/generate-plan` | gemma-4-26b-a4b-it |
