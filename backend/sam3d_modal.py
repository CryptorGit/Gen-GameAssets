"""
SAM3D 3D Generation Server (Modal)
==================================
Modal上のGPUで動作するSAM3D 3Dモデル生成サーバー

使用方法:
    # ローカルテスト
    modal run sam3d_modal.py
    
    # デプロイ
    modal deploy sam3d_modal.py
"""

import modal
import io
import base64
from typing import Optional

# Modal App定義
app = modal.App("sam3d-generation-server")

# Docker イメージ定義（SAM3D依存関係）
sam3d_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install(
        "git", "wget", "libgl1-mesa-glx", "libglib2.0-0", 
        "libsm6", "libxext6", "libxrender-dev", "libgomp1"
    )
    .pip_install(
        "torch>=2.4.0",
        "torchvision",
        "numpy",
        "pillow",
        "fastapi[standard]",
        "pydantic",
        "omegaconf",
        "hydra-core",
        "einops",
        "trimesh",
        "plyfile",
        "scipy",
        "scikit-image",
        "opencv-python-headless",
        "huggingface_hub",
        "safetensors",
        "accelerate",
        "transformers",
    )
    # PyTorch3D (CUDA対応版)
    .pip_install(
        "pytorch3d",
        extra_options="--extra-index-url https://dl.fbaipublicfiles.com/pytorch3d/packaging/wheels/py312_cu121_pyt241/download.html"
    )
    # SAM3D Objects
    .run_commands(
        "pip install git+https://github.com/facebookresearch/sam-3d-objects.git"
    )
)

# 共有ボリューム（チェックポイント保存用）
volume = modal.Volume.from_name("sam3d-checkpoints", create_if_missing=True)
CHECKPOINT_PATH = "/checkpoints"


@app.cls(
    image=sam3d_image,
    gpu="A10G",  # A10G GPU (24GB VRAM)
    timeout=600,
    volumes={CHECKPOINT_PATH: volume},
    secrets=[modal.Secret.from_name("huggingface-secret", required=False)],
)
class SAM3DGenerator:
    """SAM3D 3Dモデル生成クラス"""
    
    @modal.enter()
    def setup(self):
        """モデルの初期化"""
        import os
        import sys
        import torch
        from huggingface_hub import hf_hub_download, snapshot_download
        
        print("Setting up SAM3D Generator...")
        
        # HuggingFaceトークン設定
        hf_token = os.environ.get("HF_TOKEN")
        if hf_token:
            from huggingface_hub import login
            login(token=hf_token)
        
        # チェックポイントダウンロード
        checkpoint_dir = f"{CHECKPOINT_PATH}/hf"
        if not os.path.exists(f"{checkpoint_dir}/pipeline.yaml"):
            print("Downloading SAM3D checkpoints...")
            try:
                snapshot_download(
                    repo_id="facebook/sam-3d-objects",
                    local_dir=checkpoint_dir,
                    token=hf_token,
                )
                volume.commit()
            except Exception as e:
                print(f"Failed to download checkpoints: {e}")
                # フォールバック: ローカルチェックポイント使用
                checkpoint_dir = "/root/sam-3d-objects/checkpoints/hf"
        
        # SAM3D Inferenceロード
        sys.path.insert(0, "/root/sam-3d-objects/notebook")
        
        try:
            from inference import Inference
            config_path = f"{checkpoint_dir}/pipeline.yaml"
            self.inference = Inference(config_path, compile=False)
            self.ready = True
            print("SAM3D model loaded successfully!")
        except Exception as e:
            print(f"Failed to load SAM3D model: {e}")
            self.ready = False
            self.inference = None
    
    @modal.method()
    def generate_3d(
        self,
        image_base64: str,
        mask_base64: str,
        seed: int = 42,
        output_format: str = "ply",  # "ply" or "glb"
    ) -> dict:
        """
        3Dモデルを生成
        
        Args:
            image_base64: Base64エンコードされた元画像
            mask_base64: Base64エンコードされたマスク画像
            seed: ランダムシード
            output_format: 出力形式 ("ply" or "glb")
        
        Returns:
            dict: {
                "success": bool,
                "model_data": str (Base64エンコードされた3Dモデル),
                "format": str,
                "message": str
            }
        """
        import numpy as np
        from PIL import Image
        import io
        import tempfile
        
        if not self.ready or self.inference is None:
            return {
                "success": False,
                "model_data": "",
                "format": output_format,
                "message": "SAM3D model not loaded"
            }
        
        try:
            # Base64デコード
            def decode_image(b64_str):
                if "," in b64_str:
                    b64_str = b64_str.split(",")[1]
                img_bytes = base64.b64decode(b64_str)
                return Image.open(io.BytesIO(img_bytes))
            
            image = decode_image(image_base64)
            mask_img = decode_image(mask_base64)
            
            # 画像をnumpy配列に変換
            image_np = np.array(image.convert("RGB"))
            
            # マスクをバイナリに変換
            mask_np = np.array(mask_img.convert("L"))
            mask_binary = (mask_np > 127).astype(np.uint8)
            
            print(f"Input image size: {image_np.shape}")
            print(f"Mask size: {mask_binary.shape}")
            
            # SAM3D推論実行
            output = self.inference(image_np, mask_binary, seed=seed)
            
            # 3Dモデルをエクスポート
            with tempfile.TemporaryDirectory() as tmpdir:
                if output_format == "ply":
                    output_path = f"{tmpdir}/output.ply"
                    output["gs"].save_ply(output_path)
                else:
                    # GLBエクスポート（meshがある場合）
                    output_path = f"{tmpdir}/output.glb"
                    if "mesh" in output and output["mesh"] is not None:
                        output["mesh"].export(output_path)
                    else:
                        # PLYにフォールバック
                        output_path = f"{tmpdir}/output.ply"
                        output["gs"].save_ply(output_path)
                        output_format = "ply"
                
                # ファイルをBase64エンコード
                with open(output_path, "rb") as f:
                    model_data = base64.b64encode(f.read()).decode("utf-8")
            
            return {
                "success": True,
                "model_data": model_data,
                "format": output_format,
                "message": "3D model generated successfully"
            }
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "model_data": "",
                "format": output_format,
                "message": str(e)
            }
    
    @modal.method()
    def health_check(self) -> dict:
        """ヘルスチェック"""
        import torch
        return {
            "status": "ok" if self.ready else "error",
            "service": "sam3d-generation-server",
            "model_loaded": self.ready,
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none",
            "cuda_available": torch.cuda.is_available(),
        }


