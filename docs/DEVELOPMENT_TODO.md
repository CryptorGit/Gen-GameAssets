# Gen-GameAssets 開発TODO

## プロジェクト概要
**目標**: SAM3D ベースの「3Dアセット工場」 - 画像とマスクから3Dゲームアセットを量産するシステム

---

## ✅ 完了済みタスク

### フロントエンド (WebUI)
- [x] Next.js 16 + React 19 + TypeScript 環境構築
- [x] Meta AI Demos "Create 3D models" 風のUIデザイン実装
- [x] 3ステップガイド付きサイドバー (Sidebar.tsx)
- [x] ドラッグ&ドロップ対応画像アップロード (ImageUpload.tsx)
- [x] 2Dマスク編集キャンバス - Add/Remove モード (ImageEditor.tsx)
- [x] オブジェクト管理（複数オブジェクト対応）
- [x] 3Dプレビュー with React Three Fiber (Scene3DViewer.tsx)
- [x] Zustand によるグローバル状態管理 (store.ts)
- [x] ダークテーマUI（黒背景）

---

## 🔄 進行中タスク

### Phase 1: バックエンド基盤構築

#### 1.1 Modal.com 推論基盤
- [ ] `modal_app/` ディレクトリ作成
- [ ] Modal プロジェクト初期化
- [ ] SAM3D 用 Dockerfile 作成
  - ベースイメージ: `nvcr.io/nvidia/pytorch:24.xx-py3`
  - `sam-3d-objects` リポジトリのコピー
  - `requirements.inference.txt` ベースで依存インストール
  - 問題児ライブラリ（auto-gptq, kaolin等）の除外

#### 1.2 SAM3D デモ実行
- [ ] Modal 上で `demo.py` を動作確認
- [ ] GPU インスタンス (A10G/A100) での推論テスト
- [ ] エラーハンドリング・タイムアウト設定

---

## 📋 今後のTODO

### Phase 2: 推論API構築

#### 2.1 コアAPI
- [ ] `run_sam3d(image_bytes, mask_bytes) -> ply_bytes` 関数実装
- [ ] REST API エンドポイント
  - `POST /generate` - 3D生成リクエスト
  - `GET /health` - ヘルスチェック
  - `GET /status/{job_id}` - ジョブステータス確認
- [ ] 非同期ジョブキュー（長時間生成対応）

#### 2.2 出力フォーマット
- [ ] PLY (点群/Gaussian Splatting) 出力
- [ ] GLB/GLTF (メッシュ) 出力（オプション）
- [ ] テクスチャ付きメッシュ生成

---

### Phase 3: フロントエンド - バックエンド連携

#### 3.1 API統合
- [ ] `web/src/lib/api.ts` の実装完成
  - Modal バックエンドへの接続
  - 画像/マスクのBase64エンコード送信
  - ジョブステータスポーリング
- [ ] 生成進捗のリアルタイム表示
- [ ] エラーハンドリング UI

#### 3.2 3Dモデル表示
- [ ] PLY ファイルのパース・表示
- [ ] Gaussian Splatting ビューワー統合
- [ ] GLB/GLTF ローダー

#### 3.3 ダウンロード機能
- [ ] 個別オブジェクトのダウンロード
- [ ] シーン全体のエクスポート
- [ ] フォーマット選択（PLY/GLB）

---

### Phase 4: バッチ処理・自動化

#### 4.1 バッチ生成
- [ ] 複数画像+マスクの一括アップロード
- [ ] バッチジョブキュー
- [ ] 進捗モニタリングダッシュボード

#### 4.2 CLI ツール
- [ ] `sam3d-cli generate <image> <mask> -o <output.ply>`
- [ ] ディレクトリ単位のバッチ処理
- [ ] 設定ファイル対応

---

### Phase 5: 高度な機能

#### 5.1 自動マスク生成
- [ ] SAM2 による自動セグメンテーション統合
- [ ] オブジェクト検出 + 自動マスク
- [ ] インタラクティブプロンプト（ボックス/ポイント）

#### 5.2 品質向上
- [ ] 高解像度メッシュ生成
- [ ] テクスチャ品質向上
- [ ] マルチビューレンダリング

#### 5.3 ゲームエンジン連携
- [ ] Unity インポートパイプライン
- [ ] Unreal Engine プラグイン
- [ ] LOD 自動生成

---

## 🛠 技術スタック

### フロントエンド
- Next.js 16.0.7
- React 19.2.0
- TypeScript 5
- Tailwind CSS 4
- @react-three/fiber + @react-three/drei
- Zustand 5

### バックエンド
- Modal.com (サーバーレスGPU)
- FastAPI / Flask
- PyTorch
- SAM 3D Objects

### 推論環境
- CUDA 12.x
- PyTorch 2.x
- SAM3D 推論パイプライン

---

## 📂 ディレクトリ構造（予定）

```
Gen-GameAssets/
├── web/                    # Next.js フロントエンド ✅
│   ├── src/
│   │   ├── app/            # App Router
│   │   ├── components/     # UIコンポーネント
│   │   └── lib/            # ユーティリティ
│   └── package.json
├── backend/                # FastAPI バックエンド（ローカル開発用）
│   ├── app.py
│   └── requirements.txt
├── modal_app/              # Modal.com 推論アプリ 🔜
│   ├── Dockerfile
│   ├── sam3d_app.py
│   └── requirements.txt
├── cli/                    # CLI ツール 🔜
│   └── sam3d_cli.py
├── sam-3d-objects/         # SAM3D OSS (submodule)
├── sam3/                   # SAM3 (submodule)
└── docs/                   # ドキュメント
    ├── todo.md
    ├── webui_plan.md
    └── DEVELOPMENT_TODO.md ← このファイル
```

---

## 🎯 マイルストーン

| マイルストーン | 内容 | 目標期限 |
|--------------|------|---------|
| M1 | Modal 上で demo.py 動作確認 | - |
| M2 | 画像+マスク → PLY 変換API完成 | - |
| M3 | WebUI から3D生成が動作 | - |
| M4 | バッチ処理CLI完成 | - |
| M5 | ゲーム用アセット量産体制確立 | - |

---

## 📝 注意事項

- SAM3D の依存関係は重いため、Docker コンテナで環境を固定すること
- Modal.com の GPU 時間課金に注意（開発中は A10G 推奨）
- `sam-3d-objects/` と `sam3/` は .gitignore で除外済み（別途 clone）

---

*最終更新: 2024年12月7日*
