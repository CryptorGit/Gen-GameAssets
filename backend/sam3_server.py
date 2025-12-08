"""
SAM3 Segmentation Server (Local)
=================================
ローカルPC上で動作するFastAPIベースのSAM3セグメンテーションサーバー
ノートPCのGPU（またはCPU）で動作可能

起動方法:
    cd backend
    python sam3_server.py

または:
    uvicorn sam3_server:app --host 0.0.0.0 --port 8001 --reload
"""

import os
import sys
import io
import base64
import logging
from typing import Optional
from contextlib import asynccontextmanager

import numpy as np
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# SAM3 パスを追加
SAM3_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sam3"))
if SAM3_PATH not in sys.path:
    sys.path.insert(0, SAM3_PATH)

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ========================================
# グローバル変数（モデルキャッシュ）
# ========================================
_model = None
_processor = None
_current_image_state = None
_current_image_hash = None
_sam3_available = False  # SAM3が利用可能かどうか


# ========================================
# リクエスト/レスポンス モデル
# ========================================

class SegmentationRequest(BaseModel):
    """セグメンテーションリクエスト"""
    image: str  # Base64エンコードされた画像
    points_positive: list[list[float]]  # [[x1, y1], [x2, y2], ...] 正例ポイント
    points_negative: list[list[float]] = []  # [[x1, y1], ...] 負例ポイント
    multimask_output: bool = False  # 複数マスク出力（True: 3マスク, False: 1マスク）


class SegmentationResponse(BaseModel):
    """セグメンテーションレスポンス"""
    success: bool
    masks: list[str] = []  # Base64エンコードされたマスク画像リスト
    scores: list[float] = []  # 各マスクのスコア
    message: str = ""


class SetImageRequest(BaseModel):
    """画像設定リクエスト"""
    image: str  # Base64エンコードされた画像


class SetImageResponse(BaseModel):
    """画像設定レスポンス"""
    success: bool
    image_size: list[int] = []  # [width, height]
    message: str = ""


class HealthResponse(BaseModel):
    """ヘルスチェックレスポンス"""
    status: str
    service: str
    version: str
    model_loaded: bool
    device: str


# ========================================
# モデル管理
# ========================================

def get_device():
    """利用可能なデバイスを取得"""
    import torch
    if torch.cuda.is_available():
        return "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    else:
        return "cpu"


def load_model():
    """SAMモデルをロード（SAM3 → SAM1 フォールバック）"""
    global _model, _processor, _sam3_available
    
    if _model is not None:
        logger.info("Model already loaded")
        return True
    
    device = get_device()
    
    # まずSAM3を試行
    try:
        import torch
        from sam3 import build_sam3_image_model
        from sam3.model.sam3_image_processor import Sam3Processor
        import sam3
        
        logger.info(f"Loading SAM3 model on device: {device}")
        
        if device == "cuda":
            torch.backends.cuda.matmul.allow_tf32 = True
            torch.backends.cudnn.allow_tf32 = True
            torch.autocast("cuda", dtype=torch.bfloat16).__enter__()
        
        sam3_root = os.path.dirname(sam3.__file__)
        bpe_path = os.path.join(sam3_root, "..", "assets", "bpe_simple_vocab_16e6.txt.gz")
        
        if not os.path.exists(bpe_path):
            bpe_path = os.path.join(SAM3_PATH, "assets", "bpe_simple_vocab_16e6.txt.gz")
        
        _model = build_sam3_image_model(bpe_path=bpe_path, enable_inst_interactivity=True)
        _processor = Sam3Processor(_model)
        _sam3_available = True
        
        logger.info("SAM3 model loaded successfully!")
        return True
        
    except ImportError as ie:
        logger.warning(f"SAM3 not available: {ie}")
    except Exception as e:
        logger.warning(f"SAM3 failed to load: {e}")
    
    # SAM3が使えない場合、SAM1（オリジナル）を試行
    try:
        import torch
        from segment_anything import sam_model_registry, SamPredictor
        
        logger.info(f"Loading SAM1 model on device: {device}")
        
        # チェックポイントパス
        checkpoint_dir = os.path.join(os.path.dirname(__file__), "checkpoints")
        checkpoint_path = os.path.join(checkpoint_dir, "sam_vit_b_01ec64.pth")
        
        if not os.path.exists(checkpoint_path):
            logger.warning(f"SAM1 checkpoint not found: {checkpoint_path}")
            logger.info("Running in fallback mode (no segmentation)")
            _sam3_available = False
            return False
        
        sam = sam_model_registry["vit_b"](checkpoint=checkpoint_path)
        sam.to(device=device)
        
        _model = sam
        _processor = SamPredictor(sam)
        _sam3_available = True
        
        logger.info("SAM1 model loaded successfully!")
        return True
        
    except ImportError as ie:
        logger.warning(f"SAM1 not available: {ie}")
    except Exception as e:
        logger.error(f"SAM1 failed to load: {e}")
        import traceback
        traceback.print_exc()
    
    logger.info("Running in fallback mode (no segmentation)")
    _sam3_available = False
    return False


