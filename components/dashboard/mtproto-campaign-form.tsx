"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createCampaign,
  launchCampaign,
  listAccountDialogs,
  listActiveAccounts,
} from "@/app/dashboard/automations/actions";

interface Account {
  id: string;
  display_name: string | null;
  phone_number: string;
}

interface Dialog {
  id: string;
  title: string | null;
  username: string | null;
  kind: string;
  peer_type: string;
  is_bot: boolean;
}

const KIND_LABELS: Record<string, string> = {
  contact: "Contato",
  dm: "Conversa direta",
  group_member: "Grupo (só membro)",
  group_admin: "Grupo (admin)",
  channel_subscriber: "Canal (inscrito)",
  channel_owner: "Canal (dono)",
  bot: "Bot",
  self: "Saved Messages",
};

const DEFAULT_KIND_FILTERS = new Set([
  "contact",
  "dm",
  "group_admin",
  "channel_owner",
]);

const ALL_FILTERABLE_KINDS = [
  "contact",
  "dm",
  "group_admin",
  "group_member",
  "channel_owner",
  "channel_subscriber",
];

export function MtprotoCampaignForm() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [targetsRaw, setTargetsRaw] = useState("");
  const [delayMin, setDelayMin] = useState(15);
  const [delayMax, setDelayMax] = useState(45);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceHours, setRecurrenceHours] = useState(24);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [kindFilters, setKindFilters] = useState<Set<string>>(
    new Set(DEFAULT_KIND_FILTERS),
  );
  const [search, setSearch] = useState("");
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [loadingDialogs, setLoadingDialogs] = useState(false);
  const [selectedDialogIds, setSelectedDialogIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    listActiveAccounts()
      .then((accs) => {
        setAccounts(accs);
        if (accs.length > 0 && !selectedAccountId) {
          setSelectedAccountId(accs[0].id);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recarrega dialogs quando muda conta, filtros ou busca (debounced)
  useEffect(() => {
    if (!selectedAccountId) {
      setDialogs([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingDialogs(true);
      try {
        const ds = await listAccountDialogs(selectedAccountId, {
          kinds: Array.from(kindFilters),
          search,
        });
        setDialogs(ds);
      } catch {
        setDialogs([]);
      } finally {
        setLoadingDialogs(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedAccountId, kindFilters, search]);

  function toggleKind(kind: string) {
    const next = new Set(kindFilters);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    setKindFilters(next);
  }

  function toggleDialog(dialogId: string) {
    const next = new Set(selectedDialogIds);
    if (next.has(dialogId)) next.delete(dialogId);
    else next.add(dialogId);
    setSelectedDialogIds(next);
  }

  function selectAllVisible() {
    const next = new Set(selectedDialogIds);
    dialogs.forEach((d) => next.add(d.id));
    setSelectedDialogIds(next);
  }

  function clearSelection() {
    setSelectedDialogIds(new Set());
  }

  function submit(e: React.FormEvent, launch: boolean) {
    e.preventDefault();
    setError(null);
    if (delayMin > delayMax) {
      setError("Delay mínimo não pode ser maior que o máximo");
      return;
    }
    if (
      targetsRaw.trim().length === 0 &&
      selectedDialogIds.size === 0
    ) {
      setError("Cole uma lista de alvos OU selecione contatos/grupos abaixo.");
      return;
    }
    if (recurrenceEnabled && recurrenceHours < 6) {
      setError("Recorrência: mínimo 6 horas entre execuções (anti-ban).");
      return;
    }
    startTransition(async () => {
      try {
        const { campaignId } = await createCampaign({
          name,
          message,
          targetsRaw,
          delayMin,
          delayMax,
          dialogIds: Array.from(selectedDialogIds),
          recurrenceHours: recurrenceEnabled ? recurrenceHours : null,
        });
        if (launch) await launchCampaign(campaignId);
        router.push(`/dashboard/automations/campaigns/${campaignId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "erro");
      }
    });
  }

  // Calcula estimativa de duração de uma execução
  const totalSelected = selectedDialogIds.size + (targetsRaw.trim() ? targetsRaw.trim().split(/[\n,;]+/).filter(Boolean).length : 0);
  const avgDelaySec = (delayMin + delayMax) / 2;
  const estimatedSec = Math.max(0, (totalSelected - 1)) * avgDelaySec;
  const estimatedMin = Math.round(estimatedSec / 60);

  // Função pra selecionar todos os dialogs visíveis de um kind específico
  async function selectAllOfKind(kind: string) {
    if (!selectedAccountId) {
      setError("Selecione uma conta primeiro.");
      return;
    }
    try {
      const ds = await listAccountDialogs(selectedAccountId, { kinds: [kind] });
      const next = new Set(selectedDialogIds);
      ds.forEach((d) => next.add(d.id));
      setSelectedDialogIds(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro");
    }
  }

  return (
    <form className="space-y-4">
      <div>
        <label className="text-white/70 text-sm block mb-1">Nome</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white"
        />
      </div>
      <div>
        <label className="text-white/70 text-sm block mb-1">Mensagem</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white"
        />
      </div>
      <div>
        <label className="text-white/70 text-sm block mb-1">
          Lista de alvos (opcional, um por linha — @username ou +telefone)
        </label>
        <textarea
          value={targetsRaw}
          onChange={(e) => setTargetsRaw(e.target.value)}
          rows={4}
          className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white font-mono text-sm"
          placeholder="@user1&#10;@user2&#10;+5511999998888"
        />
      </div>

      {/* Seletor de dialogs */}
      <div className="border border-white/10 rounded-lg p-4 bg-white/[0.02] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white text-sm font-medium">Selecionar do meu Telegram</h3>
            <p className="text-white/40 text-xs">
              Contatos, conversas, grupos e canais sincronizados da conta MTProto.
            </p>
          </div>
          <div className="text-white/60 text-xs">
            {selectedDialogIds.size > 0 && (
              <span>
                {selectedDialogIds.size} selecionados
                {" · "}
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-white/40 hover:text-red-400"
                >
                  limpar
                </button>
              </span>
            )}
          </div>
        </div>

        {accounts.length === 0 ? (
          <p className="text-white/40 text-sm">
            Nenhuma conta ativa. Conecte uma conta MTProto primeiro em <code>/dashboard/automations</code>.
          </p>
        ) : (
          <>
            <div>
              <label className="text-white/60 text-xs block mb-1">Conta</label>
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setSelectedDialogIds(new Set());
                }}
                className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name || a.phone_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Atalhos rápidos: marca todos de um kind sem precisar filtrar+selecionar manualmente */}
            <div className="flex flex-wrap gap-2 p-2 rounded bg-(--accent)/5 border border-(--accent)/20">
              <span className="text-(--accent) text-xs font-medium self-center mr-1">Atalhos:</span>
              <button
                type="button"
                onClick={() => selectAllOfKind("contact")}
                className="px-2 py-1 text-xs rounded bg-(--accent)/10 hover:bg-(--accent)/20 text-white"
              >
                + Todos os contatos
              </button>
              <button
                type="button"
                onClick={() => selectAllOfKind("dm")}
                className="px-2 py-1 text-xs rounded bg-(--accent)/10 hover:bg-(--accent)/20 text-white"
              >
                + Todas as DMs
              </button>
              <button
                type="button"
                onClick={() => selectAllOfKind("group_admin")}
                className="px-2 py-1 text-xs rounded bg-(--accent)/10 hover:bg-(--accent)/20 text-white"
              >
                + Grupos que admin
              </button>
              <button
                type="button"
                onClick={() => selectAllOfKind("channel_owner")}
                className="px-2 py-1 text-xs rounded bg-(--accent)/10 hover:bg-(--accent)/20 text-white"
              >
                + Canais meus
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-white/40 text-xs self-center mr-1">Filtrar lista:</span>
              {ALL_FILTERABLE_KINDS.map((k) => (
                <label
                  key={k}
                  className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={kindFilters.has(k)}
                    onChange={() => toggleKind(k)}
                    className="accent-(--accent)"
                  />
                  <span className={k.includes("member") || k.includes("subscriber") ? "text-amber-400" : "text-white/70"}>
                    {KIND_LABELS[k] ?? k}
                  </span>
                </label>
              ))}
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white text-sm"
            />

            <div className="border border-white/5 rounded max-h-64 overflow-y-auto bg-black/20">
              {loadingDialogs ? (
                <p className="p-3 text-white/40 text-xs">Carregando...</p>
              ) : dialogs.length === 0 ? (
                <p className="p-3 text-white/40 text-xs">
                  Sem resultados. Sincronize a conta em <code>/dashboard/automations</code> antes.
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="w-full text-left px-3 py-1.5 text-xs text-(--accent) hover:bg-white/5 border-b border-white/5"
                  >
                    Selecionar todos os {dialogs.length} visíveis
                  </button>
                  {dialogs.map((d) => (
                    <label
                      key={d.id}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDialogIds.has(d.id)}
                        onChange={() => toggleDialog(d.id)}
                        className="accent-(--accent)"
                      />
                      <span className="text-white/80 truncate flex-1">
                        {d.title || d.username || d.id}
                      </span>
                      <span className="text-white/30 text-[10px]">
                        {KIND_LABELS[d.kind] ?? d.kind}
                      </span>
                    </label>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-white/70 text-sm block mb-1">Delay mín (s)</label>
          <input
            type="number"
            value={delayMin}
            onChange={(e) => setDelayMin(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white"
          />
        </div>
        <div className="flex-1">
          <label className="text-white/70 text-sm block mb-1">Delay máx (s)</label>
          <input
            type="number"
            value={delayMax}
            onChange={(e) => setDelayMax(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white"
          />
        </div>
      </div>

      {totalSelected > 0 && (
        <p className="text-white/50 text-xs">
          Estimativa: <b className="text-white/80">{totalSelected}</b> alvo(s), delay médio{" "}
          <b className="text-white/80">{Math.round(avgDelaySec)}s</b> ={" "}
          <b className="text-white/80">~{estimatedMin} minuto(s)</b> por execução.
        </p>
      )}

      {/* Recurrence */}
      <div className="border border-white/10 rounded-lg p-4 bg-white/[0.02] space-y-3">
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={recurrenceEnabled}
            onChange={(e) => setRecurrenceEnabled(e.target.checked)}
            className="accent-(--accent) mt-1"
          />
          <div>
            <div className="text-white text-sm font-medium">Repetir automaticamente (loop)</div>
            <div className="text-white/50 text-xs">
              Quando ativo, a campanha vira recorrente: a primeira execução acontece <b>imediatamente</b> ao salvar/disparar, e depois repete a cada X horas (mínimo 6h).
              Os mesmos alvos recebem a mensagem em todo ciclo.
            </div>
          </div>
        </label>
        {recurrenceEnabled && (
          <div className="pl-6">
            <label className="text-white/60 text-xs block mb-1">Repetir a cada (horas)</label>
            <input
              type="number"
              min={6}
              value={recurrenceHours}
              onChange={(e) => setRecurrenceHours(parseInt(e.target.value, 10) || 24)}
              className="w-32 bg-black/20 border border-white/10 rounded px-2 py-1 text-white text-sm"
            />
            <span className="text-white/40 text-xs ml-2">
              {recurrenceHours === 24
                ? "diário"
                : recurrenceHours < 24
                  ? `${recurrenceHours}h`
                  : `~${Math.floor(recurrenceHours / 24)} dia(s)`}
            </span>
          </div>
        )}
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={(e) => submit(e, false)}
          disabled={pending}
          className="px-4 py-2 rounded border border-white/15 text-white/80 hover:bg-white/5"
        >
          Salvar rascunho
        </button>
        <button
          onClick={(e) => submit(e, true)}
          disabled={pending}
          className="px-4 py-2 rounded bg-(--accent) text-black font-medium"
        >
          Salvar e disparar
        </button>
      </div>
    </form>
  );
}
