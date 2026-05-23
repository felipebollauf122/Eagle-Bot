import type { AccountPool } from "./pool.js";

export interface CampaignTargetRow {
  id: string;
  identifier: string;
  type: "username" | "phone";
  status: "pending" | "sent" | "failed";
  /**
   * Quando setado, o runner ignora identifier/type e envia direto pro peer
   * via sendMessageToPeer do MtprotoClient (mais barato e seguro — não tenta
   * resolveUsername nem importContacts).
   */
  dialog?: {
    peerId: string;
    peerType: "user" | "chat" | "channel";
    peerAccessHash: string | null;
  };
  /**
   * Quando setado, força essa conta específica a enviar (ignora round-robin
   * do pool). Usado em campanhas globais — cada target já vem com a conta
   * dona do dialog. Se a conta estiver indisponível (flood_wait/banned), o
   * target é pulado naquele tick e retentado depois.
   */
  pinnedAccountId?: string;
}

export interface RunnerDeps {
  sendMessage: (
    accountId: string,
    target: CampaignTargetRow,
    text: string,
  ) => Promise<void>;
  markTargetSent: (targetId: string, accountId: string) => Promise<void>;
  markTargetFailed: (targetId: string, accountId: string | null, error: string) => Promise<void>;
  incrementCounters: (campaignId: string, kind: "sent" | "failed") => Promise<void>;
  setCampaignStatus: (
    campaignId: string,
    status: "running" | "paused" | "completed" | "failed",
  ) => Promise<void>;
  delay: (ms: number) => Promise<void>;
}

export interface CampaignConfig {
  campaignId: string;
  messageText: string;
  delayMinSeconds: number;
  delayMaxSeconds: number;
}

interface FloodWaitErrorLike {
  seconds?: number;
  message?: string;
}

function extractFloodWait(err: unknown): number | null {
  if (err && typeof err === "object") {
    const e = err as FloodWaitErrorLike;
    const msg = e.message ?? String(err);
    if (/FLOOD/i.test(msg) && typeof e.seconds === "number") return e.seconds;
  }
  return null;
}

function isFatalAccountError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /AUTH_KEY|USER_DEACTIVATED|SESSION_REVOKED|PHONE_NUMBER_BANNED/i.test(msg);
}

export class CampaignRunner {
  constructor(
    private pool: AccountPool,
    private deps: RunnerDeps,
    private cfg: CampaignConfig,
  ) {}

  async run(targets: CampaignTargetRow[]): Promise<void> {
    await this.deps.setCampaignStatus(this.cfg.campaignId, "running");

    const pending = targets.filter((t) => t.status === "pending");
    for (const target of pending) {
      // Se o target tem conta pré-atribuída (campanha global), usa SÓ
      // ela — não cai pra outra conta no fallback porque o access_hash
      // do dialog dela não vale pra outras contas.
      const isPinned = !!target.pinnedAccountId;
      const account = isPinned
        ? this.pool.getById(target.pinnedAccountId!)
        : this.pool.next();
      if (!account) {
        if (isPinned) {
          // Conta dona desse target tá indisponível — pula este target e
          // segue a campanha. Outras contas ainda podem processar os
          // próprios targets.
          await this.deps.markTargetFailed(
            target.id,
            target.pinnedAccountId!,
            "pinned_account_unavailable",
          );
          await this.deps.incrementCounters(this.cfg.campaignId, "failed");
          continue;
        }
        await this.deps.setCampaignStatus(this.cfg.campaignId, "paused");
        return;
      }

      try {
        await this.deps.sendMessage(account.id, target, this.cfg.messageText);
        await this.deps.markTargetSent(target.id, account.id);
        await this.deps.incrementCounters(this.cfg.campaignId, "sent");
      } catch (err) {
        const floodSeconds = extractFloodWait(err);
        if (floodSeconds !== null) {
          this.pool.markFloodWait(account.id, floodSeconds);
          // Em targets pinned não dá pra trocar de conta (access_hash
          // não bate). Marca como falha e segue.
          if (isPinned) {
            await this.deps.markTargetFailed(
              target.id,
              account.id,
              `flood_wait_${floodSeconds}s`,
            );
            await this.deps.incrementCounters(this.cfg.campaignId, "failed");
          } else {
            const nextAccount = this.pool.next();
            if (!nextAccount) {
              await this.deps.setCampaignStatus(this.cfg.campaignId, "paused");
              return;
            }
            try {
              await this.deps.sendMessage(nextAccount.id, target, this.cfg.messageText);
              await this.deps.markTargetSent(target.id, nextAccount.id);
              await this.deps.incrementCounters(this.cfg.campaignId, "sent");
            } catch (err2) {
              if (isFatalAccountError(err2)) this.pool.markBanned(nextAccount.id);
              await this.deps.markTargetFailed(
                target.id,
                nextAccount.id,
                err2 instanceof Error ? err2.message : String(err2),
              );
              await this.deps.incrementCounters(this.cfg.campaignId, "failed");
            }
          }
        } else {
          if (isFatalAccountError(err)) this.pool.markBanned(account.id);
          await this.deps.markTargetFailed(
            target.id,
            account.id,
            err instanceof Error ? err.message : String(err),
          );
          await this.deps.incrementCounters(this.cfg.campaignId, "failed");
        }
      }

      const min = this.cfg.delayMinSeconds * 1000;
      const max = this.cfg.delayMaxSeconds * 1000;
      const wait = min + Math.floor(Math.random() * Math.max(1, max - min + 1));
      if (wait > 0) await this.deps.delay(wait);
    }

    await this.deps.setCampaignStatus(this.cfg.campaignId, "completed");
  }
}
