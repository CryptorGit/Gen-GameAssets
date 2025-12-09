"""
バッチ3Dモデル生成スクリプト

使用方法:
    python batch_generate.py --input ./masks --output ./models

入力フォルダ構成:
    masks/
        original_image.png          # 元画像
        Object_1_mask.png           # マスク画像
        Object_2_mask.png           # マスク画像
        ...

または:
    masks/
        image1.png                  # 元画像
        image1_mask.png             # 対応するマスク
        image2.png
        image2_mask.png
        ...

出力:
    models/
        Object_1.ply
        Object_2.ply
        ...
"""

import argparse
import base64
import os
import sys
import time
from pathlib import Path
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

# Modal SAM3D サーバーURL
DEFAULT_SERVER_URL = "https://cryptor--sam3d-generation-server-web-app.modal.run"


def load_image_as_base64(path: Path) -> str:
    """画像ファイルをBase64エンコードして返す"""
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def save_model_from_base64(data: str, path: Path):
    """Base64エンコードされたモデルデータをファイルに保存"""
    with open(path, "wb") as f:
        f.write(base64.b64decode(data))


def find_image_mask_pairs(input_dir: Path) -> list[tuple[Path, Path, str]]:
    """
    入力フォルダから画像とマスクのペアを探す
    
    Returns:
        List of (image_path, mask_path, name) tuples
    """
    pairs = []
    
    # パターン1: original_image.png + Object_X_mask.png
    original = input_dir / "original_image.png"
    if not original.exists():
        # 他の一般的な名前も試す
        for name in ["original.png", "image.png", "source.png"]:
            alt = input_dir / name
            if alt.exists():
                original = alt
                break
    
    if original.exists():
        # original_image があれば、*_mask.png をすべて見つける
        for mask_path in input_dir.glob("*_mask.png"):
            # マスクファイル名からオブジェクト名を取得
            name = mask_path.stem.replace("_mask", "")
            if name != "original_image" and name != "original":
                pairs.append((original, mask_path, name))
    
    # パターン2: image.png + image_mask.png のペア
    if not pairs:
        for img_path in input_dir.glob("*.png"):
            if "_mask" in img_path.stem:
                continue
            mask_path = input_dir / f"{img_path.stem}_mask.png"
            if mask_path.exists():
                pairs.append((img_path, mask_path, img_path.stem))
    
    # パターン3: JPGも対応
    if not pairs:
        for img_path in input_dir.glob("*.jpg"):
            mask_path = input_dir / f"{img_path.stem}_mask.png"
            if mask_path.exists():
                pairs.append((img_path, mask_path, img_path.stem))
    
    return pairs


def generate_3d(
    image_path: Path,
    mask_path: Path,
    name: str,
    output_dir: Path,
    server_url: str,
    output_format: str = "ply",
    seed: int = 42,
) -> dict:
    """
    1つの画像+マスクペアから3Dモデルを生成
    """
    print(f"  Processing: {name}")
    
    try:
        # 画像をBase64エンコード
        image_b64 = load_image_as_base64(image_path)
        mask_b64 = load_image_as_base64(mask_path)
        
        # サーバーにリクエスト
        start_time = time.time()
        response = requests.post(
            f"{server_url}/generate",
            json={
                "image": image_b64,
                "mask": mask_b64,
                "seed": seed,
                "output_format": output_format,
            },
            timeout=300,  # 5分タイムアウト
        )
        elapsed = time.time() - start_time
        
        if response.status_code != 200:
            return {
                "name": name,
                "success": False,
                "error": f"HTTP {response.status_code}: {response.text[:200]}",
            }
        
        result = response.json()
        
        if not result.get("success"):
            return {
                "name": name,
                "success": False,
                "error": result.get("error", "Unknown error"),
            }
        
        # モデルを保存
        output_path = output_dir / f"{name}.{output_format}"
        save_model_from_base64(result["model_data"], output_path)
        
        # ファイルサイズを取得
        file_size = output_path.stat().st_size / (1024 * 1024)  # MB
        
        return {
            "name": name,
            "success": True,
            "output_path": str(output_path),
            "file_size_mb": round(file_size, 2),
            "elapsed_seconds": round(elapsed, 1),
        }
        
    except requests.exceptions.Timeout:
        return {
            "name": name,
            "success": False,
            "error": "Request timeout (5 min)",
        }
    except Exception as e:
        return {
            "name": name,
            "success": False,
            "error": str(e),
        }


