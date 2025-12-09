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

import base64
import io
import os
from typing import Optional

import modal

# Modal App定義
app = modal.App("sam3d-generation-server")

# GPU種別（A100に変更）
GPU_TYPE = "A100"

# Docker イメージ定義（SAM3D依存関係）
sam3d_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.1.1-devel-ubuntu22.04",
        add_python="3.11"
    )
    .apt_install(
        "git", "wget", "libgl1-mesa-glx", "libglib2.0-0", 
        "libsm6", "libxext6", "libxrender-dev", "libgomp1",
        "build-essential", "ninja-build", "curl",
        "g++", "clang"  # PyTorch3D ビルド用コンパイラ
    )
    # PyTorch + CUDA (PyPI index使用)
    .pip_install(
        "torch==2.4.1+cu121",
        "torchvision==0.19.1+cu121",
        "torchaudio==2.4.1+cu121",
        extra_options="--index-url https://download.pytorch.org/whl/cu121"
    )
    # 基本依存関係 + SAM3D全依存関係 (PyTorch 2.4.1 との互換性維持)
    .pip_install(
        # 基本ライブラリ
        "numpy<2",
        "pillow",
        "fastapi[standard]",
        "pydantic",
        
        # SAM3D コア依存
        "omegaconf",
        "hydra-core",
        "einops",
        "einops-exts",
        "trimesh",
        "plyfile",
        "scipy",
        "scikit-image",
        "opencv-python-headless",
        "huggingface_hub",
        "safetensors",
        "accelerate",
        "transformers",
        "roma",
        "open3d",
        "lightning",
        "timm",
        
        # SAM3D inference依存
        "seaborn",
        "matplotlib",
        "gradio",
        "loguru",
        "optree",
        "astor",
        
        # PyTorch3D / Kaolin 依存
        "fvcore",
        "iopath",
        
        # Sparse Convolution (CUDA 12.1)
        "spconv-cu121",
        
        # 追加SAM3D依存
        "h5py",
        "easydict",
        "ftfy",
        "gdown",
        "rootutils",
        "point-cloud-utils",
        "xatlas",
        "pyrender",
        "pymeshfix",
        "python-igraph",  # SAM3D graph処理用
    )
    # xformers (torch 2.4.1 + CUDA 12.1 対応) - 別途インストールで依存関係を制御
    .pip_install(
        "xformers==0.0.28.post1",
        extra_options="--no-deps"
    )
    # wheel + setuptools (ビルド依存)
    .pip_install("wheel", "setuptools", "packaging")
    # flash-attention (CUDA develイメージでビルド)
    .run_commands(
        "pip install flash-attn==2.5.9.post1 --no-build-isolation"
    )
    # NVIDIA Kaolin (3D Deep Learning)
    .pip_install(
        "kaolin==0.17.0",
        extra_options="-f https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.4.1_cu121.html"
    )
    # PyTorch3D (ソースからビルド - torchが既にインストール済み)
    .run_commands(
        "MAX_JOBS=2 pip install --no-build-isolation 'git+https://github.com/facebookresearch/pytorch3d.git@stable'"
    )
    # SAM3D Objects - ソースクローンして依存関係なしでインストール
    .run_commands(
        "cd /root && git clone https://github.com/facebookresearch/sam-3d-objects.git",
        "cd /root/sam-3d-objects && pip install --no-deps -e .",
    )
    # MoGe 依存関係 (utils3d + pipeline の特定バージョン)
    # SAM3D Objectsが必要とするutils3dバージョン: depth_edge, normals_edge を含む
    .run_commands(
        "pip install 'git+https://github.com/EasternJournalist/utils3d.git@3913c65d81e05e47b9f367250cf8c0f7462a0900'",
        "pip install 'git+https://github.com/EasternJournalist/pipeline.git@866f059d2a05cde05e4a52211ec5051fd5f276d6' --no-deps",
    )
    # MoGe (深度推定用) - SAM3D Objectsが使用するバージョンと同じコミット
    .run_commands(
        "pip install 'git+https://github.com/microsoft/MoGe.git@a8c37341bc0325ca99b9d57981cc3bb2bd3e255b' --no-deps"
    )
    # gsplat (Gaussian Splatting rendering) - CUDA_HOME設定 + TORCH_CUDA_ARCH_LIST明示
    .run_commands(
        "TORCH_CUDA_ARCH_LIST='8.0' CUDA_HOME=/usr/local/cuda pip install 'git+https://github.com/nerfstudio-project/gsplat.git' --no-build-isolation"
    )
)

# 共有ボリューム（チェックポイント保存用）
volume = modal.Volume.from_name("sam3d-checkpoints", create_if_missing=True)
CHECKPOINT_PATH = "/checkpoints"


