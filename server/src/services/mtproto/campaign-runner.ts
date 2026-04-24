import type { AccountPool } from "./pool.js";

export interface CampaignTargetRow {
  id: string;
  identifier: string;
  type: "username" | "phone";
  status: "pending" | "sent" | "failed";
}

export interface RunnerDeps {
  sendMessage: (
    accountId: string,
    target: { identifier: string; type: "username" | "phone" },
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
      const account = this.pool.next();
      if (!account) {
        await this.deps.setCampaignStatus(this.cfg.campaignId, "paused");
        return;
      }

      try {
        await this.deps.sendMessage(
          account.id,
          { identifier: target.identifier, type: target.type },
          this.cfg.messageText,
        );
        await this.deps.markTargetSent(target.id, account.id);
        await this.deps.incrementCounters(this.cfg.campaignId, "sent");
      } catch (err) {
        const floodSeconds = extractFloodWait(err);
        if (floodSeconds !== null) {
          this.pool.markFloodWait(account.id, floodSeconds);
          const nextAccount = this.pool.next();
          if (!nextAccount) {
            await this.deps.setCampaignStatus(this.cfg.campaignId, "paused");
            return;
          }
          try {
            await this.deps.sendMessage(
              nextAccount.id,
              { identifier: target.identifier, type: target.type },
              this.cfg.messageText,
            );
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
