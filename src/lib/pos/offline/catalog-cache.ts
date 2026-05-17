/**
 * Offline catalog cache.
 *
 * On POS terminal mount, we ship a snapshot of the cashier's branch's
 * active products into IndexedDB. The cache is then queried by the same
 * `(barcode | sku | name)` search the server-side endpoint uses. When the
 * device is online we still hit the server (the source of truth); when it
 * is offline, the cache becomes the search index.
 *
 * The cache is intentionally simple - no fuzzy matching, no analyzer.
 * It is meant to keep a single till selling for the duration of an
 * outage, not to replace the catalog database.
 */
import { getOfflineDb, type OfflineCatalogRow } from "@/lib/pos/offline/storage";

export interface OfflineSearchResult {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  base_unit: string;
  selling_price: number;
  vat_code: string;
  vat_included: boolean;
  available: number;
}

/**
 * Replace the cached snapshot of a branch's catalog. Used when we have a
 * full snapshot of the branch (e.g. an admin-triggered refresh).
 */
export async function replaceCatalogSnapshot(
  tenantId: string,
  branchId: string,
  rows: OfflineCatalogRow[],
): Promise<number> {
  const db = await getOfflineDb();
  const tx = db.transaction("catalog", "readwrite");
  const store = tx.objectStore("catalog");
  const idx = store.index("by_branch");
  // Wipe out any existing snapshot for this branch.
  let cursor = await idx.openKeyCursor(IDBKeyRange.only([tenantId, branchId]));
  while (cursor) {
    await store.delete(cursor.primaryKey);
    cursor = await cursor.continue();
  }
  for (const r of rows) {
    await store.put({ ...r, tenantId, branchId });
  }
  await tx.done;
  return rows.length;
}

/**
 * Merge a small batch of rows into the catalog cache without touching
 * existing rows. This is the right operation for the "as you search,
 * remember what you saw" pattern used by the POS terminal: even a tiny
 * search snapshot grows the cache instead of shrinking it.
 */
export async function upsertCatalogRows(
  tenantId: string,
  branchId: string,
  rows: OfflineCatalogRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const db = await getOfflineDb();
  const tx = db.transaction("catalog", "readwrite");
  const store = tx.objectStore("catalog");
  for (const r of rows) {
    await store.put({ ...r, tenantId, branchId });
  }
  await tx.done;
  return rows.length;
}

/**
 * Read the cached snapshot for a branch.
 */
export async function getCachedSnapshotCount(tenantId: string, branchId: string): Promise<number> {
  const db = await getOfflineDb();
  const tx = db.transaction("catalog", "readonly");
  const idx = tx.objectStore("catalog").index("by_branch");
  return idx.count(IDBKeyRange.only([tenantId, branchId]));
}

/**
 * Search the cached snapshot. Returns at most `limit` rows, ordered by
 *   1. exact barcode match
 *   2. exact SKU match (case-insensitive)
 *   3. SKU starts-with
 *   4. name contains (case-insensitive)
 *   5. name alphabetical
 */
export async function searchOfflineCatalog(
  tenantId: string,
  branchId: string,
  query: string,
  limit = 20,
): Promise<OfflineSearchResult[]> {
  const term = query.trim();
  if (!term) return [];
  const db = await getOfflineDb();
  const tx = db.transaction("catalog", "readonly");
  const idx = tx.objectStore("catalog").index("by_branch");
  const all: OfflineCatalogRow[] = await idx.getAll(IDBKeyRange.only([tenantId, branchId]));
  const lower = term.toLowerCase();
  const scored = all
    .map((r) => {
      let score = 9;
      if (r.barcode && r.barcode === term) score = 0;
      else if (r.sku && r.sku.toLowerCase() === lower) score = 1;
      else if (r.sku && r.sku.toLowerCase().startsWith(lower)) score = 2;
      else if (r.name.toLowerCase().includes(lower)) score = 3;
      else score = 9;
      return { row: r, score };
    })
    .filter((s) => s.score < 9)
    .sort((a, b) => a.score - b.score || a.row.name.localeCompare(b.row.name))
    .slice(0, limit);
  return scored.map(({ row }) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    base_unit: row.baseUnit,
    selling_price: row.sellingPrice,
    vat_code: row.vatCode,
    vat_included: row.vatIncluded,
    available: row.availableAtSnapshot,
  }));
}

/**
 * Clear the offline catalog. Useful on sign-out.
 */
export async function clearOfflineCatalog(): Promise<void> {
  const db = await getOfflineDb();
  await db.clear("catalog");
}
