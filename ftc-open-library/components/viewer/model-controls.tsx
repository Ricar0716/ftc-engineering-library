"use client";

export function ModelControls({
  onReset,
  gridVisible,
  onToggleGrid,
}: {
  onReset: () => void;
  gridVisible: boolean;
  onToggleGrid: () => void;
}) {
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-wrap justify-end gap-2">
      <button
        type="button"
        className="min-h-8 rounded-md border border-white/20 bg-black/40 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-white hover:bg-black/60"
        onClick={onReset}
      >
        Reset camera
      </button>
      <button
        type="button"
        className="min-h-8 rounded-md border border-white/20 bg-black/40 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-white hover:bg-black/60"
        aria-pressed={gridVisible}
        onClick={onToggleGrid}
      >
        {gridVisible ? "Hide grid" : "Show grid"}
      </button>
    </div>
  );
}
