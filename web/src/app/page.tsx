"use client";

import { ImageUpload } from "@/components/ImageUpload";
import { Workspace } from "@/components/Workspace";
import { Sidebar } from "@/components/Sidebar";
import { useAppStore } from "@/lib/store";
import { useEffect, useState } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const state = useAppStore((s) => s.state);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ハイドレーションエラー防止 - SSRとクライアントでの不一致を避ける
  if (!mounted) {
    return (
      <div style={{ 
        display: 'flex', 
        height: '100vh', 
        backgroundColor: '#000', 
        color: '#fff',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{ fontSize: '18px', color: '#666' }}>Loading...</p>
      </div>
    );
  }

  if (state === "upload") {
    return (
      <main className="flex h-screen bg-black text-white overflow-hidden">
        {/* 左サイドバー */}
        <Sidebar currentStep={1} />

        {/* 右側メイン領域 */}
        <div className="flex-1 flex flex-col">
          <ImageUpload />
        </div>
      </main>
    );
  }

  return <Workspace />;
}
