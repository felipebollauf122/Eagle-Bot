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
  if (campaigns.length === 0) {
    return <p className="text-white/40 text-sm">Nenhuma campanha ainda.</p>;
  }
  return (
    <div className="space-y-2">
      {campaigns.map((c) => {
        const isRecurrent = !!c.recurrence_hours;
        const nextRun = formatNextRun(c.next_run_at);
        return (
          <a
            key={c.id}
            href={`/dashboard/automations/campaigns/${c.id}`}
            className="block p-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white text-sm font-medium flex items-center gap-2">
                  {isRecurrent && (
                    <span title={`Recorrente a cada ${c.recurrence_hours}h`}>🔁</span>
                  )}
                  {c.name}
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
              <div className="text-white/30 text-xs">
                {new Date(c.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
