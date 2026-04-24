import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export type MtprotoJobData =
  | { kind: "auth.request-code"; accountId: string; phoneNumber: string }
  | { kind: "auth.sign-in"; accountId: string; phoneNumber: string; code: string }
  | { kind: "auth.submit-password"; accountId: string; password: string }
  | { kind: "campaign.run"; campaignId: string };

export const mtprotoQueue = new Queue<MtprotoJobData>("mtproto", { connection });

export async function enqueueMtproto(data: MtprotoJobData): Promise<void> {
  await mtprotoQueue.add(data.kind, data, {
    attempts: 2,
    backoff: { type: "fixed", delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}
