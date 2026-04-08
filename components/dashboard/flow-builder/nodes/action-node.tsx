"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function ActionNode({ data, selected }: NodeProps) {
  const actionType = String(data.action_type ?? "set_variable");
  const labels: Record<string, string> = { add_tag: "Adicionar Tag", remove_tag: "Remover Tag", set_variable: "Definir Variavel", start_flow: "Iniciar Fluxo", stop_flow: "Parar Fluxo" };
  const detail = actionType === "add_tag" || actionType === "remove_tag" ? String(data.tag ?? "") : actionType === "set_variable" ? `${data.variable ?? ""} = ${data.value ?? ""}` : "";

  return (
    <div
      className="rounded-2xl px-4 py-3 min-w-45 relative"
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <span className="text-(--text-secondary) text-[10px] font-bold uppercase tracking-wider">Acao</span>
      </div>
      <p className="text-foreground text-sm font-medium">{labels[actionType] ?? actionType}</p>
      {detail && <p className="text-(--text-muted) text-xs mt-0.5">{detail}</p>}
      <Handle type="source" position={Position.Bottom} style={{ background: "var(--text-muted)", width: 10, height: 10, border: "2px solid var(--bg-root)" }} />
    </div>
  );
}
