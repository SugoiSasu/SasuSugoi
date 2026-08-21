/**
 * In-memory sliding-window rate limiter. Per-process only (fine for a single
 * Nitro instance; a multi-instance deploy would need a shared store like
 * Redis, but this is a proportionate first line of defense either way).
 */
export function createRateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, number[]>();

  return function isRateLimited(key: string): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) {
      for (const [k, times] of hits) {
        if (times.every((t) => t <= windowStart)) hits.delete(k);
      }
    }
    return recent.length > max;
  };
}
