"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function DelayNode({ data, selected }: NodeProps) {
  const amount = Number(data.amount ?? 0);
  const unit = String(data.unit ?? "seconds");
  const unitLabel = unit === "seconds" ? "seg" : unit === "minutes" ? "min" : "hrs";

  return (
    <div
      className="rounded-2xl px-4 py-3 min-w-40 relative"
      style={{
        background: "linear-gradient(165deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)",
        border: `1px solid ${selected ? "var(--text-secondary)" : "var(--border-strong)"}`,
        boxShadow: selected ? "0 0 20px -4px rgba(238,238,242,0.1), var(--shadow-md)" : "var(--shadow-md)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "var(--text-muted)", width: 10, height: 10, border: "2px solid var(--bg-root)" }} />
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <span className="text-(--text-secondary) text-[10px] font-bold uppercase tracking-wider">Delay</span>
      </div>
      <p className="text-foreground text-sm font-medium stat-value">{amount} {unitLabel}</p>
      <Handle type="source" position={Position.Bottom} style={{ background: "var(--text-muted)", width: 10, height: 10, border: "2px solid var(--bg-root)" }} />
    </div>
  );
}
