# SAM3D 3Dアセット工場 実装計画

## 概要

SAM3D を Modal.com 上で動作させ、画像＋マスクから3Dアセット（PLY/GLB）を生成するパイプラインを構築する。

**アーキテクチャ**: Web UI ファースト + Modal HTTP エンドポイント

```
┌─────────────────┐     HTTP/REST      ┌─────────────────┐
│   Next.js       │ ◄─────────────────► │   Modal.com     │
│   Web UI        │   (JSON + Binary)   │   GPU Backend   │
│   (Vercel)      │                     │   (A100/T4)     │
└─────────────────┘                     └─────────────────┘
        │                                       │
        │ Upload                                │ SAM3D
        ▼                                       ▼
   画像 + マスク                          3D生成 (PLY/GLB)
```

---

## フェーズ構成

### フェーズ 1: ローカル環境構築 ✅ 完了
**目標**: プロジェクト構造の確立と設定ファイルの準備

| タスク | 状態 | 説明 |
|--------|------|------|
| 1.1 リポジトリ作成 | ✅ | Gen-GameAssets リポジトリ |
| 1.2 sam-3d-objects clone | ✅ | Facebook のリポジトリを取得済み |
| 1.3 .env 作成 | ✅ | Modal/HuggingFace トークン設定済み |
| 1.4 .gitignore 作成 | ✅ | .env、checkpoints、outputs 等を除外 |
| 1.5 プロジェクト構造作成 | ✅ | backend/ + web/ ディレクトリ構成 |

---

### フェーズ 2: Modal バックエンド（HTTP エンドポイント）⚡ 進行中
**目標**: SAM3D 推論を HTTP API として公開

| タスク | 状態 | 説明 |
|--------|------|------|
| 2.1 Modal プロジェクト初期化 | ✅ | app.py 作成済み |
| 2.2 Image 定義 | ✅ | CUDA + PyTorch + 基本依存関係 |
| 2.3 Volume 設定 | ✅ | チェックポイント永続化設定済み |
| 2.4 推論関数作成 | 🔲 | SAM3D ラッパー（プレースホルダー作成済み） |
| 2.5 HTTP エンドポイント | ✅ | `@modal.web_endpoint` 定義済み |
| 2.6 CORS 設定 | 🔲 | フロントエンドからのアクセス許可 |

**API 設計**:
```
POST /api/generate
  Request:
    - image: Base64 or multipart/form-data
    - mask: Base64 or multipart/form-data
    - output_format: "ply" | "glb"
    - seed: number (optional)
  Response:
    - file: Binary (PLY/GLB)
    - metadata: { vertices, faces, processing_time }

GET /api/health
  Response: { status: "ok", gpu: "A100", model_loaded: true }
```

**依存関係（推論用最小構成）**:
```
必須:
- torch, torchvision, torchaudio (cu121)
- kaolin==0.17.0
- gsplat (git)
- pytorch3d
- hydra-core, omegaconf
- MoGe (git)
- Pillow, numpy

除外:
- auto_gptq, bitsandbytes (量子化/学習用)
- wandb (ログ)
- gradio (別途UIを作るため)
- pytest, black, flake8 (開発用)
```

---

### フェーズ 3: Web UI（Next.js）⭐ 進行中
**目標**: Meta Playground 風のインタラクティブ UI

| タスク | 状態 | 説明 |
|--------|------|------|
| 3.1 Next.js プロジェクト作成 | ✅ | App Router + TypeScript |
| 3.2 UIコンポーネント | ✅ | Tailwind CSS ベース |
| 3.3 画像アップロード | ✅ | ドラッグ＆ドロップ対応 |
| 3.4 マスク編集UI | ✅ | Canvas ベースのペイント/消しゴム |
| 3.5 API 連携 | ✅ | Modal エンドポイント呼び出し |
| 3.6 3D プレビュー | ✅ | Three.js / React Three Fiber（プレースホルダー） |
| 3.7 ダウンロード機能 | ✅ | PLY/GLB ファイル出力 |
| 3.8 履歴管理 | 🔲 | LocalStorage で過去の生成を保存 |

**UI フロー**:
```
1. 画像アップロード（ドラッグ or ファイル選択）
     ↓
2. マスク作成（ブラシで塗る or 自動セグメンテーション）
     ↓
3. 「3D生成」ボタン押下
     ↓
4. ローディング表示（Modal で処理中）
     ↓
5. 3Dプレビュー（回転・ズーム可能）
     ↓
6. ダウンロード（PLY / GLB 選択）
```

**技術スタック**:
```
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui (UIコンポーネント)
- React Three Fiber (3Dビューワー)
- Zustand (状態管理)
- react-dropzone (ファイルアップロード)
```