def decode_base64_image(base64_str: str) -> Image.Image:
    """Base64文字列をPIL Imageに変換"""
    # data:image/xxx;base64, プレフィックスを除去
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    
    image_bytes = base64.b64decode(base64_str)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return image


def encode_mask_to_base64(mask: np.ndarray) -> str:
    """マスク配列をBase64エンコードされたPNG画像に変換"""
    # マスクを0-255のuint8に変換
    if mask.dtype == bool:
        mask_uint8 = (mask * 255).astype(np.uint8)
    else:
        mask_uint8 = (mask > 0.5).astype(np.uint8) * 255
    
    # PIL Imageに変換
    mask_image = Image.fromarray(mask_uint8, mode="L")
    
    # PNGとしてエンコード
    buffer = io.BytesIO()
    mask_image.save(buffer, format="PNG")
    buffer.seek(0)
    
    return base64.b64encode(buffer.read()).decode("utf-8")


def get_image_hash(image: Image.Image) -> str:
    """画像のハッシュを計算（キャッシュ用）"""
    import hashlib
    # 画像をバイト列に変換してハッシュ
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return hashlib.md5(buffer.getvalue()).hexdigest()


# ========================================
# FastAPI アプリケーション
# ========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションのライフサイクル管理"""
    # 起動時：モデルをロード
    logger.info("Starting SAM3 Segmentation Server...")
    load_model()
    yield
    # シャットダウン時
    logger.info("Shutting down SAM3 Segmentation Server...")


