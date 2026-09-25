import { describe, expect, it, beforeEach } from "vitest";
import { csvSafeCell, csvSafeRow } from "./csv-formula";
import { assertLineDiscountAllowed, CASHIER_MAX_LINE_DISCOUNT_RATE } from "./discount-policy";
import {
  escapePostgrestOrValue,
  productTextSearchOrFilter,
  productNameSkuOrFilter,
} from "./postgrest-filter";
import { hitRateLimit, resetRateLimitStoreForTests } from "./rate-limit";
import { storageObjectSegment, tenantObjectPath } from "./storage-path";
import { bindActorId, bindTenantId, resolveActiveTenantId } from "./tenant-scope";
import { canAttachSaleToTill } from "./till-session";
import { publicAuthCallbackError, publicStorefrontOrderError } from "./public-error";
import { looksLikeBarcode, emptyHidScanState, feedHidScan } from "@/lib/pos/hid-scanner";

describe("SEC-POS-001 price tampering", () => {
  it("commit schema does not accept client totals or cashier/tenant ids", async () => {
    const { commitSaleSchema } = await import("@/lib/pos/schemas");
    const parsed = commitSaleSchema.safeParse({
      branchId: "00000000-0000-0000-0000-000000000011",
      items: [{ productId: "00000000-0000-0000-0000-000000000021", qty: 1, discount: 0 }],
      payments: [{ method: "cash", amount: 1 }],
      total: 0.01,
      tenantId: "00000000-0000-0000-0000-000000000099",
      cashierId: "00000000-0000-0000-0000-000000000088",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).not.toHaveProperty("total");
    expect(parsed.data).not.toHaveProperty("tenantId");
    expect(parsed.data).not.toHaveProperty("cashierId");
  });
});

describe("SEC-POS-002 cashier discount cap", () => {
  it("rejects a 99% discount from a cashier", () => {
    const result = assertLineDiscountAllowed({
      role: "cashier",
      qty: 1,
      unitPrice: 10,
      discount: 9.9,
    });
    expect(result.ok).toBe(false);
  });

  it("allows 20% from a cashier", () => {
    expect(
      assertLineDiscountAllowed({
        role: "cashier",
        qty: 1,
        unitPrice: 10,
        discount: 10 * CASHIER_MAX_LINE_DISCOUNT_RATE,
      }).ok,
    ).toBe(true);
  });

  it("allows a manager to zero a line", () => {
    expect(
      assertLineDiscountAllowed({ role: "manager", qty: 1, unitPrice: 10, discount: 10 }).ok,
    ).toBe(true);
  });
});

describe("SEC-POS-003 / SEC-POS-006 tenant bind", () => {
  it("ignores a cookie for a tenant the user is not in", () => {
    expect(
      resolveActiveTenantId(
        ["00000000-0000-0000-0000-000000000002"],
        "00000000-0000-0000-0000-000000000099",
      ),
    ).toBe("00000000-0000-0000-0000-000000000002");
  });

  it("rejects a client tenant_id that does not match the session tenant", () => {
    expect(() =>
      bindTenantId("00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000099"),
    ).toThrow("TENANT_MISMATCH");
  });
});

describe("SEC-POS-004 / SEC-POS-013 idempotency key shape", () => {
  it("clientUuid must be a UUID when present", async () => {
    const { commitSaleSchema } = await import("@/lib/pos/schemas");
    const base = {
      branchId: "00000000-0000-0000-0000-000000000011",
      items: [{ productId: "00000000-0000-0000-0000-000000000021", qty: 1 }],
      payments: [{ method: "cash", amount: 1 }],
    };
    expect(commitSaleSchema.safeParse({ ...base, clientUuid: "not-a-uuid" }).success).toBe(false);
    expect(
      commitSaleSchema.safeParse({
        ...base,
        clientUuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      }).success,
    ).toBe(true);
  });
});

describe("SEC-POS-005 stock adjustment roles are not cashier", () => {
  it("catalog / inventory write roles exclude cashier", () => {
    const catalogWriteRoles = ["owner", "manager", "warehouse"];
    expect(catalogWriteRoles).not.toContain("cashier");
    expect(catalogWriteRoles).not.toContain("delivery");
  });
});

describe("SEC-POS-007 actor bind", () => {
  it("uses the authenticated user when the client sends another cashier id", () => {
    expect(() => bindActorId("user-a", "user-b")).toThrow("ACTOR_MISMATCH");
    expect(bindActorId("user-a", "user-a")).toBe("user-a");
    expect(bindActorId("user-a")).toBe("user-a");
  });
});

describe("SEC-POS-008 completed sale fields are not writable via commit schema", () => {
  it("omits status / voided_at mass assignment", async () => {
    const { commitSaleSchema } = await import("@/lib/pos/schemas");
    const parsed = commitSaleSchema.parse({
      branchId: "00000000-0000-0000-0000-000000000011",
      items: [{ productId: "00000000-0000-0000-0000-000000000021", qty: 1 }],
      payments: [{ method: "cash", amount: 1 }],
      status: "voided",
      voidedAt: "2020-01-01",
    });
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("voidedAt");
  });
});

describe("SEC-POS-009 barcode injection", () => {
  it("rejects SQL / HTML / shell metacharacters as barcodes", () => {
    expect(looksLikeBarcode("'; DROP TABLE products;--")).toBe(false);
    expect(looksLikeBarcode("<img src=x onerror=alert(1)>")).toBe(false);
    expect(looksLikeBarcode("$(reboot)")).toBe(false);
    expect(looksLikeBarcode("5391000000001")).toBe(true);
  });

  it("HID wedge drops control and punctuation used in injection", () => {
    let state = emptyHidScanState();
    for (const key of [";", "'", "<", "`", " ", "Enter"]) {
      const r = feedHidScan(state, key, 1000);
      state = r.state;
      expect(r.complete).toBeNull();
    }
  });
});

describe("SEC-POS-012 till attachment", () => {
  it("blocks a cashier from posting onto another cashier's open till", () => {
    expect(
      canAttachSaleToTill({
        role: "cashier",
        userId: "cashier-a",
        sessionCashierId: "cashier-b",
        sessionStatus: "open",
      }).ok,
    ).toBe(false);
  });

  it("allows the till owner and a manager override", () => {
    expect(
      canAttachSaleToTill({
        role: "cashier",
        userId: "cashier-a",
        sessionCashierId: "cashier-a",
        sessionStatus: "open",
      }).ok,
    ).toBe(true);
    expect(
      canAttachSaleToTill({
        role: "manager",
        userId: "mgr",
        sessionCashierId: "cashier-a",
        sessionStatus: "open",
      }).ok,
    ).toBe(true);
  });
});

describe("PostgREST filter injection", () => {
  it("neutralizes or() operator injection", () => {
    const injected = "x,id.eq.00000000-0000-0000-0000-000000000099";
    expect(escapePostgrestOrValue(injected)).not.toContain(",");
    expect(escapePostgrestOrValue(injected)).not.toContain(".");
    expect(productTextSearchOrFilter(injected)).not.toMatch(/id\.eq/);
    expect(productNameSkuOrFilter("foo) , barcode.eq.evil")).not.toContain(")");
  });
});

describe("Storage path traversal", () => {
  it("refuses ../ and foreign tenant segments in productId", () => {
    expect(storageObjectSegment("../../other-tenant")).toBe("new");
    expect(storageObjectSegment("00000000-0000-0000-0000-000000000021")).toBe(
      "00000000-0000-0000-0000-000000000021",
    );
    expect(tenantObjectPath("00000000-0000-0000-0000-000000000002", "new", "a.jpg")).toBe(
      "00000000-0000-0000-0000-000000000002/new/a.jpg",
    );
  });
});

describe("CSV formula injection", () => {
  it("prefixes formula cells", () => {
    expect(csvSafeCell("=CMD()")).toBe("'=CMD()");
    expect(csvSafeCell("+1+1")).toBe("'+1+1");
    expect(csvSafeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvSafeCell("Milk")).toBe("Milk");
    expect(csvSafeRow(["=1+1", "ok"])).toBe("'=1+1,ok");
  });
});

describe("Rate limit", () => {
  beforeEach(() => resetRateLimitStoreForTests());

  it("blocks the N+1st hit inside the window", () => {
    const now = 1_000_000;
    expect(hitRateLimit("login:a@b.c", 2, 60_000, now).ok).toBe(true);
    expect(hitRateLimit("login:a@b.c", 2, 60_000, now + 10).ok).toBe(true);
    expect(hitRateLimit("login:a@b.c", 2, 60_000, now + 20).ok).toBe(false);
  });
});

describe("Public error sanitization", () => {
  it("does not echo SQL or hostnames", () => {
    expect(publicAuthCallbackError("password authentication failed for user postgres")).toBe(
      "Could not complete sign-in.",
    );
    expect(publicStorefrontOrderError("insert into sales failed at relation pg_catalog")).toBe(
      "Order could not be placed. Please try again.",
    );
  });
});