@app.cls(
    image=sam3d_image,
    gpu=GPU_TYPE,  # 環境変数GPU_TYPEで上書き可能
    timeout=600,
    volumes={CHECKPOINT_PATH: volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
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
        
        # CONDA_PREFIX環境変数のフォールバック（SAM3Dが参照する）
        if "CONDA_PREFIX" not in os.environ:
            os.environ["CONDA_PREFIX"] = "/usr/local"
        
        # HuggingFaceトークン設定（環境変数から取得）
        hf_token = os.environ.get("HF_TOKEN")
        if hf_token:
            from huggingface_hub import login
            login(token=hf_token)
            print("Logged in to HuggingFace")
        else:
            print("Warning: HF_TOKEN not set, using fallback checkpoints")
        
        # チェックポイントディレクトリ
        # HuggingFaceリポジトリ全体がダウンロードされるので、checkpoints/サブディレクトリを参照
        hf_repo_dir = f"{CHECKPOINT_PATH}/hf"
        checkpoint_dir = f"{hf_repo_dir}/checkpoints"
        download_success = False
        
        # 既にダウンロード済みかチェック (checkpointsサブディレクトリ内を確認)
        if os.path.exists(f"{checkpoint_dir}/pipeline.yaml"):
            print(f"Checkpoints already exist at {checkpoint_dir}")
            download_success = True
        elif hf_token:
            print("Downloading SAM3D checkpoints from HuggingFace...")
            try:
                snapshot_download(
                    repo_id="facebook/sam-3d-objects",
                    local_dir=hf_repo_dir,
                    token=hf_token,
                )
                volume.commit()
                print(f"Repository downloaded to {hf_repo_dir}")
                
                # ダウンロード後にディレクトリの内容を確認
                print(f"Listing {hf_repo_dir}/")
                for item in os.listdir(hf_repo_dir):
                    print(f"  {item}")
                
                # checkpointsサブディレクトリを確認
                if os.path.exists(checkpoint_dir):
                    print(f"Listing {checkpoint_dir}/")
                    for item in os.listdir(checkpoint_dir):
                        print(f"  {item}")
                    download_success = True
                else:
                    print(f"ERROR: checkpoints subdirectory not found at {checkpoint_dir}")
                    download_success = False
            except Exception as e:
                print(f"Failed to download checkpoints: {e}")
                download_success = False
        
        # ダウンロード成功時はそのディレクトリを使用
        if download_success:
            print(f"Using HuggingFace checkpoints: {checkpoint_dir}")
        else:
            # フォールバック: ローカルチェックポイント使用
            checkpoint_dir = "/root/sam-3d-objects/checkpoints/hf"
            print(f"Falling back to local checkpoints: {checkpoint_dir}")
            
            # ローカルチェックポイントが存在するか確認
            if not os.path.exists(checkpoint_dir):
                print(f"ERROR: Checkpoints directory not found: {checkpoint_dir}")
                print("Listing /root/sam-3d-objects/")
                for item in os.listdir("/root/sam-3d-objects/"):
                    print(f"  {item}")
                self.ready = False
                self.inference = None
                return
        
        # SAM3D Inferenceロード
        sys.path.insert(0, "/root/sam-3d-objects/notebook")
        self.error_message = None
        
        try:
            from inference import Inference
            config_path = f"{checkpoint_dir}/pipeline.yaml"
            print(f"Loading inference from config: {config_path}")
            
            if not os.path.exists(config_path):
                print(f"ERROR: Config file not found: {config_path}")
                print(f"Listing {checkpoint_dir}/")
                if os.path.exists(checkpoint_dir):
                    for item in os.listdir(checkpoint_dir):
                        print(f"  {item}")
                self.ready = False
                self.inference = None
                self.error_message = f"Config file not found: {config_path}"
                return
            
            self.inference = Inference(config_path, compile=False)
            self.ready = True
            print("SAM3D model loaded successfully!")
        except Exception as e:
            import traceback
            print(f"Failed to load SAM3D model: {e}")
            traceback.print_exc()
            self.ready = False
            self.inference = None
            self.error_message = str(e)
    
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
            "error_message": getattr(self, 'error_message', None),
        }
    
    @modal.method()
    def debug_info(self) -> dict:
        """詳細デバッグ情報"""
        import os
        import sys
        import torch
        
        debug = {
            "ready": getattr(self, 'ready', False),
            "error_message": getattr(self, 'error_message', None),
            "cuda_available": torch.cuda.is_available(),
            "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none",
            "hf_token_set": bool(os.environ.get("HF_TOKEN")),
            "checkpoints_exist": {},
            "notebook_path_exists": os.path.exists("/root/sam-3d-objects/notebook"),
            "inference_module_exists": os.path.exists("/root/sam-3d-objects/notebook/inference.py"),
        }
        
        # チェックポイントディレクトリの確認
        for path in [f"{CHECKPOINT_PATH}/hf", f"{CHECKPOINT_PATH}/hf/checkpoints", "/root/sam-3d-objects/checkpoints"]:
            if os.path.exists(path):
                try:
                    debug["checkpoints_exist"][path] = os.listdir(path)[:20]  # 最初の20アイテム
                except Exception as e:
                    debug["checkpoints_exist"][path] = f"Error: {e}"
            else:
                debug["checkpoints_exist"][path] = False
        
        # pipeline.yaml の存在確認
        for path in [f"{CHECKPOINT_PATH}/hf/checkpoints/pipeline.yaml", f"{CHECKPOINT_PATH}/hf/pipeline.yaml", "/root/sam-3d-objects/checkpoints/pipeline.yaml"]:
            debug[f"pipeline_exists_{path.replace('/', '_')}"] = os.path.exists(path)
        
        # sys.pathの確認
        debug["sys_path"] = sys.path[:10]
        
        return debug


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
        error_message: Optional[str] = None
    
    @api.get("/health", response_model=HealthResponse)
    async def health():
        generator = SAM3DGenerator()
        return generator.health_check.remote()
    
    @api.get("/debug")
    async def debug():
        """詳細デバッグ情報"""
        generator = SAM3DGenerator()
        return generator.debug_info.remote()
    
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
