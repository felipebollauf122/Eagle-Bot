"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCampaign } from "@/app/dashboard/automations/actions";

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_targets: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  recurrence_hours?: number | null;
  next_run_at?: string | null;
}

function formatNextRun(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = d.getTime() - now;
  if (diffMs <= 0) return "agora";
  const hours = Math.floor(diffMs / 3600_000);
  if (hours < 1) {
    const mins = Math.max(1, Math.round(diffMs / 60_000));
    return `em ${mins} min`;
  }
  if (hours < 24) return `em ${hours}h`;
  const days = Math.floor(hours / 24);
  return `em ${days}d`;
}

export function MtprotoCampaignList({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (campaigns.length === 0) {
    return <p className="text-white/40 text-sm">Nenhuma campanha ainda.</p>;
  }

  function handleDelete(e: React.MouseEvent, c: Campaign) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Excluir a campanha "${c.name}"? Esta ação não pode ser desfeita.`)) return;
    setPendingId(c.id);
    startTransition(async () => {
      try {
        await deleteCampaign(c.id);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "erro ao excluir");
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      {campaigns.map((c) => {
        const isRecurrent = !!c.recurrence_hours;
        const nextRun = formatNextRun(c.next_run_at);
        const deleting = pendingId === c.id;
        return (
          <div
            key={c.id}
            className={`flex items-center gap-2 p-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] ${deleting ? "opacity-50" : ""}`}
          >
            <a
              href={`/dashboard/automations/campaigns/${c.id}`}
              className="flex-1 flex items-center justify-between min-w-0"
            >
              <div className="min-w-0">
                <div className="text-white text-sm font-medium flex items-center gap-2">
                  {isRecurrent && (
                    <span title={`Recorrente a cada ${c.recurrence_hours}h`}>🔁</span>
                  )}
                  <span className="truncate">{c.name}</span>
                </div>
                <div className="text-white/40 text-xs">
                  {c.sent_count}/{c.total_targets} enviadas · {c.failed_count} falhas · {c.status}
                  {isRecurrent && (
                    <>
                      {" · "}
                      a cada {c.recurrence_hours}h
                      {nextRun && c.status === "scheduled" ? ` · próxima ${nextRun}` : ""}
                    </>
                  )}
                </div>
              </div>
              <div className="text-white/30 text-xs shrink-0 pl-3">
                {new Date(c.created_at).toLocaleDateString("pt-BR")}
              </div>
            </a>
            <button
              type="button"
              onClick={(e) => handleDelete(e, c)}
              disabled={deleting}
              title="Excluir campanha"
              className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
