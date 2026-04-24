interface Campaign {
  id: string;
  name: string;
  status: string;
  total_targets: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

export function MtprotoCampaignList({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) {
    return <p className="text-white/40 text-sm">Nenhuma campanha ainda.</p>;
  }
  return (
    <div className="space-y-2">
      {campaigns.map((c) => (
        <a
          key={c.id}
          href={`/dashboard/automations/campaigns/${c.id}`}
          className="block p-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white text-sm font-medium">{c.name}</div>
              <div className="text-white/40 text-xs">
                {c.sent_count}/{c.total_targets} enviadas · {c.failed_count} falhas · {c.status}
              </div>
            </div>
            <div className="text-white/30 text-xs">
              {new Date(c.created_at).toLocaleDateString("pt-BR")}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
