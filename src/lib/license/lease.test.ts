import { describe, expect, it } from "vitest";
import { evaluateLicenseLease, LICENSE_GRACE_DAYS, type LicenseLease } from "@/lib/license/lease";

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

describe("evaluateLicenseLease", () => {
  const now = Date.UTC(2026, 8, 25, 12, 0, 0);

  it("blocks a till with no lease", () => {
    expect(evaluateLicenseLease(null, { now, deviceId: "d1" }).allowed).toBe(false);
  });

  it("allows a paid till inside the offline grace window", () => {
    expect(evaluateLicenseLease(lease(), { now, deviceId: "d1" }).allowed).toBe(true);
  });

  it("blocks a copied lease on another shop", () => {
    expect(evaluateLicenseLease(lease(), { now, deviceId: "d1", tenantId: "other" }).allowed).toBe(
      false,
    );
  });

  it("blocks a copied lease on another device", () => {
    expect(evaluateLicenseLease(lease(), { now, deviceId: "other" }).allowed).toBe(false);
  });

  it("blocks when ShopOS has marked the shop unlicensed", () => {
    const decision = evaluateLicenseLease(lease({ canSell: false, reason: "suspended" }), {
      now,
      deviceId: "d1",
    });
    expect(decision.allowed).toBe(false);
  });

  it("blocks after the grace window even if canSell is still true", () => {
    const issuedAt = Date.UTC(2026, 0, 1);
    const decision = evaluateLicenseLease(
      lease({
        issuedAt,
        validUntil: issuedAt + 24 * 60 * 60 * 1000,
        graceUntil: issuedAt + LICENSE_GRACE_DAYS * 24 * 60 * 60 * 1000,
      }),
      { now: Date.UTC(2026, 0, 20), deviceId: "d1" },
    );
    expect(decision.allowed).toBe(false);
  });

  it("rejects a forged lease that lasts longer than the grace cap", () => {
    const issuedAt = now;
    const decision = evaluateLicenseLease(
      lease({
        issuedAt,
        validUntil: issuedAt + 400 * 24 * 60 * 60 * 1000,
        graceUntil: issuedAt + 400 * 24 * 60 * 60 * 1000,
      }),
      { now, deviceId: "d1" },
    );
    expect(decision.allowed).toBe(false);
  });
});
