/**
 * Offline sale queue.
 *
 * A sale taken while the device is offline (or while `commit_pos_sale`
 * fails for a transient reason) is appended to the IndexedDB queue and
 * shown in the UI as "queued, will sync". The queue flusher then walks
 * the pending rows and posts each one to the server action.
 *
 * Idempotency is enforced server-side because every queued sale carries
 * a stable `clientUuid`. The `commit_pos_sale` RPC, when given the same
 * `client_uuid` twice, returns the same receipt instead of creating a
 * second sale.
 */
import {
  getOfflineDb,
  type OfflineSaleRow,
  type OfflineSaleStatus,
} from "@/lib/pos/offline/storage";

export interface EnqueueOfflineSaleInput {
  tenantId: string;
  branchId: string;
  totalSnapshot: number;
  items: OfflineSaleRow["items"];
  payments: OfflineSaleRow["payments"];
}

/**
 * Append a pending sale to the queue. Returns the row id assigned by IDB
 * and the client UUID that must be sent to the server.
 */
export async function enqueueOfflineSale(input: EnqueueOfflineSaleInput): Promise<{
  id: number;
  clientUuid: string;
}> {
  const db = await getOfflineDb();
  const clientUuid = generateUuid();
  const row: OfflineSaleRow = {
    clientUuid,
    tenantId: input.tenantId,
    branchId: input.branchId,
    takenAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
    lastError: null,
    totalSnapshot: input.totalSnapshot,
    items: input.items,
    payments: input.payments,
  };
  const id = (await db.add("sale_queue", row)) as number;
  return { id, clientUuid };
}

export async function listQueuedSales(
  tenantId: string,
  branchId: string,
  status?: OfflineSaleStatus,
): Promise<OfflineSaleRow[]> {
  const db = await getOfflineDb();
  const tx = db.transaction("sale_queue", "readonly");
  const idx = tx.objectStore("sale_queue").index("by_branch");
  const all = await idx.getAll(IDBKeyRange.only([tenantId, branchId]));
  return status ? all.filter((r) => r.status === status) : all;
}

export async function countPendingSales(tenantId: string, branchId: string): Promise<number> {
  const rows = await listQueuedSales(tenantId, branchId, "pending");
  return rows.length;
}

export async function setSaleStatus(
  id: number,
  status: OfflineSaleStatus,
  patch: Partial<Pick<OfflineSaleRow, "lastError" | "attempts">> = {},
): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction("sale_queue", "readwrite");
  const store = tx.objectStore("sale_queue");
  const row = await store.get(id);
  if (!row) {
    await tx.done;
    return;
  }
  row.status = status;
  if (patch.lastError !== undefined) row.lastError = patch.lastError;
  if (patch.attempts !== undefined) row.attempts = patch.attempts;
  await store.put(row);
  await tx.done;
}

export async function deleteSyncedSales(tenantId: string, branchId: string): Promise<number> {
  const db = await getOfflineDb();
  const tx = db.transaction("sale_queue", "readwrite");
  const store = tx.objectStore("sale_queue");
  const idx = store.index("by_branch");
  let removed = 0;
  let cursor = await idx.openCursor(IDBKeyRange.only([tenantId, branchId]));
  while (cursor) {
    if (cursor.value.status === "synced") {
      await cursor.delete();
      removed++;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  return removed;
}

/**
 * Walk every pending sale and call `commit` once per row. The caller
 * provides the network call so this module stays decoupled from the
 * server action wiring.
 *
 * The flusher rejects if the network call rejects, so the queue still
 * shows "pending" and will retry on the next online tick.
 */
export async function flushOfflineQueue(
  tenantId: string,
  branchId: string,
  commit: (row: OfflineSaleRow) => Promise<{ ok: true } | { ok: false; error: string }>,
): Promise<{ synced: number; failed: number }> {
  const pending = await listQueuedSales(tenantId, branchId, "pending");
  let synced = 0;
  let failed = 0;
  for (const row of pending) {
    if (row.id === undefined) continue;
    await setSaleStatus(row.id, "syncing", { attempts: row.attempts + 1 });
    try {
      const res = await commit(row);
      if (res.ok) {
        await setSaleStatus(row.id, "synced", { lastError: null });
        synced++;
      } else {
        await setSaleStatus(row.id, "pending", { lastError: res.error });
        failed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await setSaleStatus(row.id, "pending", { lastError: msg });
      failed++;
    }
  }
  return { synced, failed };
}

/**
 * Generate a v4-ish UUID. We don't ship a heavy uuid lib client-side; the
 * value is opaque to the server, which only uses it as an idempotency key.
 */
function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older environments and the test harness.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
