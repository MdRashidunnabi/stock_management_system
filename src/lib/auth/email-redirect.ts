/**
 * Auth emails must open the site the user signed up on (Vercel), never a
 * hardcoded localhost URL that happens to sit in NEXT_PUBLIC_APP_URL.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function originFromForwardedHeaders(input: {
  origin?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
}): string | null {
  if (input.origin) {
    try {
      return new URL(input.origin).origin;
    } catch {
      /* ignore */
    }
  }

  const host = (input.forwardedHost ?? input.host ?? "").split(",")[0]?.trim();
  if (!host) return null;

  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  const protoRaw = (input.forwardedProto ?? "").split(",")[0]?.trim().toLowerCase();
  const proto =
    protoRaw === "http" || protoRaw === "https"
      ? protoRaw
      : LOCAL_HOSTS.has(hostname)
        ? "http"
        : "https";

  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}

export function isLocalAuthOrigin(origin: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(origin).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isAllowedAuthOrigin(origin: string, configuredAppUrl: string): boolean {
  let incoming: URL;
  try {
    incoming = new URL(origin);
  } catch {
    return false;
  }
  if (incoming.protocol !== "http:" && incoming.protocol !== "https:") return false;

  const host = incoming.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host)) return true;
  if (host.endsWith(".vercel.app")) return true;

  try {
    const configured = new URL(configuredAppUrl);
    return host === configured.hostname.toLowerCase();
  } catch {
    return false;
  }
}

export function authEmailRedirectTo(
  requestOrigin: string | null | undefined,
  configuredAppUrl: string,
  nextPath: string,
): string {
  const next = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
  const configured = configuredAppUrl.replace(/\/$/, "");
  let origin = configured;
  if (requestOrigin && isAllowedAuthOrigin(requestOrigin, configuredAppUrl)) {
    const incoming = requestOrigin.replace(/\/$/, "");
    // Cloud / live APP_URL must win over localhost so reset mail never opens
    // a machine that is not running.
    origin = isLocalAuthOrigin(incoming) && !isLocalAuthOrigin(configured) ? configured : incoming;
  }
  return `${origin}/auth/callback?next=${next}`;
}

export function looksLikeAuthCode(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[A-Za-z0-9._-]{8,200}$/.test(value);
}

export function looksLikeAuthTokenHash(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[A-Za-z0-9._-]{20,400}$/.test(value);
}

export const EMAIL_OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const;

export type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

export function asEmailOtpType(value: string | null | undefined): EmailOtpType | null {
  if (!value) return null;
  return EMAIL_OTP_TYPES.includes(value as EmailOtpType) ? (value as EmailOtpType) : null;
}

export function defaultNextForAuthType(
  type: string | null | undefined,
  requestedNext: string | null,
): string {
  if (type === "recovery") return "/reset-password";
  if (requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")) {
    return requestedNext;
  }
  return "/dashboard";
}

export function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Turn a broken localhost email URL (or a raw code) into a live /auth/callback URL. */
export function liveAuthCallbackUrlFromPastedLink(
  raw: string,
  appOrigin: string,
  fallbackNext: string,
): string | null {
  const text = raw.trim();
  if (!text) return null;

  let parsed: URL | null = null;
  try {
    parsed = new URL(text);
  } catch {
    parsed = null;
  }

  let code: string | null = null;
  let tokenHash: string | null = null;
  let type: string | null = null;
  let next = fallbackNext;

  if (parsed) {
    code = parsed.searchParams.get("code");
    tokenHash = parsed.searchParams.get("token_hash");
    type = parsed.searchParams.get("type");
    const requested = parsed.searchParams.get("next");
    if (requested && requested.startsWith("/") && !requested.startsWith("//")) {
      next = requested;
    }
  } else if (looksLikeUuid(text) || looksLikeAuthCode(text)) {
    code = text;
  } else if (looksLikeAuthTokenHash(text)) {
    tokenHash = text;
  }

  const origin = appOrigin.replace(/\/$/, "");
  if (tokenHash && looksLikeAuthTokenHash(tokenHash)) {
    const dest = new URL("/auth/callback", `${origin}/`);
    dest.searchParams.set("token_hash", tokenHash);
    dest.searchParams.set("type", type || (fallbackNext === "/reset-password" ? "recovery" : "email"));
    dest.searchParams.set("next", defaultNextForAuthType(type, next));
    return dest.toString();
  }
  if (code && looksLikeAuthCode(code)) {
    const dest = new URL("/auth/callback", `${origin}/`);
    dest.searchParams.set("code", code);
    dest.searchParams.set("next", defaultNextForAuthType(type, next));
    if (type) dest.searchParams.set("type", type);
    else if (fallbackNext === "/reset-password") dest.searchParams.set("type", "recovery");
    return dest.toString();
  }
  return null;
}
