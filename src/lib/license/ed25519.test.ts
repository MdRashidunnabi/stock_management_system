import { describe, expect, it } from "vitest";
import { canonicalizeLease, LICENSE_GRACE_DAYS, type LicenseLease } from "@/lib/license/lease";
import { licensePublicKeySpkiB64, signLeaseBytes, verifyLeaseBytes } from "@/lib/license/ed25519";

function lease(over: Partial<LicenseLease> = {}): LicenseLease {
  const issuedAt = Date.UTC(2026, 8, 24, 12, 0, 0);
  return {
    v: 1,
    tenantId: "t1",
    deviceId: "d1",
    status: "active",
    canSell: true,
    issuedAt,
    validUntil: issuedAt + 24 * 60 * 60 * 1000,
    graceUntil: issuedAt + LICENSE_GRACE_DAYS * 24 * 60 * 60 * 1000,
    reason: null,
    ...over,
  };
}

describe("license Ed25519", () => {
  const secret = "unit-test-license-secret-key";

  it("round-trips a signature", () => {
    const payload = lease();
    const signature = signLeaseBytes(payload, secret);
    expect(verifyLeaseBytes(payload, signature, secret)).toBe(true);
    expect(licensePublicKeySpkiB64(secret).length).toBeGreaterThan(40);
  });

  it("rejects a tampered canSell flag", () => {
    const payload = lease();
    const signature = signLeaseBytes(payload, secret);
    expect(verifyLeaseBytes(lease({ canSell: false }), signature, secret)).toBe(false);
  });

  it("rejects a signature from another secret", () => {
    const payload = lease();
    const signature = signLeaseBytes(payload, secret);
    expect(verifyLeaseBytes(payload, signature, "other-secret-key-value")).toBe(false);
  });

  it("canonical JSON is stable", () => {
    expect(canonicalizeLease(lease())).toBe(canonicalizeLease(lease()));
  });
});
