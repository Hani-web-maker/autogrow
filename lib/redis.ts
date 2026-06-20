import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const redis = new IORedis(redisUrl, {
  tls: redisUrl.startsWith("rediss://") ? {} : undefined,
}) as any;

redis.on("error", (err: Error) => {
  console.error("Redis error:", err.message);
});

export default redis;
