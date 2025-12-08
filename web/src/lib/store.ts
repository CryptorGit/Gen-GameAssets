"use client";

import { create } from "zustand";
import { segmentWithPoints, checkSAM3Health } from "./api";

// ========================================
// 型定義
// ========================================

export type AppState = "upload" | "workspace";

export interface Point {
  x: number;
  y: number;
  type: "add" | "remove";
}

export type ObjectStatus = "selecting" | "generating" | "ready" | "error";

export interface SceneObject {
  id: string;
  name: string;
  points: Point[];
  mask: string | null;
  model3D: { data: string; format: "ply" | "glb" } | null;
  status: ObjectStatus;
  visible: boolean;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
  color: string;
}

export type TransformMode = "translate" | "rotate" | "scale";

// SAM3 サーバー接続状態
export type SAM3Status = "disconnected" | "connecting" | "connected" | "error";

export interface AppStore {
  // 状態
  state: AppState;
  setState: (state: AppState) => void;

  // SAM3 サーバー状態
  sam3Status: SAM3Status;
  sam3Device: string | null;
  checkSAM3Connection: () => Promise<void>;

  // 画像
  image: string | null;
  imageSize: { width: number; height: number } | null;
  setImage: (image: string | null, size?: { width: number; height: number }) => void;

  // 現在編集中のセグメンテーション
  currentPoints: Point[];
  currentMask: string | null;
  isSegmenting: boolean;
  addPoint: (point: Point) => void;
  removeLastPoint: () => void;
  clearCurrentPoints: () => void;
  setCurrentMask: (mask: string | null) => void;

  // 自動セグメンテーション（SAM3 API呼び出し）
  requestSegmentation: () => Promise<void>;

  // シーン内オブジェクト
  objects: SceneObject[];
  selectedObjectId: string | null;
  addObject: () => void;
  removeObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  toggleObjectVisibility: (id: string) => void;
  updateObjectStatus: (id: string, status: ObjectStatus) => void;
  updateObjectModel: (id: string, model: { data: string; format: "ply" | "glb" }) => void;
  updateObjectMask: (id: string, mask: string) => void;
  updateObjectTransform: (id: string, transform: Partial<Pick<SceneObject, "position" | "rotation" | "scale">>) => void;

  // トランスフォームモード
  transformMode: TransformMode;
  setTransformMode: (mode: TransformMode) => void;

  // エラー
  error: string | null;
  setError: (error: string | null) => void;

  // 生成
  generateSelected: () => void;
  generateAll: () => void;

  // ダウンロード
  downloadObject: (id: string) => void;
  downloadScene: () => void;

  // リセット
  reset: () => void;
  resetScene: () => void;
}

// カラーパレット
const OBJECT_COLORS = [
  "#3B82F6", "#EF4444", "#22C55E", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6"
];

let objectCounter = 0;

// ========================================
// ストア
// ========================================

