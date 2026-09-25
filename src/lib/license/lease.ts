export const LICENSE_LEASE_HOURS = 24;
export const LICENSE_GRACE_DAYS = 7;
/** Reject obviously forged leases that last longer than grace + one day. */
export const LICENSE_MAX_SPAN_MS = (LICENSE_GRACE_DAYS + 1) * 24 * 60 * 60 * 1000;
export const LICENSE_CLOCK_SKEW_MS = 60 * 60 * 1000;

export type LicenseLease = {
  v: 1;
  tenantId: string;
  deviceId: string;
  status: string;
  canSell: boolean;
  issuedAt: number;
  validUntil: number;
  graceUntil: number;
  reason: string | null;
};

export type LicenseDecision = {
  allowed: boolean;
  reason: string;
};

/** Stable JSON used for Ed25519 signatures. Key order must stay fixed. */
export function canonicalizeLease(lease: LicenseLease): string {
  return JSON.stringify({
    v: lease.v,
    tenantId: lease.tenantId,
    deviceId: lease.deviceId,
    status: lease.status,
    canSell: lease.canSell,
    issuedAt: lease.issuedAt,
    validUntil: lease.validUntil,
    graceUntil: lease.graceUntil,
    reason: lease.reason,
  });
}

export function parseLicenseLease(raw: unknown): LicenseLease | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.tenantId !== "string" || typeof o.deviceId !== "string") return null;
  if (typeof o.status !== "string" || typeof o.canSell !== "boolean") return null;
  if (typeof o.issuedAt !== "number" || typeof o.validUntil !== "number") return null;
  if (typeof o.graceUntil !== "number") return null;
  if (o.reason != null && typeof o.reason !== "string") return null;
  return {
    v: 1,
    tenantId: o.tenantId,
    deviceId: o.deviceId,
    status: o.status,
    canSell: o.canSell,
    issuedAt: o.issuedAt,
    validUntil: o.validUntil,
    graceUntil: o.graceUntil,
    reason: o.reason ?? null,
  };
}

export function evaluateLicenseLease(
  lease: LicenseLease | null,
  opts: { now?: number; deviceId: string; tenantId?: string },
): LicenseDecision {
  const now = opts.now ?? Date.now();
  if (!lease) {
    return {
      allowed: false,
      reason: "This till is not activated. Connect to the internet and sign in once.",
    };
  }
  if (lease.v !== 1) {
    return { allowed: false, reason: "This till license is not recognised. Update ShopOS." };
  }
  if (opts.tenantId && lease.tenantId !== opts.tenantId) {
    return { allowed: false, reason: "This license belongs to another shop." };
  }
  if (lease.deviceId !== opts.deviceId) {
    return { allowed: false, reason: "This license belongs to another device." };
  }
  if (lease.issuedAt > now + LICENSE_CLOCK_SKEW_MS) {
    return { allowed: false, reason: "This till clock is wrong. Check the date and time." };
  }
  if (lease.graceUntil < lease.issuedAt || lease.validUntil < lease.issuedAt) {
    return { allowed: false, reason: "This till license is not valid." };
  }
  if (lease.graceUntil - lease.issuedAt > LICENSE_MAX_SPAN_MS) {
    return { allowed: false, reason: "This till license is not valid." };
  }
  if (!lease.canSell) {
    return {
      allowed: false,
      reason: lease.reason ?? "This shop is not licensed. Pay the ShopOS subscription to continue.",
    };
  }
  if (now > lease.graceUntil) {
    return {
      allowed: false,
      reason: "This till must connect to ShopOS to renew its license.",
    };
  }
  return { allowed: true, reason: lease.reason ?? "" };
}
