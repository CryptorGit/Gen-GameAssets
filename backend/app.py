"""
SAM3D Modal Backend
===================
HTTP エンドポイントとして SAM3D 推論を提供する Modal アプリケーション
"""

import modal
import io
import base64
from pathlib import Path

# Modal アプリケーション定義
app = modal.App("sam3d-backend")

# ========================================
# Image 定義（SAM3D 推論環境）
# ========================================

# 基本イメージ: CUDA + PyTorch
sam3d_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "git",
        "build-essential",
        "cmake",
        "ninja-build",
        "libgl1-mesa-glx",
        "libglib2.0-0",
        "libsm6",
        "libxext6",
        "libxrender-dev",
    )
    # PyTorch + CUDA
    .pip_install(
        "torch==2.5.1",
        "torchvision==0.20.1",
        "torchaudio==2.5.1",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    # 基本的な依存関係
    .pip_install(
        "numpy",
        "Pillow",
        "omegaconf",
        "hydra-core",
        "einops",
        "scipy",
        "trimesh",
        "plyfile",
        "huggingface_hub",
    )
    # TODO: kaolin, gsplat, pytorch3d, MoGe を追加
    # これらは複雑なビルドが必要なため、段階的に追加する
)

# チェックポイント用 Volume
checkpoint_volume = modal.Volume.from_name("sam3d-checkpoints", create_if_missing=True)

# ========================================
# 推論クラス
# ========================================

@app.cls(
    image=sam3d_image,
    gpu="A100",
    timeout=600,
    volumes={"/checkpoints": checkpoint_volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
class SAM3DInference:
    """SAM3D 推論クラス"""

    @modal.enter()
    def setup(self):
        """コンテナ起動時にモデルをロード"""
        import os

        # TODO: SAM3D モデルのロード
        # self.inference = Inference(config_path, compile=False)
        self.model_loaded = False
        print("SAM3D Inference: Setup complete (model loading pending)")

    @modal.method()
    def generate_3d(
        self,
        image_base64: str,
        mask_base64: str,
        output_format: str = "ply",
        seed: int = 42,
    ) -> dict:
        """
        画像とマスクから 3D モデルを生成

        Args:
            image_base64: Base64 エンコードされた RGB 画像
            mask_base64: Base64 エンコードされた マスク画像
            output_format: 出力形式 ("ply" or "glb")
            seed: 乱数シード

        Returns:
            dict: {
                "success": bool,
                "file_base64": str (生成されたファイルの Base64),
                "format": str,
                "message": str
            }
        """
        try:
            from PIL import Image
            import numpy as np

            # Base64 デコード
            image_bytes = base64.b64decode(image_base64)
            mask_bytes = base64.b64decode(mask_base64)

            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            mask = Image.open(io.BytesIO(mask_bytes)).convert("L")

            # TODO: SAM3D 推論を実行
            # output = self.inference(image, mask, seed=seed)
            # output["gs"].save_ply("output.ply")

            # プレースホルダー: ダミーレスポンス
            return {
                "success": False,
                "file_base64": "",
                "format": output_format,
                "message": "SAM3D model not yet loaded. This is a placeholder response.",
            }

        except Exception as e:
            return {
                "success": False,
                "file_base64": "",
                "format": output_format,
                "message": f"Error: {str(e)}",
            }


# ========================================
# HTTP エンドポイント
# ========================================

@app.function(image=sam3d_image)
@modal.web_endpoint(method="GET")
def health():
    """ヘルスチェック エンドポイント"""
    return {
        "status": "ok",
        "service": "sam3d-backend",
        "version": "0.1.0",
    }


@app.function(image=sam3d_image, gpu="A100", timeout=600)
@modal.web_endpoint(method="POST")
def generate(request: dict):
    """
    3D 生成エンドポイント

    Request Body:
        {
            "image": "base64_encoded_image",
            "mask": "base64_encoded_mask",
            "format": "ply" | "glb",
            "seed": 42
        }

    Response:
        {
            "success": bool,
            "file": "base64_encoded_file",
            "format": str,
            "message": str
        }
    """
    # CORS ヘッダーは Modal が自動で処理

    image_b64 = request.get("image", "")
    mask_b64 = request.get("mask", "")
    output_format = request.get("format", "ply")
    seed = request.get("seed", 42)

    if not image_b64 or not mask_b64:
        return {
            "success": False,
            "file": "",
            "format": output_format,
            "message": "Missing required fields: image and mask",
        }

    # TODO: SAM3DInference クラスを呼び出す
    # inference = SAM3DInference()
    # result = inference.generate_3d.remote(image_b64, mask_b64, output_format, seed)

    return {
        "success": False,
        "file": "",
        "format": output_format,
        "message": "Endpoint is ready. SAM3D integration pending.",
    }


# ========================================
# ローカルテスト用
# ========================================

@app.local_entrypoint()
def main():
    """ローカルテスト用エントリポイント"""
    print("SAM3D Backend - Local Test")
    print("=" * 40)

    # ヘルスチェック
    result = health.remote()
    print(f"Health Check: {result}")

    print("\nTo deploy:")
    print("  modal deploy backend/app.py")
    print("\nTo run locally:")
    print("  modal serve backend/app.py")
