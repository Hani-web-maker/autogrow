import redis from "./redis";

/**
 * Fixed-window rate limiter backed by Redis. Fails open (allows the request) if
 * Redis is unreachable, since auth/report endpoints should stay available during
 * a cache outage — but we log so the fail-open path is visible in production logs.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return count <= limit;
  } catch (err) {
    console.warn(`Rate limiter unavailable, failing open for key "${key}":`, err);
    return true;
  }
}