def check_server_health(server_url: str) -> bool:
    """サーバーの健全性をチェック"""
    try:
        response = requests.get(f"{server_url}/health", timeout=120)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Server OK: {data.get('gpu', 'Unknown GPU')}")
            return True
        else:
            print(f"✗ Server error: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Cannot connect to server: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Batch generate 3D models from images and masks using Modal SAM3D server"
    )
    parser.add_argument(
        "--input", "-i",
        type=str,
        required=True,
        help="Input folder containing images and masks",
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        required=True,
        help="Output folder for 3D models",
    )
    parser.add_argument(
        "--server",
        type=str,
        default=DEFAULT_SERVER_URL,
        help=f"SAM3D server URL (default: {DEFAULT_SERVER_URL})",
    )
    parser.add_argument(
        "--format", "-f",
        type=str,
        choices=["ply", "glb"],
        default="ply",
        help="Output format (default: ply)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for generation (default: 42)",
    )
    parser.add_argument(
        "--parallel", "-p",
        type=int,
        default=1,
        help="Number of parallel requests (default: 1, Modal may limit concurrency)",
    )
    
    args = parser.parse_args()
    
    input_dir = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    
    # 入力フォルダ確認
    if not input_dir.exists():
        print(f"Error: Input folder not found: {input_dir}")
        sys.exit(1)
    
    # 出力フォルダ作成
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n{'='*60}")
    print("SAM3D Batch 3D Generation")
    print(f"{'='*60}")
    print(f"Input:  {input_dir}")
    print(f"Output: {output_dir}")
    print(f"Server: {args.server}")
    print(f"Format: {args.format}")
    print()
    
    # サーバー確認
    print("Checking server health...")
    if not check_server_health(args.server):
        print("\nServer is not available. Please ensure the Modal server is running.")
        print("Run: modal deploy backend/sam3d_modal.py")
        sys.exit(1)
    print()
    
    # 画像+マスクのペアを探す
    pairs = find_image_mask_pairs(input_dir)
    
    if not pairs:
        print("Error: No image+mask pairs found in input folder.")
        print("\nExpected formats:")
        print("  1. original_image.png + Object_1_mask.png, Object_2_mask.png, ...")
        print("  2. image.png + image_mask.png pairs")
        sys.exit(1)
    
    print(f"Found {len(pairs)} image+mask pairs:")
    for img, mask, name in pairs:
        print(f"  - {name}: {img.name} + {mask.name}")
    print()
    
    # 生成実行
    print("Starting generation...")
    results = []
    
    if args.parallel > 1:
        # 並列処理
        with ThreadPoolExecutor(max_workers=args.parallel) as executor:
            futures = {
                executor.submit(
                    generate_3d, img, mask, name, output_dir, 
                    args.server, args.format, args.seed
                ): name
                for img, mask, name in pairs
            }
            for future in as_completed(futures):
                result = future.result()
                results.append(result)
    else:
        # 順次処理
        for img, mask, name in pairs:
            result = generate_3d(
                img, mask, name, output_dir,
                args.server, args.format, args.seed
            )
            results.append(result)
    
    # 結果サマリー
    print(f"\n{'='*60}")
    print("Results")
    print(f"{'='*60}")
    
    success_count = 0
    for result in results:
        if result["success"]:
            success_count += 1
            print(f"✓ {result['name']}: {result['file_size_mb']} MB ({result['elapsed_seconds']}s)")
        else:
            print(f"✗ {result['name']}: {result['error']}")
    
    print()
    print(f"Completed: {success_count}/{len(pairs)} successful")
    print(f"Output folder: {output_dir}")


if __name__ == "__main__":
    main()
