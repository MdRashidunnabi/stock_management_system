/**
 * ShopOS - Step 13 - IndexedDB storage for the offline POS cache.
 *
 * Two object stores live inside the `shopos-pos` database, scoped per
 * tenant + branch via composite keys so a multi-branch device can be
 * sold from any branch without leaking carts:
 *
 *   - `catalog` (key `productId`) - mirror of the active product list
 *     for the cashier's branch, including selling price, VAT code, and
 *     available stock at snapshot time.
 *   - `sale_queue` (auto-incremented key) - sales that were taken while
 *     offline. Each row has its own client-generated UUID so the
 *     `commit_pos_sale` RPC can dedupe replays.
 *
 * Both stores include a `tenantId` + `branchId` index because the same
 * device can in principle be reused across tenants / branches.
 *
 * The IDB helper is small and dependency-light on purpose: it imports
 * `idb` for the type-safe wrapper but the surface area is tiny so the
 * service worker can keep its bundle small.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface OfflineCatalogRow {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  baseUnit: string;
  sellingPrice: number;
  vatCode: string;
  vatIncluded: boolean;
  /** Stock available at snapshot time. */
  availableAtSnapshot: number;
  /** Snapshot timestamp (ISO). */
  cachedAt: string;
}

export type OfflineSaleStatus = "pending" | "syncing" | "synced" | "failed";

export interface OfflineSaleItem {
  productId: string;
  name: string;
  sku: string | null;
  qty: number;
  discount: number;
  /** Snapshot of unit price at the time of sale (for the receipt only). */
  unitPriceSnapshot: number;
}

export interface OfflineSaleRow {
  /** Auto-incremented IndexedDB key. */
  id?: number;
  /** Stable client UUID (used as idempotency key). */
  clientUuid: string;
  tenantId: string;
  branchId: string;
  takenAt: string;
  status: OfflineSaleStatus;
  attempts: number;
  lastError: string | null;
  totalSnapshot: number;
  items: OfflineSaleItem[];
  /** Cash-only at the moment - card terminals can't go offline. */
  payments: { method: "cash"; amount: number }[];
}

export interface ShopOsDB extends DBSchema {
  catalog: {
    key: string;
    value: OfflineCatalogRow;
    indexes: {
      by_branch: [string, string];
      by_barcode: string;
    };
  };
  sale_queue: {
    key: number;
    value: OfflineSaleRow;
    indexes: {
      by_status: OfflineSaleStatus;
      by_branch: [string, string];
      by_client_uuid: string;
    };
  };
}

const DB_NAME = "shopos-pos";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ShopOsDB>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<ShopOsDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  if (!dbPromise) {
    dbPromise = openDB<ShopOsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("catalog")) {
          const catalog = db.createObjectStore("catalog", { keyPath: "id" });
          catalog.createIndex("by_branch", ["tenantId", "branchId"]);
          catalog.createIndex("by_barcode", "barcode");
        }
        if (!db.objectStoreNames.contains("sale_queue")) {
          const queue = db.createObjectStore("sale_queue", {
            keyPath: "id",
            autoIncrement: true,
          });
          queue.createIndex("by_status", "status");
          queue.createIndex("by_branch", ["tenantId", "branchId"]);
          queue.createIndex("by_client_uuid", "clientUuid");
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Test seam: lets `scripts/test-offline-pos.mjs` swap in a different
 * `indexedDB` (provided by `fake-indexeddb`) and a different DB name so
 * tests don't collide with the real one in a browser.
 */
export function __resetOfflineDbForTesting(): void {
  dbPromise = null;
}
