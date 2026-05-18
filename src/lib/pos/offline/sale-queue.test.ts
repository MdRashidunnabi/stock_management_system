import { beforeEach, describe, expect, it } from "vitest";
import {
  countPendingSales,
  deleteSyncedSales,
  enqueueOfflineSale,
  flushOfflineQueue,
  listQueuedSales,
  setSaleStatus,
} from "@/lib/pos/offline/sale-queue";
import { __resetOfflineDbForTesting } from "@/lib/pos/offline/storage";

const TENANT = "11111111-1111-1111-1111-111111111111";
const BRANCH = "22222222-2222-2222-2222-222222222222";

const SAMPLE_INPUT = {
  tenantId: TENANT,
  branchId: BRANCH,
  totalSnapshot: 12.3,
  items: [
    { productId: "p1", name: "Milk", sku: "MILK1", qty: 2, discount: 0, unitPriceSnapshot: 1.5 },
  ],
  payments: [{ method: "cash" as const, amount: 12.3 }],
};

async function freshDb() {
  await __resetOfflineDbForTesting();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("shopos-pos");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe("offline sale queue", () => {
  beforeEach(async () => {
    await freshDb();
  });

  it("enqueueOfflineSale stamps a v4-shaped UUID and starts as pending", async () => {
    const { id, clientUuid } = await enqueueOfflineSale(SAMPLE_INPUT);
    expect(typeof id).toBe("number");
    // RFC 4122 v4 shape (case-insensitive).
    expect(clientUuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const rows = await listQueuedSales(TENANT, BRANCH);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("pending");
    expect(rows[0]?.attempts).toBe(0);
    expect(rows[0]?.lastError).toBeNull();
    expect(rows[0]?.totalSnapshot).toBe(12.3);
  });

  it("countPendingSales counts only pending rows for the right branch", async () => {
    const a = await enqueueOfflineSale(SAMPLE_INPUT);
    await enqueueOfflineSale(SAMPLE_INPUT);
    await enqueueOfflineSale({ ...SAMPLE_INPUT, branchId: "ffffffff-ffff-ffff-ffff-ffffffffffff" });

    expect(await countPendingSales(TENANT, BRANCH)).toBe(2);

    await setSaleStatus(a.id, "synced");
    expect(await countPendingSales(TENANT, BRANCH)).toBe(1);
  });

  it("flushOfflineQueue marks each pending row syncing -> synced when commit returns ok", async () => {
    await enqueueOfflineSale(SAMPLE_INPUT);
    await enqueueOfflineSale(SAMPLE_INPUT);

    const seen: string[] = [];
    const result = await flushOfflineQueue(TENANT, BRANCH, async (row) => {
      seen.push(row.clientUuid);
      return { ok: true };
    });

    expect(result).toEqual({ synced: 2, failed: 0 });
    expect(seen).toHaveLength(2);
    // Two distinct UUIDs.
    expect(new Set(seen).size).toBe(2);

    const rows = await listQueuedSales(TENANT, BRANCH);
    expect(rows.every((r) => r.status === "synced")).toBe(true);
    expect(rows.every((r) => r.attempts === 1)).toBe(true);
  });

  it("flushOfflineQueue keeps the row pending and bumps attempts on failure", async () => {
    await enqueueOfflineSale(SAMPLE_INPUT);
    const result = await flushOfflineQueue(TENANT, BRANCH, async () => ({
      ok: false,
      error: "network error",
    }));
    expect(result).toEqual({ synced: 0, failed: 1 });
    const rows = await listQueuedSales(TENANT, BRANCH);
    expect(rows[0]?.status).toBe("pending");
    expect(rows[0]?.attempts).toBe(1);
    expect(rows[0]?.lastError).toBe("network error");
  });

  it("flushOfflineQueue captures thrown errors and keeps the row pending", async () => {
    await enqueueOfflineSale(SAMPLE_INPUT);
    const result = await flushOfflineQueue(TENANT, BRANCH, async () => {
      throw new Error("boom");
    });
    expect(result).toEqual({ synced: 0, failed: 1 });
    const rows = await listQueuedSales(TENANT, BRANCH);
    expect(rows[0]?.status).toBe("pending");
    expect(rows[0]?.lastError).toBe("boom");
  });

  it("flushOfflineQueue is idempotent: re-flushing after success does nothing", async () => {
    await enqueueOfflineSale(SAMPLE_INPUT);
    let calls = 0;
    await flushOfflineQueue(TENANT, BRANCH, async () => {
      calls++;
      return { ok: true };
    });
    await flushOfflineQueue(TENANT, BRANCH, async () => {
      calls++;
      return { ok: true };
    });
    expect(calls).toBe(1);
  });

  it("deleteSyncedSales drops only synced rows for that branch", async () => {
    const a = await enqueueOfflineSale(SAMPLE_INPUT);
    const b = await enqueueOfflineSale(SAMPLE_INPUT);
    await setSaleStatus(a.id, "synced");
    await setSaleStatus(b.id, "failed");

    const removed = await deleteSyncedSales(TENANT, BRANCH);
    expect(removed).toBe(1);
    const rows = await listQueuedSales(TENANT, BRANCH);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("failed");
  });
});
