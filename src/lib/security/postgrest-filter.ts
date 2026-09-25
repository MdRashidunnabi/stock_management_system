/**
 * Values interpolated into PostgREST `.or()` / `ilike` strings must not
 * contain filter operators. The JS client does not parameterize `.or()`.
 */

export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Strip PostgREST `.or()` separators and grouping so user input stays data. */
export function escapePostgrestOrValue(value: string): string {
  return value.replace(/[,()]/g, " ").replace(/\./g, " ").replace(/\s+/g, " ").trim();
}

export function productTextSearchOrFilter(query: string): string {
  const safe = escapePostgrestOrValue(query);
  const ilike = escapeIlikePattern(safe);
  if (!ilike) return "name.eq.__no_match__";
  return `name.ilike.%${ilike}%,sku.ilike.%${ilike}%,barcode.eq.${safe}`;
}

export function productNameSkuOrFilter(query: string): string {
  const safe = escapePostgrestOrValue(query);
  const ilike = escapeIlikePattern(safe);
  if (!ilike) return "name.eq.__no_match__";
  return `name.ilike.%${ilike}%,sku.ilike.%${ilike}%`;
}

export function auditSearchOrFilter(term: string, uuidOrZero: string): string {
  const safe = escapePostgrestOrValue(term);
  const ilike = escapeIlikePattern(safe);
  return `action.ilike.%${ilike}%,entity_id.eq.${uuidOrZero}`;
}
