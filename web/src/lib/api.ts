// API helper for SAM3 segmentation and SAM3D 3D generation backends

// SAM3 Segmentation Server (ローカル)
const SAM3_API_URL = process.env.NEXT_PUBLIC_SAM3_API_URL || "http://localhost:8001";
// SAM3D 3D Generation Server (Modal)
const SAM3D_API_URL = process.env.NEXT_PUBLIC_SAM3D_API_URL || "http://localhost:8000";

// ========================================
// SAM3 Segmentation API
// ========================================

export interface SegmentationRequest {
  image: string;  // Base64エンコードされた画像 (data:image/...;base64,xxx 形式可)
  points_positive: [number, number][];  // [[x, y], ...]
  points_negative?: [number, number][];
  multimask_output?: boolean;
}

export interface SegmentationResponse {
  success: boolean;
  masks: string[];  // Base64エンコードされたマスク画像
  scores: number[];
  message: string;
}

export interface SetImageRequest {
  image: string;
}

export interface SetImageResponse {
  success: boolean;
  image_size: [number, number];
  message: string;
}

export interface SAM3HealthResponse {
  status: string;
  service: string;
  version: string;
  model_loaded: boolean;
  device: string;
}

// SAM3 ヘルスチェック
export async function checkSAM3Health(): Promise<SAM3HealthResponse> {
  const response = await fetch(`${SAM3_API_URL}/health`);
  if (!response.ok) {
    throw new Error(`SAM3 health check failed: ${response.status}`);
  }
  return response.json();
}

// 画像のエンベディングを事前計算
export async function setImage(image: string): Promise<SetImageResponse> {
  const response = await fetch(`${SAM3_API_URL}/set_image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image }),
  });

  if (!response.ok) {
    throw new Error(`Set image failed: ${response.status}`);
  }

  return response.json();
}

// ポイントプロンプトでセグメンテーション
export async function segmentWithPoints(
  request: SegmentationRequest
): Promise<SegmentationResponse> {
  const response = await fetch(`${SAM3_API_URL}/segment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: request.image,
      points_positive: request.points_positive,
      points_negative: request.points_negative || [],
      multimask_output: request.multimask_output ?? false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Segmentation failed: ${response.status}`);
  }

  return response.json();
}

// テキストプロンプトでセグメンテーション
export async function segmentWithText(
  image: string,
  prompt: string,
  confidenceThreshold: number = 0.5
): Promise<SegmentationResponse> {
  const params = new URLSearchParams({
    image,
    prompt,
    confidence_threshold: confidenceThreshold.toString(),
  });

  const response = await fetch(`${SAM3_API_URL}/segment_with_text?${params}`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Text segmentation failed: ${response.status}`);
  }

  return response.json();
}

// ========================================
// SAM3D 3D Generation API (Modal)
// ========================================

export interface Generate3DRequest {
  image: string;  // Base64エンコードされた元画像
  mask: string;   // Base64エンコードされたマスク画像
  seed?: number;
  output_format?: "ply" | "glb";
}

export interface Generate3DResponse {
  success: boolean;
  model_data: string;  // Base64エンコードされた3Dモデル
  format: string;
  message: string;
}

export interface SAM3DHealthResponse {
  status: string;
  service: string;
  model_loaded: boolean;
  gpu: string;
  cuda_available: boolean;
}

// SAM3D ヘルスチェック
export async function checkSAM3DHealth(): Promise<SAM3DHealthResponse> {
  const response = await fetch(`${SAM3D_API_URL}/health`);
  if (!response.ok) {
    throw new Error(`SAM3D health check failed: ${response.status}`);
  }
  return response.json();
}

// 3Dモデル生成
export async function generate3D(request: Generate3DRequest): Promise<Generate3DResponse> {
  const response = await fetch(`${SAM3D_API_URL}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: request.image,
      mask: request.mask,
      seed: request.seed ?? 42,
      output_format: request.output_format ?? "ply",
    }),
  });

  if (!response.ok) {
    throw new Error(`3D generation failed: ${response.status}`);
  }

  return response.json();
}

// ========================================
// ユーティリティ関数
// ========================================

// Convert file to base64 (with data: prefix)
export function fileToBase64WithPrefix(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Convert file to base64 (without the data: prefix)
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Convert base64 back to a Blob with a mime type
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// Base64マスクをdata URL形式に変換
export function maskToDataUrl(base64Mask: string): string {
  if (base64Mask.startsWith("data:")) {
    return base64Mask;
  }
  return `data:image/png;base64,${base64Mask}`;
}

// Download a blob locally
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
