"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Point, useAppStore } from "@/lib/store";

export function ImageEditor() {
  const {
    image,
    imageSize,
    currentPoints,
    currentMask,
    objects,
    selectedObjectId,
    addPoint,
    removeLastPoint,
    clearCurrentPoints,
    setCurrentMask,
    selectObject,
    setImage,
    sam3Status,
    isSegmenting,
  } = useAppStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [toolMode, setToolMode] = useState<"add" | "remove">("add");
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // コンテナサイズを監視
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const canvasSize = useMemo(() => {
    if (!imageSize) return { width: 640, height: 480 };
    const padding = 40;
    const maxWidth = containerSize.width - padding;
    const maxHeight = containerSize.height - padding;
    const scale = Math.min(maxWidth / imageSize.width, maxHeight / imageSize.height, 1);
    return {
      width: Math.floor(imageSize.width * scale),
      height: Math.floor(imageSize.height * scale),
    };
  }, [imageSize, containerSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !image) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 既存オブジェクトのポイント表示
      objects.forEach((obj) => {
        if (!obj.visible) return;

        obj.points.forEach((pt) => {
          const x = (pt.x / (imageSize?.width || 1)) * canvas.width;
          const y = (pt.y / (imageSize?.height || 1)) * canvas.height;

          ctx.beginPath();
          ctx.arc(x, y, 60, 0, Math.PI * 2);
          ctx.fillStyle = `${obj.color}${selectedObjectId === obj.id ? "55" : "26"}`;
          ctx.fill();
        });

        obj.points.forEach((pt) => {
          const x = (pt.x / (imageSize?.width || 1)) * canvas.width;
          const y = (pt.y / (imageSize?.height || 1)) * canvas.height;

          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = obj.color;
          ctx.fill();
          ctx.strokeStyle = selectedObjectId === obj.id ? "#ffffff" : "#0f172acc";
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      });

      // 現在のマスク表示（ピンク色でオーバーレイ）
      if (currentMask) {
        const maskImg = new Image();
        maskImg.onload = () => {
          ctx.globalAlpha = 0.5;
          ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;
        };
        maskImg.src = currentMask;
      }

      // 現在編集中のポイント表示（水色のマーカー）
      currentPoints.forEach((point) => {
        const x = (point.x / (imageSize?.width || 1)) * canvas.width;
        const y = (point.y / (imageSize?.height || 1)) * canvas.height;

        // ポイントマーカー
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fillStyle = point.type === "add" ? "rgba(59, 130, 246, 0.9)" : "rgba(239, 68, 68, 0.9)";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // +/- アイコン
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(point.type === "add" ? "+" : "−", x, y);
      });
    };
    img.src = image;
  }, [image, imageSize, currentPoints, currentMask, objects, canvasSize, selectedObjectId]);

  // SAM3ステータスに応じたインジケーターの色
  const sam3StatusColor = useMemo(() => {
    switch (sam3Status) {
      case "connected": return "bg-green-500";
      case "connecting": return "bg-yellow-500 animate-pulse";
      case "error": return "bg-red-500";
      default: return "bg-gray-500";
    }
  }, [sam3Status]);

  const sam3StatusText = useMemo(() => {
    switch (sam3Status) {
      case "connected": return "SAM3 Connected";
      case "connecting": return "Connecting...";
      case "error": return "SAM3 Offline";
      default: return "Disconnected";
    }
  }, [sam3Status]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!imageSize || isSegmenting) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / canvas.width) * imageSize.width;
      const y = ((e.clientY - rect.top) / canvas.height) * imageSize.height;

      selectObject(null);
      const nextPoint: Point = { x, y, type: toolMode };
      addPoint(nextPoint);
      // セグメンテーションはstore内で自動的に実行される
    },
    [imageSize, toolMode, addPoint, selectObject, isSegmenting]
  );

  return (
    <div className="flex-1 flex flex-col bg-black">
      {/* ツールバー（Add/Removeトグル） */}
      <div className="h-14 border-b border-gray-800 bg-[#0a0a0a] flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {/* SAM3接続ステータス */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${sam3StatusColor}`} />
            <span className="text-xs text-gray-400">{sam3StatusText}</span>
          </div>
          
          {/* (B-B2) モードトグル：Add / Remove */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setToolMode("add")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                toolMode === "add"
                  ? "bg-white text-black"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Add
            </button>
            <button
              onClick={() => setToolMode("remove")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                toolMode === "remove"
                  ? "bg-white text-black"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Remove
            </button>
          </div>
          
          {/* セグメンテーション中のインジケーター */}
          {isSegmenting && (
            <div className="flex items-center gap-2 text-sm text-blue-400">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span>Segmenting...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={removeLastPoint}
            disabled={currentPoints.length === 0}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded border border-gray-700 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Undo
          </button>
          <button
            onClick={clearCurrentPoints}
            disabled={currentPoints.length === 0}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded border border-gray-700 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setImage(null)}
            className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 rounded border border-red-700/50 hover:border-red-600 transition-colors"
          >
            Change image
          </button>
        </div>
      </div>

      {/* (B-L1) 画像キャンバス */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-4 bg-black overflow-hidden"
      >
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            onClick={handleClick}
            className="cursor-crosshair block rounded-lg shadow-2xl"
          />

          {/* ヘルプオーバーレイ */}
          {currentPoints.length === 0 && objects.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none rounded-lg">
              <div className="text-center space-y-2">
                <p className="text-white text-lg font-medium">Click on an object to start</p>
                <p className="text-gray-400 text-sm">
                  Use Add mode to select, Remove to exclude
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
