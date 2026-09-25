import "server-only";

import { env } from "@/lib/env";
import type { LicenseLease } from "@/lib/license/lease";
import { licensePublicKeySpkiB64, signLeaseBytes, verifyLeaseBytes } from "@/lib/license/ed25519";

function signingSecret(): string {
  const explicit = env.LICENSE_SIGNING_SECRET?.trim() || process.env.LICENSE_SIGNING_SECRET?.trim();
  if (explicit) return explicit;
  const auth = env.AUTH_SECRET?.trim();
  if (auth && auth.length >= 16) return auth;
  throw new Error(
    "LICENSE_SIGNING_SECRET (or AUTH_SECRET) must be set. Do not derive till signatures from the database service role.",
  );
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
