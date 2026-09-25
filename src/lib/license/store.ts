import { parseLicenseLease, type LicenseLease } from "@/lib/license/lease";

export type PackedLicense = {
  lease: LicenseLease;
  signature: string;
};

function storageKey(tenantId: string) {
  return `shopos_license_v1:${tenantId}`;
}

export function readPackedLicense(tenantId: string): PackedLicense | null {
  if (typeof window === "undefined" || !tenantId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lease?: unknown; signature?: unknown };
    const lease = parseLicenseLease(parsed.lease);
    if (!lease || typeof parsed.signature !== "string" || !parsed.signature) return null;
    return { lease, signature: parsed.signature };
  } catch {
    return null;
  }
}

export function writePackedLicense(tenantId: string, packed: PackedLicense): void {
  if (typeof window === "undefined" || !tenantId) return;
  window.localStorage.setItem(storageKey(tenantId), JSON.stringify(packed));
}

export function clearPackedLicense(tenantId: string): void {
  if (typeof window === "undefined" || !tenantId) return;
  window.localStorage.removeItem(storageKey(tenantId));
}
