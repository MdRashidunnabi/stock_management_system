import "server-only";

import { env } from "@/lib/env";
import type { LicenseLease } from "@/lib/license/lease";
import { licensePublicKeySpkiB64, signLeaseBytes, verifyLeaseBytes } from "@/lib/license/ed25519";

function signingSecret(): string {
  const explicit = env.LICENSE_SIGNING_SECRET?.trim() || process.env.LICENSE_SIGNING_SECRET?.trim();
  if (explicit) return explicit;
  if (env.AUTH_SECRET?.trim()) return env.AUTH_SECRET;
  return env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 64);
}

export function getLicensePublicKeySpkiB64(): string {
  return licensePublicKeySpkiB64(signingSecret());
}

export function signLicenseLease(lease: LicenseLease): string {
  return signLeaseBytes(lease, signingSecret());
}

export function verifyLicenseLeaseSig(lease: LicenseLease, signature: string): boolean {
  return verifyLeaseBytes(lease, signature, signingSecret());
}
