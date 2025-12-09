"use client";

import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { ImageEditor } from "@/components/ImageEditor";
import { useAppStore } from "@/lib/store";

const Scene3DViewer = dynamic(
  () => import("@/components/Scene3DViewer").then((mod) => mod.Scene3DViewer),
  { ssr: false }
);

export function Workspace() {
  const {
    objects,
    currentPoints,
    selectedObjectId,
    addObject,
    selectObject,
    generateAll,
  } = useAppStore();

  const pendingCount = objects.filter((o) => o.status === "selecting").length;
  const generatingCount = objects.filter((o) => o.status === "generating").length;
  const readyCount = objects.filter((o) => o.status === "ready").length;
  const canAddObject = currentPoints.length > 0;
  const canGenerate = pendingCount > 0 && generatingCount === 0;

  // 現在のステップを判定
  const currentStep = readyCount > 0 ? 3 : objects.length > 0 || currentPoints.length > 0 ? 2 : 2;

  return (
    <main className="flex h-screen bg-black text-white overflow-hidden">
      {/* 左サイドバー: x=[0.00, 0.20] */}
      <Sidebar currentStep={currentStep as 1 | 2 | 3} />

      {/* メイン領域: x=[0.20, 1.00] */}
      <div className="flex-1 flex flex-col">
        {/* 上部：オブジェクトタブバー y=[0.02, 0.10] */}
        <div className="h-16 border-b border-gray-800 bg-[#0a0a0a] flex items-center px-4 gap-3">
          {/* (B-T1) オブジェクトスロット */}
          {objects.map((obj, index) => (
            <button
              key={obj.id}
              onClick={() => selectObject(obj.id)}
              className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${
                selectedObjectId === obj.id
                  ? "border-blue-500 bg-gray-800"
                  : "border-gray-700 bg-gray-900 hover:border-gray-500"
              }`}
              title={obj.name}
            >
              <div
                className="w-6 h-6 rounded"
                style={{ backgroundColor: obj.color }}
              />
            </button>
          ))}

          {/* 現在編集中のポイントがある場合の表示 */}
          {currentPoints.length > 0 && !selectedObjectId && (
            <div className="w-12 h-12 rounded-lg border-2 border-blue-500 bg-gray-800 flex items-center justify-center animate-pulse">
              <span className="text-xs text-blue-400">{currentPoints.length}</span>
            </div>
          )}

          {/* (B-T2) Add object + ボタン */}
          <button
            onClick={addObject}
            disabled={!canAddObject}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              canAddObject
                ? "bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
                : "bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed"
            }`}
          >
            Add object
            <span className="text-lg">+</span>
          </button>

          {/* ステータス表示 */}
          <div className="ml-auto flex items-center gap-4 text-sm">
            {objects.length > 0 && (
              <span className="text-gray-400">
                {objects.length} object{objects.length !== 1 ? "s" : ""}
              </span>
            )}
            {readyCount > 0 && (
              <span className="text-green-400">● {readyCount} ready</span>
            )}
            {generatingCount > 0 && (
              <span className="text-amber-400 animate-pulse">
                ⚡ {generatingCount} generating
              </span>
            )}
          </div>
        </div>

        {/* メインコンテンツ: 左右2分割 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左メインキャンバス: x=[0.20, 0.60] - 2D画像＆マスク編集 */}
          <div className="flex-1 flex flex-col border-r border-gray-800">
            <ImageEditor />

            {/* 下部：マスク編集ツールバー y=[0.90, 0.98] */}
            <MaskToolbar canGenerate={canGenerate} onGenerate={generateAll} />
          </div>

          {/* 右メインキャンバス: x=[0.60, 1.00] - 3Dプレビュー */}
          <div className="flex-1 flex flex-col">
            <Scene3DViewer />
          </div>
        </div>
      </div>
    </main>
  );
}

// マスク編集ツールバーコンポーネント
function MaskToolbar({
  canGenerate,
  onGenerate,
}: {
  canGenerate: boolean;
  onGenerate: () => void;
}) {
  const { currentPoints, objects, exportAllMasks } = useAppStore();
  const hasObjects = objects.length > 0;

  return (
    <div className="h-16 border-t border-gray-800 bg-[#0a0a0a] flex items-center justify-between px-4">
      {/* (B-B1) Edit mask ラベル */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">Edit mask</span>

        {/* ポイント数表示 */}
        {currentPoints.length > 0 && (
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
            {currentPoints.filter((p) => p.type === "add").length} add / {currentPoints.filter((p) => p.type === "remove").length} remove
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Export Masks ボタン */}
        <button
          onClick={exportAllMasks}
          disabled={!hasObjects}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            hasObjects
              ? "bg-green-600 text-white hover:bg-green-500"
              : "bg-gray-800 text-gray-500 cursor-not-allowed"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Masks
        </button>

        {/* (B-B3) Generate 3D ボタン */}
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            canGenerate
              ? "bg-white text-black hover:bg-gray-200"
              : "bg-gray-800 text-gray-500 cursor-not-allowed"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          Generate 3D
        </button>
      </div>
    </div>
  );
}
