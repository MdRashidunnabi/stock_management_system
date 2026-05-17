"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { commitPosSaleAction } from "@/lib/pos/actions";
import {
  getCachedSnapshotCount,
  replaceCatalogSnapshot,
  searchOfflineCatalog,
  upsertCatalogRows,
  type OfflineSearchResult,
} from "@/lib/pos/offline/catalog-cache";
import {
  countPendingSales,
  enqueueOfflineSale,
  flushOfflineQueue,
  listQueuedSales,
} from "@/lib/pos/offline/sale-queue";
import type { OfflineCatalogRow, OfflineSaleRow } from "@/lib/pos/offline/storage";
import type { CartLine } from "@/lib/pos/schemas";

export interface UseOfflinePosArgs {
  tenantId: string;
  branchId: string;
}

export interface UseOfflinePosResult {
  online: boolean;
  pendingCount: number;
  cachedCount: number;
  /** Replace the entire cached snapshot of the cashier's branch catalog. */
  saveCatalogSnapshot: (rows: OfflineCatalogRow[]) => Promise<void>;
  /** Merge a partial set of products into the cache (e.g. fresh search hits). */
  upsertCatalog: (rows: OfflineCatalogRow[]) => Promise<void>;
  /** Search the cached catalog (used as a fallback when offline). */
  offlineSearch: (q: string) => Promise<OfflineSearchResult[]>;
  /** Queue a cash sale for later sync. Returns the client UUID. */
  enqueueSale: (cart: CartLine[], totalSnapshot: number) => Promise<string>;
  /** Try to drain the queue right now (no-op if no pending sales). */
  flushNow: () => Promise<{ synced: number; failed: number }>;
}

/**
 * Hook used by the POS terminal to manage offline-mode plumbing:
 *   - listen for `online` / `offline` events,
 *   - track the catalog snapshot count and queue length,
 *   - auto-flush the queue when we come back online,
 *   - expose helpers the UI can call directly.
 */
export function useOfflinePos({ tenantId, branchId }: UseOfflinePosArgs): UseOfflinePosResult {
  // Lazy initial-state callback runs once at mount and reads the current
  // navigator state without triggering React Compiler's "setState in effect"
  // rule. On the server (SSR) navigator is undefined, so we default to true.
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [cachedCount, setCachedCount] = useState(0);
  const flushingRef = useRef(false);

  // Listen for online / offline transitions.
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Read pending + cached counts from IDB on mount and whenever branch changes.
  useEffect(() => {
    if (!tenantId || !branchId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [pending, cached] = await Promise.all([
          countPendingSales(tenantId, branchId),
          getCachedSnapshotCount(tenantId, branchId),
        ]);
        if (cancelled) return;
        setPendingCount(pending);
        setCachedCount(cached);
      } catch {
        // IDB might be disabled (e.g. private mode in some browsers).
        // The POS still works online; offline features just turn off.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, branchId]);

  const saveCatalogSnapshot = useCallback(
    async (rows: OfflineCatalogRow[]) => {
      try {
        const n = await replaceCatalogSnapshot(tenantId, branchId, rows);
        setCachedCount(n);
      } catch {
        // best-effort; ignore
      }
    },
    [tenantId, branchId],
  );

  const upsertCatalog = useCallback(
    async (rows: OfflineCatalogRow[]) => {
      try {
        await upsertCatalogRows(tenantId, branchId, rows);
        const n = await getCachedSnapshotCount(tenantId, branchId);
        setCachedCount(n);
      } catch {
        // best-effort; ignore
      }
    },
    [tenantId, branchId],
  );

  const offlineSearch = useCallback(
    async (q: string) => {
      try {
        return await searchOfflineCatalog(tenantId, branchId, q);
      } catch {
        return [];
      }
    },
    [tenantId, branchId],
  );

  const enqueueSale = useCallback(
    async (cart: CartLine[], totalSnapshot: number) => {
      const items = cart.map((l) => ({
        productId: l.productId,
        name: l.name,
        sku: l.sku,
        qty: l.qty,
        discount: l.discount,
        unitPriceSnapshot: l.unitPrice,
      }));
      const payments: OfflineSaleRow["payments"] = [{ method: "cash", amount: totalSnapshot }];
      const { clientUuid } = await enqueueOfflineSale({
        tenantId,
        branchId,
        totalSnapshot,
        items,
        payments,
      });
      const next = await countPendingSales(tenantId, branchId);
      setPendingCount(next);
      return clientUuid;
    },
    [tenantId, branchId],
  );

  const flushNow = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (flushingRef.current) return { synced: 0, failed: 0 };
    flushingRef.current = true;
    try {
      const res = await flushOfflineQueue(tenantId, branchId, async (row) => {
        const out = await commitPosSaleAction({
          branchId: row.branchId,
          clientUuid: row.clientUuid,
          items: row.items.map((it) => ({
            productId: it.productId,
            qty: it.qty,
            discount: it.discount || 0,
          })),
          payments: row.payments.map((p) => ({ method: p.method, amount: p.amount })),
        });
        if (out?.serverError) return { ok: false as const, error: out.serverError };
        if (out?.data?.ok) return { ok: true as const };
        return { ok: false as const, error: "unknown error" };
      });
      const next = await countPendingSales(tenantId, branchId);
      setPendingCount(next);
      return res;
    } finally {
      flushingRef.current = false;
    }
  }, [tenantId, branchId]);

  // Auto-flush whenever we transition to online and there is something queued.
  useEffect(() => {
    if (!online) return;
    if (pendingCount === 0) return;
    void flushNow();
  }, [online, pendingCount, flushNow]);

  // Periodic background flush in case the `online` event was missed (some
  // browsers fire it inconsistently). 30 seconds is gentle.
  useEffect(() => {
    if (!tenantId || !branchId) return;
    const handle = setInterval(() => {
      if (typeof navigator === "undefined" || navigator.onLine) {
        void (async () => {
          const queued = await listQueuedSales(tenantId, branchId, "pending");
          if (queued.length > 0) await flushNow();
        })();
      }
    }, 30_000);
    return () => clearInterval(handle);
  }, [tenantId, branchId, flushNow]);

  return {
    online,
    pendingCount,
    cachedCount,
    saveCatalogSnapshot,
    upsertCatalog,
    offlineSearch,
    enqueueSale,
    flushNow,
  };
}
