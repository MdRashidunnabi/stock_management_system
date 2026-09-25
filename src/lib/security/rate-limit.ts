/**
 * Process-local rate limiter. Multi-instance hosts need Redis or a WAF.
 */

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 30_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  return { ok: true };
}

/** Test helper — not used in production paths. */
export function resetRateLimitStoreForTests() {
  buckets.clear();
  lastSweep = 0;
}
