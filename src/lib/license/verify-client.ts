import { canonicalizeLease, type LicenseLease } from "@/lib/license/lease";

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const normalized = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const bin = atob(normalized + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Verify an Ed25519 lease signature in the browser.
 * The public key comes from ShopOS (layout / heartbeat), never from the stored lease.
 */
export async function verifyLeaseSignature(
  lease: LicenseLease,
  signature: string,
  publicKeySpkiB64: string,
): Promise<boolean> {
  if (!signature || !publicKeySpkiB64) return false;
  if (typeof crypto === "undefined" || !crypto.subtle) return false;
  try {
    const key = await crypto.subtle.importKey(
      "spki",
      b64ToBytes(publicKeySpkiB64),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      b64ToBytes(signature),
      new TextEncoder().encode(canonicalizeLease(lease)),
    );
  } catch {
    return false;
  }
}
