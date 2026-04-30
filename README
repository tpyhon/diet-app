# 💪 My Diet App

個人用ダイエット統合管理アプリ。食事・ウォーキング・筋トレ・体重を記録し、
Gemma AI がパーソナライズされたアドバイスを提供します。

## 📱 対応デバイス

- PC（ブラウザ）
- iPhone / Android（PWA・ホーム画面に追加可能）
- Tailscale VPN 経由でどこからでもアクセス可能

## ✨ 機能一覧

| 機能 | 説明 |
|---|---|
| 🏠 ダッシュボード | カロリー進捗・体重変化・ゲームステータスを一覧表示 |
| 🍽️ 食事記録 | 品目と量を入力するとGemma AIが自動でカロリーを推定 |
| 🚶 ウォーキング | GPSトラッキング・Leaflet地図・コース記録・手動入力対応 |
| 💪 筋トレ | プラン管理・AI自動生成・XP/レベル/ストリークのゲーム要素 |
| ⚖️ 体重記録 | Rechartsグラフで1週間〜1年の推移を表示 |
| 🤖 AIアドバイス | Gemma 4が週次データを分析しレポートと激励メッセージを生成 |

## 🛠️ 技術スタック

### バックエンド
- **Python 3.11**
- **FastAPI** — REST API フレームワーク
- **SQLAlchemy 2.0** — ORM
- **SQLite** — データベース
- **Google Gen AI SDK** — Gemma 4 (gemma-4-26b-a4b-it) 連携

### フロントエンド
- **React 19** + **TypeScript**
- **Vite** — ビルドツール
- **Tailwind CSS v4** — スタイリング
- **React Router v6** — ルーティング
- **TanStack Query v5** — サーバー状態管理
- **Recharts** — グラフ描画
- **Leaflet + React Leaflet** — 地図・GPS表示
- **Lucide React** — アイコン

### インフラ・その他
- **Tailscale** — VPN（スマホからのアクセス）
- **PWA** — ホーム画面追加・スタンドアロン動作
- **Wake Lock API** — ウォーキング中の画面スリープ防止

## 📁 ディレクトリ構成

diet-app/
│
├── 📦 venv/                          # Python 仮想環境
│
├── 🔧 backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI エントリポイント
│   │   ├── database.py               # DB接続・セッション管理
│   │   │
│   │   ├── 🗄️ models/               # SQLAlchemy モデル
│   │   │   ├── meal.py
│   │   │   ├── walking.py
│   │   │   ├── training.py
│   │   │   └── weight.py
│   │   │
│   │   └── 🌐 routers/              # API エンドポイント
│   │       ├── meals.py
│   │       ├── walking.py
│   │       ├── training.py
│   │       ├── weight.py
│   │       └── ai_advice.py
│   │
│   ├── requirements.txt
│   ├── .env                          # APIキー（Git管理外）
│   └── diet_app.db                   # SQLite DB（自動生成）
│
├── 🎨 frontend/
│   ├── public/
│   │   ├── manifest.json             # PWA 設定
│   │   └── icons/                    # PWA アイコン
│   │
│   └── src/
│       ├── 📄 pages/                 # 各ページコンポーネント
│       │   ├── Dashboard.tsx
│       │   ├── MealPage.tsx
│       │   ├── WalkingPage.tsx
│       │   ├── TrainingPage.tsx
│       │   ├── WeightPage.tsx
│       │   └── AiPage.tsx
│       │
│       ├── 🧩 components/           # 共通コンポーネント
│       │   └── AiPlanGenerator.tsx
│       │
│       ├── 🛠️ utils/
│       │   └── leafletIcons.ts       # Leaflet アイコン修正
│       │
│       ├── api.ts                    # API通信・型定義
│       ├── App.tsx                   # ルーティング・ナビゲーション
│       ├── main.tsx                  # エントリポイント
│       └── index.css                 # グローバルスタイル
│
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── .gitignore
├── 🚀 start.bat                      # Windows 用 一発起動スクリプト
└── 📖 README.md


## 🚀 セットアップ

### 必要なもの

- Python 3.11+
- Node.js 18+
- Gemini API キー（[Google AI Studio](https://aistudio.google.com/apikey) で取得）
- Tailscale（スマホアクセス用）

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd diet-app
