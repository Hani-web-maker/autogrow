import IORedis from "ioredis";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379") as any;

redis.on("error", (err: Error) => {
  console.error("Redis error:", err.message);
});

export default redis;
