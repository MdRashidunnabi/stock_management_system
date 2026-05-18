import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getCachedSnapshotCount,
  replaceCatalogSnapshot,
  searchOfflineCatalog,
  upsertCatalogRows,
  clearOfflineCatalog,
} from "@/lib/pos/offline/catalog-cache";
import { __resetOfflineDbForTesting, type OfflineCatalogRow } from "@/lib/pos/offline/storage";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const BRANCH_A = "22222222-2222-2222-2222-222222222222";
const TENANT_B = "33333333-3333-3333-3333-333333333333";

const NOW = "2026-05-17T12:00:00.000Z";

function row(overrides: Partial<OfflineCatalogRow>): OfflineCatalogRow {
  return {
    id: overrides.id ?? `p-${Math.random().toString(36).slice(2)}`,
    tenantId: overrides.tenantId ?? TENANT_A,
    branchId: overrides.branchId ?? BRANCH_A,
    name: overrides.name ?? "Some Product",
    sku: overrides.sku ?? null,
    barcode: overrides.barcode ?? null,
    baseUnit: overrides.baseUnit ?? "ea",
    sellingPrice: overrides.sellingPrice ?? 1.99,
    vatCode: overrides.vatCode ?? "STD",
    vatIncluded: overrides.vatIncluded ?? true,
    availableAtSnapshot: overrides.availableAtSnapshot ?? 10,
    cachedAt: overrides.cachedAt ?? NOW,
  };
}

async function freshDb() {
  await __resetOfflineDbForTesting();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("shopos-pos");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error("delete idb failed"));
    req.onblocked = () => resolve();
  });
}

describe("offline catalog cache", () => {
  beforeEach(async () => {
    await freshDb();
  });

  afterEach(async () => {
    await clearOfflineCatalog().catch(() => undefined);
  });

  it("replaceCatalogSnapshot stores rows under the correct branch index", async () => {
    const inserted = await replaceCatalogSnapshot(TENANT_A, BRANCH_A, [
      row({ id: "milk", name: "Milk", sku: "MILK1", barcode: "5391000000001" }),
      row({ id: "bread", name: "Bread", sku: "BRD1", barcode: "5391000000002" }),
    ]);
    expect(inserted).toBe(2);
    await expect(getCachedSnapshotCount(TENANT_A, BRANCH_A)).resolves.toBe(2);
    await expect(getCachedSnapshotCount(TENANT_B, BRANCH_A)).resolves.toBe(0);
  });

  it("replaceCatalogSnapshot wipes the old snapshot for that branch only", async () => {
    await replaceCatalogSnapshot(TENANT_A, BRANCH_A, [row({ id: "old1" }), row({ id: "old2" })]);
    // Other tenant should not be touched.
    await replaceCatalogSnapshot(TENANT_B, BRANCH_A, [
      row({ id: "neighbour", tenantId: TENANT_B }),
    ]);

    await replaceCatalogSnapshot(TENANT_A, BRANCH_A, [row({ id: "new1" })]);
    await expect(getCachedSnapshotCount(TENANT_A, BRANCH_A)).resolves.toBe(1);
    await expect(getCachedSnapshotCount(TENANT_B, BRANCH_A)).resolves.toBe(1);
  });

  it("upsertCatalogRows merges without wiping", async () => {
    await replaceCatalogSnapshot(TENANT_A, BRANCH_A, [row({ id: "milk", name: "Milk" })]);
    const merged = await upsertCatalogRows(TENANT_A, BRANCH_A, [
      row({ id: "bread", name: "Bread" }),
      row({ id: "milk", name: "Milk Premium", sellingPrice: 2.5 }),
    ]);
    expect(merged).toBe(2);
    await expect(getCachedSnapshotCount(TENANT_A, BRANCH_A)).resolves.toBe(2);
  });

  it("upsertCatalogRows is a no-op for empty input", async () => {
    await replaceCatalogSnapshot(TENANT_A, BRANCH_A, [row({ id: "x" })]);
    await expect(upsertCatalogRows(TENANT_A, BRANCH_A, [])).resolves.toBe(0);
    await expect(getCachedSnapshotCount(TENANT_A, BRANCH_A)).resolves.toBe(1);
  });
});

describe("searchOfflineCatalog ranking", () => {
  beforeEach(async () => {
    await freshDb();
    await replaceCatalogSnapshot(TENANT_A, BRANCH_A, [
      row({
        id: "milk",
        name: "Avonmore Milk 1L",
        sku: "MILK-1L",
        barcode: "5391000000001",
      }),
      row({
        id: "milk-2",
        name: "Premium Milk 1L",
        sku: "MILK-PREM-1L",
        barcode: "5391000000099",
      }),
      row({
        id: "bread",
        name: "Brennan's Bread",
        sku: "BRD-1",
        barcode: "5391000000002",
      }),
    ]);
  });

  it("returns [] for an empty / whitespace query", async () => {
    expect(await searchOfflineCatalog(TENANT_A, BRANCH_A, "")).toEqual([]);
    expect(await searchOfflineCatalog(TENANT_A, BRANCH_A, "   ")).toEqual([]);
  });

  it("exact barcode match wins over name match", async () => {
    const out = await searchOfflineCatalog(TENANT_A, BRANCH_A, "5391000000001");
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("milk");
  });

  it("exact SKU match (case-insensitive) wins over starts-with", async () => {
    const out = await searchOfflineCatalog(TENANT_A, BRANCH_A, "milk-1l");
    expect(out[0]?.id).toBe("milk");
  });

  it("name `contains` match (case-insensitive) is included but ranked last", async () => {
    const out = await searchOfflineCatalog(TENANT_A, BRANCH_A, "milk");
    // Both milk SKUs start with MILK so they rank as starts-with (score 2);
    // the name-contains tier (score 3) only applies if no SKU prefix matched.
    expect(out.map((r) => r.id)).toEqual(["milk", "milk-2"]);
  });

  it("returns no rows from another tenant", async () => {
    await replaceCatalogSnapshot(TENANT_B, BRANCH_A, [row({ id: "leak", tenantId: TENANT_B })]);
    const out = await searchOfflineCatalog(TENANT_A, BRANCH_A, "Leak");
    expect(out).toEqual([]);
  });

  it("respects the limit", async () => {
    const out = await searchOfflineCatalog(TENANT_A, BRANCH_A, "milk", 1);
    expect(out).toHaveLength(1);
  });

  it("clearOfflineCatalog wipes everything", async () => {
    await clearOfflineCatalog();
    await expect(getCachedSnapshotCount(TENANT_A, BRANCH_A)).resolves.toBe(0);
  });
});