export const useAppStore = create<AppStore>((set, get) => ({
  state: "upload",
  setState: (state) => set({ state }),

  // SAM3 サーバー状態
  sam3Status: "disconnected",
  sam3Device: null,
  checkSAM3Connection: async () => {
    set({ sam3Status: "connecting" });
    try {
      const health = await checkSAM3Health();
      console.log("[SAM3] Health check response:", health);
      // model_loadedがfalseでもstatus=fallbackならサーバーは動作している
      const isConnected = health.status === "ok" || health.status === "fallback";
      set({
        sam3Status: isConnected ? "connected" : "connecting",
        sam3Device: health.device || "fallback",
      });
    } catch (error) {
      console.error("[SAM3] Health check failed:", error);
      set({ sam3Status: "error", sam3Device: null });
    }
  },

  image: null,
  imageSize: null,
  setImage: (image, size) => {
    if (image) {
      set({
        image,
        imageSize: size || null,
        state: "workspace",
        currentPoints: [],
        currentMask: null,
        objects: [],
        selectedObjectId: null,
        error: null,
      });
      objectCounter = 0;
      // 画像設定時にSAM3接続確認
      get().checkSAM3Connection();
    } else {
      set({
        image: null,
        imageSize: null,
        state: "upload",
      });
    }
  },

  currentPoints: [],
  currentMask: null,
  isSegmenting: false,
  addPoint: (point) => {
    set((s) => ({ currentPoints: [...s.currentPoints, point] }));
    // ポイント追加時に自動セグメンテーション
    get().requestSegmentation();
  },
  removeLastPoint: () => {
    set((s) => ({ currentPoints: s.currentPoints.slice(0, -1) }));
    // ポイント削除時にも再セグメンテーション
    const { currentPoints } = get();
    if (currentPoints.length > 0) {
      get().requestSegmentation();
    } else {
      set({ currentMask: null });
    }
  },
  clearCurrentPoints: () => set({ currentPoints: [], currentMask: null }),
  setCurrentMask: (mask) => set({ currentMask: mask }),

  // SAM3 APIを呼び出してセグメンテーション
  requestSegmentation: async () => {
    const { image, currentPoints, isSegmenting } = get();
    
    console.log("[SAM3] requestSegmentation called", { 
      hasImage: !!image, 
      pointsCount: currentPoints.length,
      isSegmenting 
    });
    
    if (!image || currentPoints.length === 0) return;
    if (isSegmenting) return; // 重複呼び出し防止
    
    set({ isSegmenting: true });
    
    try {
      const positivePoints = currentPoints
        .filter((p) => p.type === "add")
        .map((p) => [p.x, p.y] as [number, number]);
      
      const negativePoints = currentPoints
        .filter((p) => p.type === "remove")
        .map((p) => [p.x, p.y] as [number, number]);
      
      console.log("[SAM3] Calling segmentWithPoints", { 
        positivePoints, 
        negativePoints 
      });
      
      const response = await segmentWithPoints({
        image,
        points_positive: positivePoints,
        points_negative: negativePoints,
        multimask_output: false,
      });
      
      console.log("[SAM3] Segmentation response", response);
      
      if (response.success && response.masks.length > 0) {
        // 最もスコアの高いマスクを使用
        const maskBase64 = response.masks[0];
        set({ currentMask: `data:image/png;base64,${maskBase64}` });
        console.log("[SAM3] Mask set successfully");
      } else {
        console.log("[SAM3] No masks returned or not successful");
      }
    } catch (error) {
      console.error("[SAM3] Segmentation failed:", error);
      // エラー時はクライアントサイドのフォールバックマスク生成
      const { imageSize } = get();
      if (imageSize) {
        const canvas = document.createElement("canvas");
        canvas.width = imageSize.width;
        canvas.height = imageSize.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          currentPoints.forEach((pt) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 80, 0, Math.PI * 2);
            ctx.globalCompositeOperation = pt.type === "remove" ? "destination-out" : "source-over";
            ctx.fillStyle = pt.type === "remove" ? "rgba(0,0,0,1)" : "rgba(236, 72, 153, 0.6)";
            ctx.fill();
          });
          set({ currentMask: canvas.toDataURL() });
          console.log("[SAM3] Fallback mask generated");
        }
      }
    } finally {
      set({ isSegmenting: false });
    }
  },

  objects: [],
  selectedObjectId: null,

  addObject: () => {
    const { currentPoints, currentMask } = get();
    if (currentPoints.length === 0) return;

    objectCounter++;
    const newObject: SceneObject = {
      id: `obj-${Date.now()}`,
      name: `Object ${objectCounter}`,
      points: [...currentPoints],
      mask: currentMask,
      model3D: null,
      status: "selecting",
      visible: true,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
      color: OBJECT_COLORS[(objectCounter - 1) % OBJECT_COLORS.length],
    };

    set((s) => ({
      objects: [...s.objects, newObject],
      selectedObjectId: newObject.id,
      currentPoints: [],
      currentMask: null,
    }));
  },

  removeObject: (id) => set((s) => ({
    objects: s.objects.filter((o) => o.id !== id),
    selectedObjectId: s.selectedObjectId === id ? null : s.selectedObjectId,
  })),

  selectObject: (id) => set({ selectedObjectId: id }),

  toggleObjectVisibility: (id) => set((s) => ({
    objects: s.objects.map((o) =>
      o.id === id ? { ...o, visible: !o.visible } : o
    ),
  })),

  updateObjectStatus: (id, status) => set((s) => ({
    objects: s.objects.map((o) =>
      o.id === id ? { ...o, status } : o
    ),
  })),

  updateObjectModel: (id, model) => set((s) => ({
    objects: s.objects.map((o) =>
      o.id === id ? { ...o, model3D: model, status: "ready" as ObjectStatus } : o
    ),
  })),

  updateObjectMask: (id, mask) => set((s) => ({
    objects: s.objects.map((o) =>
      o.id === id ? { ...o, mask } : o
    ),
  })),

  updateObjectTransform: (id, transform) => set((s) => ({
    objects: s.objects.map((o) =>
      o.id === id ? { ...o, ...transform } : o
    ),
  })),

  transformMode: "translate",
  setTransformMode: (mode) => set({ transformMode: mode }),

  error: null,
  setError: (error) => set({ error }),

  generateSelected: () => {
    const { selectedObjectId, objects, updateObjectStatus, updateObjectModel } = get();
    if (!selectedObjectId) return;

    const obj = objects.find((o) => o.id === selectedObjectId);
    if (!obj || obj.status === "generating" || obj.status === "ready") return;

    updateObjectStatus(selectedObjectId, "generating");

    // デモ: 2秒後に完了
    setTimeout(() => {
      updateObjectModel(selectedObjectId, { data: "", format: "ply" });
    }, 2000);
  },

  generateAll: () => {
    const { objects, updateObjectStatus, updateObjectModel } = get();
    const pendingObjects = objects.filter((o) => o.status === "selecting");

    pendingObjects.forEach((obj, i) => {
      updateObjectStatus(obj.id, "generating");
      // デモ: 順次完了
      setTimeout(() => {
        updateObjectModel(obj.id, { data: "", format: "ply" });
      }, 2000 + i * 500);
    });
  },

  downloadObject: (id) => {
    const { objects } = get();
    const obj = objects.find((o) => o.id === id);
    if (!obj || !obj.model3D) {
      alert("No 3D model available for this object.");
      return;
    }
    
    // 実際のデータがあればダウンロード
    // ここではデモとしてアラートを表示
    alert(`Downloading ${obj.name}.ply...`);
  },

  downloadScene: () => {
    const { objects } = get();
    const readyObjects = objects.filter(o => o.status === "ready");
    
    if (readyObjects.length === 0) {
      alert("No 3D models generated yet.");
      return;
    }

    alert(`Downloading scene with ${readyObjects.length} objects...`);
  },

  reset: () => {
    objectCounter = 0;
    set({
      state: "upload",
      image: null,
      imageSize: null,
      currentPoints: [],
      currentMask: null,
      objects: [],
      selectedObjectId: null,
      error: null,
    });
  },

  resetScene: () => {
    objectCounter = 0;
    set({
      objects: [],
      selectedObjectId: null,
      currentPoints: [],
      currentMask: null,
    });
  },
}));
