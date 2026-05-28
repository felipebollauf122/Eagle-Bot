"use client";

import { useState } from "react";

interface Product {
  id: string;
  name: string;
  ghost_name: string | null;
  ghost_description: string | null;
  description: string | null;
}

interface Lead {
  id: string;
  telegram_user_id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  tid: string | null;
  fbclid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface Bot {
  bot_username: string;
}

interface Transaction {
  id: string;
  external_id: string;
  amount: number;
  currency: string;
  status: string;
  gateway: string;
  paid_at: string | null;
  created_at: string;
  lead_id: string;
  bot_id: string;
  product_id: string;
  flow_id: string | null;
  products: Product | null;
  leads: Lead;
  bots: Bot | null;
}

interface OtherTx {
  id: string;
  status: string;
  amount: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
  products: { name: string; ghost_name: string | null } | null;
}

interface TrackingEvent {
  event_data: Record<string, unknown> | null;
  created_at: string;
  event_type: string;
}

const statusLabel: Record<string, { text: string; color: string }> = {
  approved: { text: "PAGO", color: "bg-green-500/20 text-green-300 border-green-500/40" },
  pending: { text: "PENDENTE", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  refused: { text: "RECUSADO", color: "bg-red-500/20 text-red-300 border-red-500/40" },
  refunded: { text: "REEMBOLSADO", color: "bg-red-500/30 text-red-200 border-red-500/50" },
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "long" });
}

