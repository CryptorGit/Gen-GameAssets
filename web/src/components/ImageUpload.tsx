"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useAppStore } from "@/lib/store";

// サンプル画像プリセット
const SAMPLE_IMAGES = [
  {
    id: "food",
    name: "Food & Kitchen",
    gradient: ["#f59e0b", "#ef4444"],
    hint: "Plates, food, utensils",
  },
  {
    id: "living",
    name: "Living Room",
    gradient: ["#0ea5e9", "#8b5cf6"],
    hint: "Furniture, decor",
  },
  {
    id: "objects",
    name: "Tabletop Objects",
    gradient: ["#22c55e", "#0ea5e9"],
    hint: "Toys, gadgets",
  },
];

function createSampleImage(preset: typeof SAMPLE_IMAGES[0]) {
  const width = 960;
  const height = 540;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  canvas.width = width;
  canvas.height = height;

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, preset.gradient[0]);
  gradient.addColorStop(1, preset.gradient[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 簡易オブジェクト表示
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(width * 0.1, height * 0.2, width * 0.8, height * 0.6);

  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(width * 0.15, height * 0.28, width * 0.25, height * 0.44);
  ctx.fillRect(width * 0.45, height * 0.32, width * 0.18, height * 0.36);
  ctx.fillRect(width * 0.68, height * 0.26, width * 0.18, height * 0.48);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText(preset.name, width / 2, height * 0.5);
  ctx.font = "20px Arial";
  ctx.fillText(preset.hint, width / 2, height * 0.58);

  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

export function ImageUpload() {
  const { setImage } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          setImage(reader.result as string, {
            width: img.width,
            height: img.height,
          });
          setIsLoading(false);
        };
        img.src = reader.result as string;
      };
      reader.onerror = () => setIsLoading(false);
      reader.readAsDataURL(file);
    },
    [setImage]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
    noClick: true,
  });

  const handleSample = useCallback(
    (preset: typeof SAMPLE_IMAGES[0]) => {
      setIsLoading(true);
      const sample = createSampleImage(preset);
      if (!sample) {
        setIsLoading(false);
        return;
      }
      requestAnimationFrame(() => {
        setImage(sample.dataUrl, { width: sample.width, height: sample.height });
        setIsLoading(false);
      });
    },
    [setImage]
  );

  return (
    <div className="flex-1 flex flex-col">
      {/* (A-M1) 画像アップロードエリア: y=[0.00, 0.70] */}
      <div className="flex-[7] flex items-center justify-center p-8">
        <div
          {...getRootProps()}
          className={`relative w-full h-full max-w-4xl rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center ${
            isDragActive
              ? "border-blue-500 bg-blue-500/10"
              : "border-gray-700 bg-gray-900/30 hover:border-gray-500"
          } ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
        >
          <input {...getInputProps()} />

          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-300">Loading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 text-center">
              {/* 画像アイコン */}
              <div className="w-20 h-20 rounded-2xl bg-gray-800/80 border border-gray-700 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>

              <div>
                <p className="text-xl font-semibold text-white mb-2">
                  Start with your own image
                </p>
                <p className="text-sm text-gray-400">
                  Drag and drop an image, or click Upload below
                </p>
              </div>

              <button
                onClick={open}
                className="px-6 py-3 bg-white text-black font-semibold rounded-full hover:bg-gray-200 transition-colors"
              >
                Upload
              </button>

              {isDragActive && (
                <p className="text-blue-400 text-sm">Drop to upload</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* (A-M2) サンプル画像セクション: y=[0.70, 0.95] */}
      <div className="flex-[3] border-t border-gray-800 bg-[#0a0a0a] p-6">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-center text-gray-400 text-sm mb-4">
            Or try a sample image
          </h3>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            {SAMPLE_IMAGES.map((sample) => (
              <button
                key={sample.id}
                onClick={() => handleSample(sample)}
                className="group relative w-40 h-24 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-500 transition-all"
                style={{
                  background: `linear-gradient(135deg, ${sample.gradient[0]}, ${sample.gradient[1]})`,
                }}
              >
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-white text-sm font-medium">{sample.name}</p>
                  <p className="text-white/60 text-xs">{sample.hint}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-center mt-4">
            <button className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-full hover:border-gray-500 transition-colors">
              Browse images
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

