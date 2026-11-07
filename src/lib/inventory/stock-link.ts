import type { Json } from "@/lib/supabase/types";

/**
 * A cut such as beef mince keeps no stock of its own. It sells from a
 * purchase product such as the whole beef, stored in `unit_conversions`.
 */
export interface StockLink {
  from: string;
  /** Source units used for one unit sold: 1 when both are kg. */
  factor: number;
}

function firstEntry(
  conversions: Json | null | undefined,
): { [key: string]: Json | undefined } | null {
  const first = Array.isArray(conversions) ? conversions[0] : null;
  return first && typeof first === "object" && !Array.isArray(first) ? first : null;
}

export function stockLink(conversions: Json | null | undefined): StockLink | null {
  const entry = firstEntry(conversions);
  const from = entry?.stock_from;
  if (typeof from !== "string" || from.length === 0) return null;
  const factor = Number(entry?.factor ?? 1);
  return { from, factor: Number.isFinite(factor) && factor > 0 ? factor : 1 };
}

/** The purchase product that cuts sell from. Bought and counted, not sold. */
export function isStockPool(conversions: Json | null | undefined): boolean {
  return firstEntry(conversions)?.stock_pool === true;
}

export function stockLinkValue(from: string, factor = 1): Json {
  return [{ stock_from: from, factor }];
}

export const STOCK_POOL_VALUE: Json = [{ stock_pool: true }];
