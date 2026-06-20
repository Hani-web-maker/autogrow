import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redis = new IORedis(redisUrl, {
  tls: redisUrl.startsWith("rediss://") ? {} : undefined,
});

redis.on("error", (err: Error) => {
  console.error("Redis error:", err.message);
});

export default redis;