function fmtCurrency(amount: number, currency: string): string {
  return (amount / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

export function ProofView({
  transaction,
  trackingEvent,
  otherTransactions,
}: {
  transaction: Transaction;
  trackingEvent: TrackingEvent | null;
  otherTransactions: OtherTx[];
}) {
  const [showRaw, setShowRaw] = useState(false);
  const product = transaction.products;
  const lead = transaction.leads;
  const productDisplay = product?.ghost_name || product?.name || "—";
  const productDescription = product?.ghost_description || product?.description || null;
  const status = statusLabel[transaction.status] ?? { text: transaction.status, color: "bg-white/10 text-white/70 border-white/20" };

  const buyerEmail = String(lead.state?.email ?? "—");
  const buyerPhone = String(lead.state?.phone ?? "—");
  const buyerDocument = String(lead.state?.document ?? "—");

  // Timeline reconstruída
  const timeline: Array<{ time: string; label: string; detail?: string }> = [];
  timeline.push({
    time: lead.created_at,
    label: "Lead criado (primeiro /start no bot)",
    detail: `Telegram ID ${lead.telegram_user_id}${lead.username ? ` · @${lead.username}` : ""}`,
  });
  if (trackingEvent) {
    timeline.push({
      time: trackingEvent.created_at,
      label: "Página de tracking visitada",
      detail: trackingEvent.event_type,
    });
  }
  timeline.push({
    time: transaction.created_at,
    label: "PIX gerado (cliente solicitou pagamento)",
    detail: `${transaction.gateway} · ${fmtCurrency(transaction.amount, transaction.currency)}`,
  });
  if (transaction.paid_at) {
    timeline.push({
      time: transaction.paid_at,
      label: "Pagamento confirmado pela gateway",
      detail: `Status final: ${transaction.status}`,
    });
  }
  timeline.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // Dados do tracking (IP/UA estão em event_data)
  const evData = trackingEvent?.event_data ?? null;
  const ipFromTracking = evData ? String((evData as Record<string, unknown>).ip ?? "") : "";
  const uaFromTracking = evData ? String((evData as Record<string, unknown>).user_agent ?? (evData as Record<string, unknown>).ua ?? "") : "";

  return (
    <div className="p-8 max-w-3xl mx-auto print:p-4 print:max-w-none">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-8 print:mb-4">
        <div>
          <a
            href={`/dashboard/bots/${transaction.bot_id}/transactions`}
            className="text-(--text-muted) hover:text-foreground text-sm print:hidden"
          >
            ← Voltar
          </a>
          <h1 className="text-2xl font-bold text-foreground mt-2">
            Comprovação de compra
          </h1>
          <p className="text-(--text-muted) text-sm">
            Documento gerado para contestação / chargeback evidence
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="btn-primary print:hidden"
        >
          Imprimir / PDF
        </button>
      </div>

      {/* Status grande */}
      <div className={`mb-6 p-4 rounded-xl border ${status.color} flex items-center justify-between`}>
        <div>
          <div className="text-xs uppercase tracking-wider opacity-70">Status</div>
          <div className="text-2xl font-bold">{status.text}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider opacity-70">Valor</div>
          <div className="text-2xl font-bold">
            {fmtCurrency(transaction.amount, transaction.currency)}
          </div>
        </div>
      </div>

      {/* Produto */}
      <div className="card p-5 mb-5">
        <h2 className="text-(--text-secondary) text-xs font-bold uppercase tracking-wider mb-3">
          Produto adquirido
        </h2>
        <p className="text-foreground text-xl font-semibold">{productDisplay}</p>
        {productDescription && (
          <p className="text-(--text-muted) text-sm mt-1">{productDescription}</p>
        )}
        <div className="mt-3 pt-3 border-t border-(--border-subtle) text-xs text-(--text-ghost) font-mono">
          <div>Product ID: {product?.id ?? "—"}</div>
        </div>
      </div>

      {/* Comprador */}
      <div className="card p-5 mb-5">
        <h2 className="text-(--text-secondary) text-xs font-bold uppercase tracking-wider mb-3">
          Comprador
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-(--text-muted) text-xs">Nome</div>
            <div className="text-foreground font-medium">
              {lead.first_name} {lead.last_name ?? ""}
            </div>
          </div>
          <div>
            <div className="text-(--text-muted) text-xs">Username Telegram</div>
            <div className="text-foreground font-mono">
              {lead.username ? `@${lead.username}` : "—"}
            </div>
          </div>
          <div>
            <div className="text-(--text-muted) text-xs">Telegram ID</div>
            <div className="text-foreground font-mono">{lead.telegram_user_id}</div>
          </div>
          <div>
            <div className="text-(--text-muted) text-xs">Email informado</div>
            <div className="text-foreground">{buyerEmail}</div>
          </div>
          <div>
            <div className="text-(--text-muted) text-xs">Telefone informado</div>
            <div className="text-foreground">{buyerPhone}</div>
          </div>
          <div>
            <div className="text-(--text-muted) text-xs">Documento</div>
            <div className="text-foreground">{buyerDocument}</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-(--border-subtle) text-xs text-(--text-ghost) font-mono">
          <div>Lead ID: {lead.id}</div>
          <div>Bot: @{transaction.bots?.bot_username ?? "—"}</div>
        </div>
      </div>

      {/* PIX */}
      <div className="card p-5 mb-5">
        <h2 className="text-(--text-secondary) text-xs font-bold uppercase tracking-wider mb-3">
          Pagamento
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-(--text-muted) text-xs">Gateway</div>
            <div className="text-foreground font-medium uppercase">{transaction.gateway}</div>
          </div>
          <div>
            <div className="text-(--text-muted) text-xs">Método</div>
            <div className="text-foreground font-medium">PIX</div>
          </div>
          <div>
            <div className="text-(--text-muted) text-xs">Criado em</div>
            <div className="text-foreground text-xs">{fmtDateTime(transaction.created_at)}</div>
          </div>
          <div>
            <div className="text-(--text-muted) text-xs">Pago em</div>
            <div className="text-foreground text-xs">{fmtDateTime(transaction.paid_at)}</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-(--border-subtle) text-xs text-(--text-ghost) font-mono break-all">
          <div>Transaction ID (interno): {transaction.id}</div>
          <div>Transaction ID (gateway): {transaction.external_id}</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="card p-5 mb-5">
        <h2 className="text-(--text-secondary) text-xs font-bold uppercase tracking-wider mb-3">
          Linha do tempo
        </h2>
        <ol className="space-y-3">
          {timeline.map((ev, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="text-(--text-ghost) text-xs font-mono whitespace-nowrap pt-0.5">
                {new Date(ev.time).toLocaleString("pt-BR")}
              </span>
              <div>
                <div className="text-foreground font-medium">{ev.label}</div>
                {ev.detail && <div className="text-(--text-muted) text-xs">{ev.detail}</div>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Origem (UTMs + tracking) */}
      <div className="card p-5 mb-5">
        <h2 className="text-(--text-secondary) text-xs font-bold uppercase tracking-wider mb-3">
          Origem do tráfego
        </h2>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {(["utm_source","utm_medium","utm_campaign","utm_content","utm_term"] as const).map((k) => (
            <div key={k}>
              <div className="text-(--text-muted)">{k}</div>
              <div className="text-foreground font-mono break-all">
                {(lead[k] as string | null) ?? "—"}
              </div>
            </div>
          ))}
          <div>
            <div className="text-(--text-muted)">tid</div>
            <div className="text-foreground font-mono break-all">{lead.tid ?? "—"}</div>
          </div>
          <div>
            <div className="text-(--text-muted)">fbclid</div>
            <div className="text-foreground font-mono break-all">{lead.fbclid ?? "—"}</div>
          </div>
          {ipFromTracking && (
            <div>
              <div className="text-(--text-muted)">IP do clique inicial</div>
              <div className="text-foreground font-mono">{ipFromTracking}</div>
            </div>
          )}
          {uaFromTracking && (
            <div className="col-span-2">
              <div className="text-(--text-muted)">Navegador / User Agent</div>
              <div className="text-foreground font-mono text-[10px] break-all">{uaFromTracking}</div>
            </div>
          )}
        </div>
      </div>

      {/* Outras transações do mesmo lead */}
      {otherTransactions.length > 0 && (
        <div className="card p-5 mb-5">
          <h2 className="text-(--text-secondary) text-xs font-bold uppercase tracking-wider mb-3">
            Outras transações deste comprador ({otherTransactions.length})
          </h2>
          <ul className="space-y-1.5">
            {otherTransactions.map((o) => (
              <li key={o.id} className="flex items-center justify-between text-xs">
                <span className="text-foreground">
                  {o.products?.ghost_name || o.products?.name || "—"} ·{" "}
                  <span className="text-(--text-muted)">
                    {new Date(o.created_at).toLocaleString("pt-BR")}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-(--text-muted)">{fmtCurrency(o.amount, o.currency)}</span>
                  <span className={`badge ${statusLabel[o.status]?.color ?? ""} text-[10px]`}>
                    {statusLabel[o.status]?.text ?? o.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw dump pra contestação técnica */}
      <div className="card p-5 mb-5 print:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-(--text-secondary) text-xs font-bold uppercase tracking-wider">
            Dados técnicos (JSON)
          </h2>
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="text-(--accent) text-xs hover:underline"
          >
            {showRaw ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {showRaw && (
          <pre className="mt-3 p-3 rounded bg-black/40 border border-white/5 text-[10px] text-(--text-muted) overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(
              {
                transaction: {
                  id: transaction.id,
                  external_id: transaction.external_id,
                  amount: transaction.amount,
                  currency: transaction.currency,
                  status: transaction.status,
                  gateway: transaction.gateway,
                  created_at: transaction.created_at,
                  paid_at: transaction.paid_at,
                },
                product: {
                  id: product?.id,
                  name_shown_to_buyer: product?.name,
                  name_on_invoice: productDisplay,
                  description_on_invoice: productDescription,
                },
                lead: {
                  id: lead.id,
                  telegram_user_id: lead.telegram_user_id,
                  username: lead.username,
                  first_name: lead.first_name,
                  last_name: lead.last_name,
                  email: lead.state?.email,
                  phone: lead.state?.phone,
                  document: lead.state?.document,
                  created_at: lead.created_at,
                },
                tracking: trackingEvent
                  ? {
                      first_seen: trackingEvent.created_at,
                      event_type: trackingEvent.event_type,
                      event_data: trackingEvent.event_data,
                    }
                  : null,
              },
              null,
              2,
            )}
          </pre>
        )}
      </div>

      <p className="text-(--text-ghost) text-[10px] text-center mt-8 print:mt-4">
        Documento emitido pelo painel EagleBot · {fmtDateTime(new Date().toISOString())}
      </p>
    </div>
  );
}
