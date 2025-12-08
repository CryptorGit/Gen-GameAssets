# SAM3D Modal Deployment

SAM3D 3D GenerationをModal上で実行するためのセットアップガイド。

## 前提条件

1. **Modal アカウント**: https://modal.com でアカウントを作成
2. **Modal CLI**: `pip install modal`
3. **HuggingFace アカウント**: SAM3Dモデルへのアクセス用

## セットアップ

### 1. Modal認証

```bash
modal setup
```

ブラウザでModalにログインし、トークンを取得。

### 2. HuggingFaceシークレット設定

```bash
modal secret create huggingface-secret HF_TOKEN=<your-huggingface-token>
```

### 3. デプロイ

```bash
cd backend
modal deploy sam3d_modal.py
```

デプロイ後、以下のURLが発行されます：
- **API**: `https://<your-app>.modal.run`
- **ドキュメント**: `https://<your-app>.modal.run/docs`

## エンドポイント

### GET /health
ヘルスチェック

```json
{
  "status": "ok",
  "service": "sam3d-generation-server",
  "model_loaded": true,
  "gpu": "NVIDIA A10G",
  "cuda_available": true
}
```

### POST /generate
3Dモデル生成

**Request:**
```json
{
  "image": "data:image/png;base64,...",
  "mask": "data:image/png;base64,...",
  "seed": 42,
  "output_format": "ply"
}
```

**Response:**
```json
{
  "success": true,
  "model_data": "<base64-encoded-ply>",
  "format": "ply",
  "message": "3D model generated successfully"
}
```

## フロントエンド設定

環境変数でModalのURLを設定：

```bash
# .env.local
NEXT_PUBLIC_SAM3D_API_URL=https://<your-app>.modal.run
```

## ローカルテスト

```bash
modal run sam3d_modal.py
```

## コスト

- **GPU**: A10G (24GB VRAM)
- **料金**: 約$0.001/秒 (使用時のみ課金)
- **コールドスタート**: 約30-60秒（初回）

## トラブルシューティング

### モデルロードエラー
- HuggingFaceトークンが正しいか確認
- SAM3Dモデルへのアクセス権があるか確認

### タイムアウト
- 大きな画像は処理時間がかかる
- timeout設定を600秒に設定済み

### GPUメモリ不足
- A10G (24GB) で通常は十分
- 複数オブジェクトの同時処理は避ける
