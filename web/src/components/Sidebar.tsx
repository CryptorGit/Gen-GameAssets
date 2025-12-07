"use client";

import { useState } from "react";

interface SidebarProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { number: 1, title: "Choose an image", description: "Upload or select a sample image to begin" },
  { number: 2, title: "Select objects", description: "Click to add/remove mask points on objects" },
  { number: 3, title: "Create 3D models", description: "Generate and preview 3D models" },
];

export function Sidebar({ currentStep }: SidebarProps) {
  const [selectedModel] = useState("SAM 3D Objects");

  return (
    <aside className="w-[20%] min-w-[240px] max-w-[320px] h-full bg-[#0a0a0a] border-r border-gray-800 flex flex-col p-6">
      {/* (A-L1) 画面タイトル */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Create 3D models</h1>
        <p className="text-sm text-gray-400">
          Create 3D models of objects from images
        </p>
      </div>

      {/* (A-L2) How it works セクション */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">How it works</h2>
        <div className="space-y-4">
          {STEPS.map((step) => {
            const isActive = step.number === currentStep;
            const isCompleted = step.number < currentStep;
            
            return (
              <div
                key={step.number}
                className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                  isActive
                    ? "bg-blue-500/10 border border-blue-500/30"
                    : isCompleted
                    ? "bg-green-500/5 border border-green-500/20"
                    : "bg-gray-900/50 border border-transparent"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                    isActive
                      ? "bg-blue-500 text-white"
                      : isCompleted
                      ? "bg-green-500 text-white"
                      : "bg-gray-700 text-gray-300"
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${isActive ? "text-white" : "text-gray-300"}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* (A-L3) モデル選択 */}
      <div className="mt-auto">
        <label className="text-sm text-gray-400 mb-2 block">Model</label>
        <button className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-sm text-white font-medium transition-colors flex items-center justify-between">
          <span>{selectedModel}</span>
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
