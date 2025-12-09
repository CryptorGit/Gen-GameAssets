"use client";

import { useRef, useCallback, Suspense, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Grid,
  OrbitControls,
  PerspectiveCamera,
  TransformControls,
} from "@react-three/drei";
import * as THREE from "three";
import { SceneObject, TransformMode, useAppStore } from "@/lib/store";

function ObjectMesh({ obj, isSelected }: { obj: SceneObject; isSelected: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { updateObjectTransform, transformMode, selectObject } = useAppStore();

  useFrame((state) => {
    if (meshRef.current && isSelected) {
      const t = state.clock.elapsedTime;
      meshRef.current.position.y = obj.position.y + Math.sin(t * 1.8) * 0.02;
    }
  });

  const handleTransformChange = useCallback(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    updateObjectTransform(obj.id, {
      position: {
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
      },
      rotation: {
        x: mesh.rotation.x,
        y: mesh.rotation.y,
        z: mesh.rotation.z,
      },
      scale: mesh.scale.x,
    });
  }, [obj.id, updateObjectTransform]);

  if (!obj.visible) return null;

  const isReady = obj.status === "ready";
  const isGenerating = obj.status === "generating";

  const meshElement = (
    <mesh
      ref={meshRef}
      position={[obj.position.x, obj.position.y + 0.5, obj.position.z]}
      rotation={[obj.rotation.x, obj.rotation.y, obj.rotation.z]}
      scale={obj.scale}
      castShadow
      onClick={(e) => {
        e.stopPropagation();
        selectObject(obj.id);
      }}
    >
      {isReady ? <boxGeometry args={[1, 1, 1]} /> : <sphereGeometry args={[0.55, 20, 20]} />}
      <meshStandardMaterial
        color={obj.color}
        metalness={isReady ? 0.3 : 0.1}
        roughness={isReady ? 0.35 : 0.8}
        wireframe={isGenerating}
        opacity={isGenerating ? 0.55 : 1}
        transparent={isGenerating}
      />
    </mesh>
  );

  return (
    <group>
      {isSelected ? (
        <TransformControls mode={transformMode} onObjectChange={handleTransformChange}>
          {meshElement}
        </TransformControls>
      ) : (
        meshElement
      )}
    </group>
  );
}

function SceneContent() {
  const { objects, selectedObjectId } = useAppStore();

  return (
    <>
      <PerspectiveCamera makeDefault position={[5, 4.5, 5.5]} fov={50} />
      <color attach="background" args={["#0a0a0a"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 9, 6]} intensity={1.2} castShadow />
      <directionalLight position={[-4, 5, -4]} intensity={0.4} />
      <hemisphereLight intensity={0.3} groundColor="#333333" />

      <Grid
        args={[20, 20]}
        position={[0, 0, 0]}
        cellSize={0.6}
        cellThickness={0.5}
        cellColor="#1a1a1a"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#333333"
        fadeDistance={30}
      />

      {objects.map((obj) => (
        <ObjectMesh key={obj.id} obj={obj} isSelected={obj.id === selectedObjectId} />
      ))}

      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={2}
        maxDistance={30}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}

export function Scene3DViewer() {
  const { objects, transformMode, setTransformMode, resetScene, downloadScene, reset } = useAppStore();
  const readyCount = objects.filter((o) => o.status === "ready").length;
  const generatingCount = objects.filter((o) => o.status === "generating").length;

  return (
    <div className="flex flex-col h-full bg-black">
      {/* 3Dビューヘッダー */}
      <div className="h-14 border-b border-gray-800 bg-[#0a0a0a] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">3D Preview</span>
          {generatingCount > 0 && (
            <span className="text-xs text-amber-400 animate-pulse">
              Generating {generatingCount}...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Transform mode selector */}
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            {(["translate", "rotate", "scale"] as TransformMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setTransformMode(mode)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  transformMode === mode
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {mode === "translate" && "Move"}
                {mode === "rotate" && "Rotate"}
                {mode === "scale" && "Scale"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3Dキャンバス */}
      <div className="flex-1 relative">
        <Canvas 
          shadows
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.setClearColor(new THREE.Color("#000000"));
          }}
        >
          <Suspense fallback={null}>
            <SceneContent />
          </Suspense>
        </Canvas>

        {/* 空状態の表示 */}
        {objects.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 rounded-2xl bg-gray-900/80 flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">3D models will appear here</p>
              <p className="text-gray-600 text-xs">Add objects and click Generate 3D</p>
            </div>
          </div>
        )}
      </div>

      {/* (右下) 3Dビュー操作ツールバー */}
      <div className="h-14 border-t border-gray-800 bg-[#0a0a0a] flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Drag: Rotate</span>
          <span>•</span>
          <span>Right-drag: Pan</span>
          <span>•</span>
          <span>Scroll: Zoom</span>
        </div>

        <div className="flex items-center gap-2">
          {/* ツールバーアイコン */}
          <button
            onClick={resetScene}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            title="Reset View"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button
            onClick={downloadScene}
            disabled={readyCount === 0}
            className={`p-2 rounded-lg transition-colors ${
              readyCount > 0
                ? "text-gray-400 hover:text-white hover:bg-gray-800"
                : "text-gray-700 cursor-not-allowed"
            }`}
            title="Download Scene"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <button
            onClick={reset}
            className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors"
            title="Clear Scene"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