app = FastAPI(
    title="SAM3 Segmentation Server",
    description="ローカルPCで動作するSAM3セグメンテーションAPI",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS設定（フロントエンドからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開発環境用。本番では制限すること
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========================================
# エンドポイント
# ========================================

@app.get("/health", response_model=HealthResponse)
async def health():
    """ヘルスチェック"""
    return HealthResponse(
        status="ok" if _sam3_available else "fallback",
        service="sam3-segmentation-server",
        version="0.1.0",
        model_loaded=_model is not None and _sam3_available,
        device=get_device() if _sam3_available else "none",
    )


@app.post("/set_image", response_model=SetImageResponse)
async def set_image(request: SetImageRequest):
    """
    セグメンテーション対象の画像を設定
    
    画像のエンベディングを計算してキャッシュします。
    同じ画像に対して複数回のセグメンテーションを行う場合、
    このAPIを先に呼んでおくと効率的です。
    """
    global _current_image_state, _current_image_hash
    
    # SAM3が利用できない場合はスキップ
    if not _sam3_available or _model is None or _processor is None:
        try:
            image = decode_base64_image(request.image)
            return SetImageResponse(
                success=True,
                image_size=[image.width, image.height],
                message="SAM3 not available, using fallback mode",
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    try:
        # 画像デコード
        image = decode_base64_image(request.image)
        image_hash = get_image_hash(image)
        
        # 既にキャッシュ済みの場合はスキップ
        if _current_image_hash == image_hash:
            logger.info("Image already cached, skipping embedding computation")
            return SetImageResponse(
                success=True,
                image_size=[image.width, image.height],
                message="Image already cached",
            )
        
        # 画像エンベディングを計算
        logger.info(f"Computing embeddings for image: {image.width}x{image.height}")
        
        # SAM1 (SamPredictor) の場合
        from segment_anything import SamPredictor
        if isinstance(_processor, SamPredictor):
            # SAM1: set_image() は numpy array を受け取る
            image_np = np.array(image)
            _processor.set_image(image_np)
            _current_image_state = True  # フラグとして使用
        else:
            # SAM3
            _current_image_state = _processor.set_image(image)
        
        _current_image_hash = image_hash
        
        return SetImageResponse(
            success=True,
            image_size=[image.width, image.height],
            message="Image embeddings computed successfully",
        )
        
    except Exception as e:
        logger.error(f"Error setting image: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/segment", response_model=SegmentationResponse)
async def segment(request: SegmentationRequest):
    """
    ポイントプロンプトによるセグメンテーション
    
    画像とポイント座標を受け取り、マスクを生成して返します。
    
    Args:
        image: Base64エンコードされた画像
        points_positive: 正例ポイント [[x1, y1], [x2, y2], ...]
        points_negative: 負例ポイント [[x1, y1], ...]
        multimask_output: True=3マスク出力, False=1マスク出力
    
    Returns:
        masks: Base64エンコードされたマスク画像のリスト
        scores: 各マスクのスコア
    """
    global _current_image_state, _current_image_hash
    
    # SAM3が利用できない場合はフォールバックマスクを生成
    if not _sam3_available or _model is None or _processor is None:
        return generate_fallback_mask(request)
    
    try:
        import torch
        
        # 画像デコード
        image = decode_base64_image(request.image)
        image_hash = get_image_hash(image)
        
        # 画像が変更された場合はエンベディングを再計算
        if _current_image_hash != image_hash:
            logger.info("New image detected, computing embeddings...")
            
            # SAM1 (SamPredictor) の場合
            from segment_anything import SamPredictor
            if isinstance(_processor, SamPredictor):
                image_np = np.array(image)
                _processor.set_image(image_np)
                _current_image_state = True
            else:
                _current_image_state = _processor.set_image(image)
            
            _current_image_hash = image_hash
        
        # ポイント座標を準備
        all_points = request.points_positive + request.points_negative
        if len(all_points) == 0:
            return SegmentationResponse(
                success=False,
                message="No points provided",
            )
        
        point_coords = np.array(all_points)
        point_labels = np.array(
            [1] * len(request.points_positive) + [0] * len(request.points_negative)
        )
        
        logger.info(f"Segmenting with {len(request.points_positive)} positive, {len(request.points_negative)} negative points")
        
        # セグメンテーション実行
        with torch.inference_mode():
            # SAM1 (SamPredictor) の場合
            from segment_anything import SamPredictor
            if isinstance(_processor, SamPredictor):
                # SAM1 API: predict()
                masks, scores, logits = _processor.predict(
                    point_coords=point_coords,
                    point_labels=point_labels,
                    multimask_output=request.multimask_output,
                )
            else:
                # SAM3 API: predict_inst()
                masks, scores, logits = _model.predict_inst(
                    _current_image_state,
                    point_coords=point_coords,
                    point_labels=point_labels,
                    multimask_output=request.multimask_output,
                )
        
        # スコア順にソート
        sorted_indices = np.argsort(scores)[::-1]
        masks = masks[sorted_indices]
        scores = scores[sorted_indices]
        
        # マスクをBase64エンコード
        encoded_masks = [encode_mask_to_base64(mask) for mask in masks]
        
        return SegmentationResponse(
            success=True,
            masks=encoded_masks,
            scores=scores.tolist(),
            message=f"Generated {len(masks)} mask(s)",
        )
        
    except Exception as e:
        logger.error(f"Error during segmentation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def generate_fallback_mask(request: SegmentationRequest) -> SegmentationResponse:
    """SAM3が利用できない場合のフォールバックマスク生成"""
    try:
        # 画像デコード
        image = decode_base64_image(request.image)
        width, height = image.size
        
        # ポイント座標を準備
        all_points = request.points_positive + request.points_negative
        if len(all_points) == 0:
            return SegmentationResponse(
                success=False,
                message="No points provided",
            )
        
        # フォールバックマスク生成（円形マスク）
        mask = np.zeros((height, width), dtype=np.uint8)
        
        for pt in request.points_positive:
            x, y = int(pt[0]), int(pt[1])
            # 画像サイズに比例した半径
            radius = int(min(width, height) * 0.15)
            y_grid, x_grid = np.ogrid[:height, :width]
            dist = np.sqrt((x_grid - x) ** 2 + (y_grid - y) ** 2)
            mask[dist <= radius] = 255
        
        for pt in request.points_negative:
            x, y = int(pt[0]), int(pt[1])
            radius = int(min(width, height) * 0.1)
            y_grid, x_grid = np.ogrid[:height, :width]
            dist = np.sqrt((x_grid - x) ** 2 + (y_grid - y) ** 2)
            mask[dist <= radius] = 0
        
        # マスクをエンコード
        encoded_mask = encode_mask_to_base64(mask)
        
        return SegmentationResponse(
            success=True,
            masks=[encoded_mask],
            scores=[0.5],  # フォールバックスコア
            message="Fallback mask generated (SAM3 not available)",
        )
        
    except Exception as e:
        logger.error(f"Error generating fallback mask: {e}")
        return SegmentationResponse(
            success=False,
            message=str(e),
        )


@app.post("/segment_with_text", response_model=SegmentationResponse)
async def segment_with_text(image: str, prompt: str, confidence_threshold: float = 0.5):
    """
    テキストプロンプトによるセグメンテーション
    
    Args:
        image: Base64エンコードされた画像
        prompt: テキストプロンプト (例: "person", "dog", "car")
        confidence_threshold: 信頼度閾値
    
    Returns:
        masks: Base64エンコードされたマスク画像のリスト
        scores: 各マスクのスコア
    """
    global _current_image_state, _current_image_hash
    
    if _model is None or _processor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # 画像デコード
        pil_image = decode_base64_image(image)
        image_hash = get_image_hash(pil_image)
        
        # 画像が変更された場合はエンベディングを再計算
        if _current_image_hash != image_hash:
            logger.info("New image detected, computing embeddings...")
            _current_image_state = _processor.set_image(pil_image)
            _current_image_hash = image_hash
        
        # テキストプロンプトでセグメンテーション
        logger.info(f"Segmenting with text prompt: '{prompt}'")
        _processor.reset_all_prompts(_current_image_state)
        output = _processor.set_text_prompt(
            state=_current_image_state,
            prompt=prompt,
        )
        
        masks = output.get("masks", [])
        scores = output.get("scores", [])
        
        if len(masks) == 0:
            return SegmentationResponse(
                success=True,
                masks=[],
                scores=[],
                message="No objects found matching the prompt",
            )
        
        # 信頼度でフィルタリング
        filtered_masks = []
        filtered_scores = []
        for mask, score in zip(masks, scores):
            if score >= confidence_threshold:
                filtered_masks.append(encode_mask_to_base64(mask))
                filtered_scores.append(float(score))
        
        return SegmentationResponse(
            success=True,
            masks=filtered_masks,
            scores=filtered_scores,
            message=f"Found {len(filtered_masks)} object(s)",
        )
        
    except Exception as e:
        logger.error(f"Error during text segmentation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# メイン
# ========================================

if __name__ == "__main__":
    import uvicorn
    
    # 環境変数からポートを取得（デフォルト: 8001）
    port = int(os.environ.get("SAM3_PORT", "8001"))
    
    print("=" * 60)
    print("SAM3 Segmentation Server")
    print("=" * 60)
    print(f"Starting server on http://0.0.0.0:{port}")
    print(f"API docs: http://localhost:{port}/docs")
    print("=" * 60)
    
    # カレントディレクトリをスクリプトの場所に変更
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # 開発モードかどうかをチェック
    dev_mode = os.environ.get("SAM3_DEV", "0") == "1"
    
    uvicorn.run(
        "sam3_server:app" if dev_mode else app,
        host="0.0.0.0",
        port=port,
        reload=dev_mode,
        reload_dirs=[os.path.dirname(os.path.abspath(__file__))] if dev_mode else None,
        log_level="info",
    )
