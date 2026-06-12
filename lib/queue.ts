import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const url = new URL(redisUrl);

export const redisConnection = {
  host: url.hostname,
  port: parseInt(url.port || "6379"),
  password: url.password || undefined,
};

export const reportQueue = new Queue("reports", { connection: redisConnection });
