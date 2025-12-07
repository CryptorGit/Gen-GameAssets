// API helper for the Modal backend (placeholder endpoints).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface GenerateRequest {
  image: string;
  mask: string;
  format: "ply" | "glb";
  seed?: number;
}

export interface GenerateResponse {
  success: boolean;
  file: string;
  format: string;
  message: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

// Health check
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json();
}

// Generate 3D model
export async function generate3D(request: GenerateRequest): Promise<GenerateResponse> {
  const response = await fetch(`${API_BASE_URL}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: request.image,
      mask: request.mask,
      format: request.format,
      seed: request.seed ?? 42,
    }),
  });

  if (!response.ok) {
    throw new Error(`Generation failed: ${response.status}`);
  }

  return response.json();
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
