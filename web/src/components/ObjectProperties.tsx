"use client";

import { useAppStore } from "@/lib/store";

export function ObjectProperties() {
  const { objects, selectedObjectId, updateObjectTransform } = useAppStore();
  const selectedObject = objects.find((o) => o.id === selectedObjectId);

  const handleChange = (
    type: "position" | "rotation" | "scale",
    axis: "x" | "y" | "z" | "value",
    value: string
  ) => {
    const numValue = parseFloat(value);
    if (Number.isNaN(numValue)) return;

    if (type === "scale" && axis === "value" && selectedObject) {
      updateObjectTransform(selectedObject.id, { scale: numValue });
      return;
    }

    if (selectedObject && axis !== "value") {
      updateObjectTransform(selectedObject.id, {
        [type]: {
          ...selectedObject[type],
          [axis]: numValue,
        },
      });
    }
  };

  return (
    <div className="border-t border-slate-800 bg-slate-900/80 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.14em]">
          Transform
        </h3>
        <span className="text-xs text-slate-500">
          {selectedObject ? selectedObject.name : "Select an object"}
        </span>
      </div>

      {!selectedObject ? (
        <div className="text-xs text-slate-500">
          Pick an entry from the object list to adjust position, rotation, and scale.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 uppercase">Position</label>
            <div className="grid grid-cols-1 gap-1">
              {(["x", "y", "z"] as const).map((axis) => (
                <div key={axis} className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 w-3 uppercase">{axis}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedObject.position[axis].toFixed(2)}
                    onChange={(e) => handleChange("position", axis, e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 uppercase">Rotation</label>
            <div className="grid grid-cols-1 gap-1">
              {(["x", "y", "z"] as const).map((axis) => (
                <div key={axis} className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 w-3 uppercase">{axis}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedObject.rotation[axis].toFixed(2)}
                    onChange={(e) => handleChange("rotation", axis, e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 uppercase">Scale</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 w-3">S</span>
              <input
                type="number"
                step="0.1"
                value={selectedObject.scale.toFixed(2)}
                onChange={(e) => handleChange("scale", "value", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
