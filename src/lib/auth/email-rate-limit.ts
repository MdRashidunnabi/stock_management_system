import { hitRateLimit, type RateLimitResult } from "@/lib/security/rate-limit";

/** Shop owners: a few retries if mail is slow. Not an hour-long lockout. */
export const AUTH_MAIL = {
  minGapMs: 60_000,
  maxPerWindow: 5,
  windowMs: 15 * 60 * 1000,
} as const;

export function hitAuthEmailLimit(
  kind: "reset" | "signup",
  email: string,
  now = Date.now(),
): RateLimitResult {
  const id = email.trim().toLowerCase();
  const gap = hitRateLimit(`auth-mail-gap:${kind}:${id}`, 1, AUTH_MAIL.minGapMs, now);
  if (!gap.ok) return gap;
  return hitRateLimit(
    `auth-mail-win:${kind}:${id}`,
    AUTH_MAIL.maxPerWindow,
    AUTH_MAIL.windowMs,
    now,
  );
}
