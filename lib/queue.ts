import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const url = new URL(redisUrl);

export const redisConnection = {
  host: url.hostname,
  port: parseInt(url.port || "6379"),
  password: url.password || undefined,
  // Required by BullMQ — it manages its own retry/backoff strategy.
  maxRetriesPerRequest: null,
  ...(url.protocol === "rediss:" ? { tls: {} } : {}),
};

export const reportQueue = new Queue("reports", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});
