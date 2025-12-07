"use client";

import { create } from "zustand";

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

export interface AppStore {
  // 状態
  state: AppState;
  setState: (state: AppState) => void;

  // 画像
  image: string | null;
  imageSize: { width: number; height: number } | null;
  setImage: (image: string | null, size?: { width: number; height: number }) => void;

  // 現在編集中のセグメンテーション
  currentPoints: Point[];
  currentMask: string | null;
  addPoint: (point: Point) => void;
  removeLastPoint: () => void;
  clearCurrentPoints: () => void;
  setCurrentMask: (mask: string | null) => void;

  // シーン内オブジェクト
  objects: SceneObject[];
  selectedObjectId: string | null;
  addObject: () => void;
  removeObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  toggleObjectVisibility: (id: string) => void;
  updateObjectStatus: (id: string, status: ObjectStatus) => void;
  updateObjectModel: (id: string, model: { data: string; format: "ply" | "glb" }) => void;
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
  addPoint: (point) => set((s) => ({ currentPoints: [...s.currentPoints, point] })),
  removeLastPoint: () => set((s) => ({ currentPoints: s.currentPoints.slice(0, -1) })),
  clearCurrentPoints: () => set({ currentPoints: [], currentMask: null }),
  setCurrentMask: (mask) => set({ currentMask: mask }),

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
