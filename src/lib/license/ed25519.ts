import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { canonicalizeLease, type LicenseLease } from "@/lib/license/lease";

/** PKCS8 prefix for a 32-byte Ed25519 seed (RFC 8410). */
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

function privateKeyFromSecret(secret: string) {
  const seed = createHash("sha256").update(`shopos-license-v1:${secret}`).digest();
  const pkcs8 = Buffer.concat([ED25519_PKCS8_PREFIX, seed]);
  return createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
}

export function licensePublicKeySpkiB64(secret: string): string {
  const pub = createPublicKey(privateKeyFromSecret(secret));
  return pub.export({ type: "spki", format: "der" }).toString("base64");
}

export function signLeaseBytes(lease: LicenseLease, secret: string): string {
  const sig = sign(
    null,
    Buffer.from(canonicalizeLease(lease), "utf8"),
    privateKeyFromSecret(secret),
  );
  return sig.toString("base64url");
}

export function verifyLeaseBytes(lease: LicenseLease, signature: string, secret: string): boolean {
  try {
    if (!signature) return false;
    const buf = Buffer.from(signature, "base64url");
    return verify(
      null,
      Buffer.from(canonicalizeLease(lease), "utf8"),
      createPublicKey(privateKeyFromSecret(secret)),
      buf,
    );
  } catch {
    return false;
  }
}