# FastAPI Web エンドポイント
@app.function(
    image=sam3d_image,
    timeout=600,
)
@modal.asgi_app()
def web_app():
    """FastAPI Web アプリケーション"""
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    
    api = FastAPI(
        title="SAM3D 3D Generation API",
        description="SAM3D Objects を使った3Dモデル生成API",
        version="0.1.0",
    )
    
    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    class GenerateRequest(BaseModel):
        image: str  # Base64エンコードされた画像
        mask: str   # Base64エンコードされたマスク
        seed: int = 42
        output_format: str = "ply"
    
    class GenerateResponse(BaseModel):
        success: bool
        model_data: str = ""
        format: str = "ply"
        message: str = ""
    
    class HealthResponse(BaseModel):
        status: str
        service: str
        model_loaded: bool
        gpu: str
        cuda_available: bool
    
    @api.get("/health", response_model=HealthResponse)
    async def health():
        generator = SAM3DGenerator()
        return generator.health_check.remote()
    
    @api.post("/generate", response_model=GenerateResponse)
    async def generate(request: GenerateRequest):
        generator = SAM3DGenerator()
        result = generator.generate_3d.remote(
            image_base64=request.image,
            mask_base64=request.mask,
            seed=request.seed,
            output_format=request.output_format,
        )
        return result
    
    @api.get("/")
    async def root():
        return {"message": "SAM3D 3D Generation API", "docs": "/docs"}
    
    return api


# ローカルテスト用
@app.local_entrypoint()
def main():
    """ローカルテスト"""
    print("Testing SAM3D Generator...")
    
    generator = SAM3DGenerator()
    health = generator.health_check.remote()
    print(f"Health: {health}")
    
    # テスト画像でテスト（オプション）
    # result = generator.generate_3d.remote(
    #     image_base64="...",
    #     mask_base64="...",
    #     seed=42,
    #     output_format="ply"
    # )
    # print(f"Result: {result}")
