"use client";

import { useAppStore } from "@/lib/store";

export function ObjectList() {
  const {
    objects,
    selectedObjectId,
    selectObject,
    removeObject,
    toggleObjectVisibility,
  } = useAppStore();

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/80">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.14em]">
          Scene Objects
        </h3>
        <span className="text-xs text-slate-500">{objects.length} items</span>
      </div>

      <div className="flex-1 overflow-auto">
        {objects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-2">
            <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
              <span className="text-2xl">📦</span>
            </div>
            <p className="text-slate-300 text-sm">No objects yet</p>
            <p className="text-slate-500 text-xs">
              Drop positive/negative points on the image, then “Add Object”.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {objects.map((obj) => {
              const isSelected = selectedObjectId === obj.id;
              const statusLabel =
                obj.status === "selecting"
                  ? "Mask ready"
                  : obj.status === "generating"
                    ? "Generating..."
                    : obj.status === "ready"
                      ? "3D ready"
                      : "Error";
              const statusColor =
                obj.status === "ready"
                  ? "text-emerald-400"
                  : obj.status === "generating"
                    ? "text-amber-300"
                    : obj.status === "error"
                      ? "text-rose-400"
                      : "text-slate-400";

              return (
                <div
                  key={obj.id}
                  onClick={() => selectObject(obj.id)}
                  className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer transition-all border ${
                    isSelected
                      ? "bg-slate-900/70 border-sky-600/70 shadow-[0_0_0_1px_rgba(14,165,233,0.5)]"
                      : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold uppercase flex-shrink-0"
                    style={{ backgroundColor: `${obj.color}22`, color: obj.color }}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-white/40"
                      style={{ backgroundColor: obj.color }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{obj.name}</p>
                        <p className={`text-xs ${statusColor}`}>{statusLabel}</p>
                      </div>
                      {obj.status === "selecting" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            useAppStore.getState().selectObject(obj.id);
                            useAppStore.getState().generateSelected();
                          }}
                          className="text-[11px] px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200 hover:border-sky-500 hover:text-white"
                        >
                          Generate 3D
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        {obj.points.length} pts
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                        Mask {obj.mask ? "cached" : "pending"}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {obj.visible ? "Visible" : "Hidden"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {obj.status === "ready" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          useAppStore.getState().downloadObject(obj.id);
                        }}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                        title="Download PLY"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleObjectVisibility(obj.id);
                      }}
                      className={`p-1.5 rounded bg-slate-800 hover:bg-slate-700 ${
                        obj.visible ? "text-slate-200" : "text-slate-500"
                      }`}
                      title={obj.visible ? "Hide" : "Show"}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {obj.visible ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m3.235-3.358A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411M9.878 9.878l4.242 4.242M3 3l18 18" />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeObject(obj.id);
                      }}
                      className="p-1.5 rounded bg-slate-800 hover:bg-rose-700/60 text-slate-300 hover:text-white"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