---

### フェーズ 4: バッチ処理機能
**目標**: 複数アセットの一括生成

| タスク | 状態 | 説明 |
|--------|------|------|
| 4.1 バッチUI | 🔲 | 複数ファイルアップロード |
| 4.2 キュー管理 | 🔲 | 処理状況の表示 |
| 4.3 一括ダウンロード | 🔲 | ZIP 圧縮 |
| 4.4 CLI ツール（オプション） | 🔲 | ヘッドレス運用向け |

---

### フェーズ 5: 本番運用
**目標**: 安定した 3D アセット量産体制

| タスク | 状態 | 説明 |
|--------|------|------|
| 5.1 Vercel デプロイ | 🔲 | Web UI ホスティング |
| 5.2 エラーハンドリング | 🔲 | リトライ・通知 |
| 5.3 使用量モニタリング | 🔲 | Modal のコスト管理 |
| 5.4 アセットライブラリ | 🔲 | 生成物の管理UI |

---

## 技術的な課題と対策

### 課題 1: 重い依存関係
**問題**: kaolin, gsplat, pytorch3d はビルドに時間がかかる

**対策**:
- Modal の `Image.build` でキャッシュを活用
- 事前ビルド済みの wheel を使用（可能な場合）
- コンテナイメージをレイヤー分割して再ビルド時間を短縮

### 課題 2: チェックポイントのダウンロード
**問題**: HuggingFace からモデルをダウンロードする必要がある

**対策**:
- Modal Volume に永続化
- 初回起動時のみダウンロード
- HF_TOKEN を Modal Secret として管理

### 課題 3: GPU メモリ
**問題**: SAM3D は GPU メモリを多く消費

**対策**:
- Modal で A100 (40GB/80GB) を指定
- 必要に応じて T4/A10G でテスト
- タイムアウト設定で長時間占有を防ぐ

### 課題 4: CORS と認証
**問題**: フロントエンドからの直接アクセス

**対策**:
- Modal の `@web_endpoint` で CORS ヘッダー設定
- 必要に応じて API キー認証を追加

---

## ファイル構成（最終形）

```
Gen-GameAssets/
├── .env                    # 環境変数（Git 除外）
├── .gitignore
├── README.md
├── docs/
│   ├── todo.md             # 構想ドキュメント
│   └── implementation_plan.md  # この計画書
│
├── sam-3d-objects/         # Facebook SAM3D リポジトリ（Git 除外）
│   └── ...
│
├── backend/                # Modal バックエンド
│   ├── app.py              # Modal アプリ定義 + HTTP エンドポイント
│   ├── inference.py        # SAM3D 推論ラッパー
│   ├── requirements.txt    # 推論用依存関係
│   └── utils.py            # ヘルパー関数
│
├── web/                    # Next.js Web UI
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx        # メインページ
│   │   └── api/            # 必要に応じて BFF
│   ├── components/
│   │   ├── ImageUploader.tsx
│   │   ├── MaskEditor.tsx
│   │   ├── Viewer3D.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── api.ts          # Modal API クライアント
│   │   └── utils.ts
│   └── public/
│
├── inputs/                 # 入力画像（Git 除外）
└── outputs/                # 出力ファイル（Git 除外）
```

---

## 直近の作業（Next Steps）

### 今すぐやること
1. **`.gitignore` の作成**
2. **`backend/` ディレクトリ作成** - Modal アプリの雛形
3. **`web/` ディレクトリ作成** - Next.js プロジェクト初期化

### 並行作業
- **Backend**: Modal Image 定義 → 推論テスト
- **Frontend**: Next.js 基本UI → API 連携

---

## 成功基準

### マイルストーン 1: バックエンド動作確認
- [ ] Modal 上で SAM3D が動作する
- [ ] HTTP エンドポイントで PLY が返ってくる

### マイルストーン 2: Web UI 基本機能
- [ ] 画像アップロードができる
- [ ] マスクを描画できる
- [ ] 生成ボタンで Modal API を叩ける

### マイルストーン 3: エンドツーエンド
- [ ] Web UI から 3D 生成 → プレビュー → ダウンロード

### 最終ゴール
- [ ] ゲーム用アセット（肉、串、パーツ等）を量産できる状態

---

## 参考リンク

- [SAM3D Objects GitHub](https://github.com/facebookresearch/sam-3d-objects)
- [Modal.com Docs](https://modal.com/docs)
- [Modal Web Endpoints](https://modal.com/docs/guide/webhooks)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [shadcn/ui](https://ui.shadcn.com/)
