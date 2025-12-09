# SAM3D Modal Deployment ガイド

## 概要

SAM3D 3Dモデル生成サーバーを Modal クラウドプラットフォームにデプロイするための技術メモ。

## 解決した問題一覧

### 1. Kaolin undefined symbol エラー

**問題**: `undefined symbol: _ZN3c1017RegisterOperatorsD1Ev`

**原因**: PyTorch より先に Kaolin がインストールされていた

**解決策**: PyTorch を最初にインストールしてから Kaolin をインストール

```python
.pip_install(
    "torch==2.4.1+cu121",
    "torchvision==0.19.1+cu121", 
    extra_index_url="https://download.pytorch.org/whl/cu121"
)
.pip_install(
    "kaolin==0.17.0",
    extra_options="-f https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.4.1_cu121.html"
)
```

### 2. flash-attn ビルド失敗

**問題**: `nvcc not found` / `wheel` パッケージがない

**原因**: 
- 標準の Python イメージには CUDA コンパイラ (nvcc) がない
- wheel パッケージが未インストール

**解決策**: NVIDIA CUDA devel ベースイメージを使用

```python
sam3d_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.1.1-devel-ubuntu22.04",
        add_python="3.11"
    )
    .apt_install("git", "build-essential", "ninja-build", "clang", "g++")
    .pip_install("wheel", "setuptools", "packaging")
    .run_commands(
        "pip install flash-attn==2.5.9.post1 --no-build-isolation"
    )
)
```

### 3. pytorch3d "clang++ not found"

**問題**: pytorch3d のビルド時に clang++ が見つからない

**解決策**: apt_install に `clang` を追加

```python
.apt_install("git", "build-essential", "ninja-build", "clang", "g++")
```

### 4. gsplat CUDA アーキテクチャ検出失敗

**問題**: `RuntimeError: CUDA error: invalid device ordinal` (ビルド時)

**原因**: Modal のビルド環境では GPU が利用できず、CUDA アーキテクチャを自動検出できない

**解決策**: `TORCH_CUDA_ARCH_LIST` を明示的に設定

```python
.run_commands(
    "TORCH_CUDA_ARCH_LIST='8.0' CUDA_HOME=/usr/local/cuda pip install 'git+https://github.com/nerfstudio-project/gsplat.git' --no-build-isolation"
)
```

**注意**: A100 GPU は compute capability 8.0

### 5. igraph missing

**問題**: `ModuleNotFoundError: No module named 'igraph'`

**解決策**: `python-igraph` を pip_install に追加

```python
.pip_install("python-igraph")
```

### 6. utils3d.numpy の depth_edge インポートエラー ⭐重要

**問題**: `cannot import name 'depth_edge' from 'utils3d.numpy'`

**原因**: 
- SAM3D Objects の `sam3d_objects/utils/visualization/image_mesh.py` が `depth_edge` と `normals_edge` をインポート
- 間違った utils3d バージョンを使用していた
- 最新の utils3d では関数名が `depth_map_edge` に変更されている

**調査方法**:
1. SAM3D Objects の requirements.txt を確認 → MoGe のコミットハッシュを発見
2. そのMoGeコミットの pyproject.toml を確認 → utils3d のコミットハッシュを発見
3. 正しい utils3d バージョンの `__init__.py` を確認 → `depth_edge` がエクスポートされていることを確認

**正しいバージョン**:
```python
# SAM3D Objects requirements.txt より
MoGe @ git+https://github.com/microsoft/MoGe.git@a8c37341bc0325ca99b9d57981cc3bb2bd3e255b

# このMoGeバージョンが依存するutils3d
utils3d @ git+https://github.com/EasternJournalist/utils3d.git@3913c65d81e05e47b9f367250cf8c0f7462a0900
```

**解決策**:
```python
.run_commands(
    # SAM3D Objectsが必要とするutils3dバージョン: depth_edge, normals_edge を含む
    "pip install 'git+https://github.com/EasternJournalist/utils3d.git@3913c65d81e05e47b9f367250cf8c0f7462a0900'",
    "pip install 'git+https://github.com/EasternJournalist/pipeline.git@866f059d2a05cde05e4a52211ec5051fd5f276d6' --no-deps",
)
.run_commands(
    # SAM3D Objectsが使用するMoGeバージョン
    "pip install 'git+https://github.com/microsoft/MoGe.git@a8c37341bc0325ca99b9d57981cc3bb2bd3e255b' --no-deps"
)
```

## 最終的なイメージビルド順序

1. **ベースイメージ**: `nvidia/cuda:12.1.1-devel-ubuntu22.04` + Python 3.11
2. **システムパッケージ**: git, build-essential, ninja-build, clang, g++
3. **PyTorch**: torch 2.4.1+cu121, torchvision 0.19.1+cu121
4. **基本依存関係**: pip_install で大量のパッケージ
5. **xformers**: 0.0.28.post1 (--no-deps)
6. **wheel, setuptools, packaging**: ビルド依存
7. **flash-attn**: 2.5.9.post1 (--no-build-isolation)
8. **kaolin**: 0.17.0 (NVIDIA S3 から)
9. **pytorch3d**: stable (GitHub からソースビルド)
10. **SAM3D Objects**: GitHub クローン → pip install --no-deps -e .
11. **utils3d**: 特定コミット `3913c65d...`
12. **pipeline**: 特定コミット `866f059d...`
13. **MoGe**: 特定コミット `a8c3734...` (--no-deps)
14. **gsplat**: TORCH_CUDA_ARCH_LIST='8.0' で明示的にビルド

## 重要なポイント

### バージョン互換性
- すべてのパッケージは **PyTorch 2.4.1 + CUDA 12.1** に合わせる
- SAM3D Objects が依存するパッケージは、SAM3D の requirements.txt で指定されたコミットハッシュを使用

### --no-deps フラグ
複数のパッケージで `--no-deps` を使用している理由:
- 依存関係の競合を避ける
- 既にインストール済みのパッケージを上書きしない
- インストール順序を明示的に制御

### GPU アーキテクチャ
Modal では A100 GPU (compute capability 8.0) を使用。ビルド時に GPU が利用できないため、`TORCH_CUDA_ARCH_LIST='8.0'` を明示的に設定する必要がある。

## エンドポイント

- **URL**: `https://cryptor--sam3d-generation-server-web-app.modal.run`
- **ヘルスチェック**: `GET /health`
- **デバッグ**: `GET /debug`
- **3D生成**: `POST /generate` (multipart/form-data で image ファイルを送信)

## トラブルシューティング

### モデルロードエラーの調査
1. `/health` エンドポイントの `error_message` を確認
2. `/debug` エンドポイントでインストール済みパッケージを確認
3. Modal ダッシュボードでログを確認

### 依存関係の問題
1. エラーメッセージから不足しているモジュール/関数を特定
2. そのモジュールがどのパッケージに含まれるか調査
3. SAM3D Objects の requirements.txt で正しいバージョンを確認
4. 必要に応じて特定のコミットハッシュを使用

## 参考リンク

- [SAM3D Objects GitHub](https://github.com/facebookresearch/sam-3d-objects)
- [MoGe GitHub](https://github.com/microsoft/MoGe)
- [utils3d GitHub](https://github.com/EasternJournalist/utils3d)
- [Modal Documentation](https://modal.com/docs)
- [NVIDIA Kaolin](https://github.com/NVIDIAGameWorks/kaolin)
