import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { isStockPool, stockLink, type StockLink } from "@/lib/inventory/stock-link";

type Client = SupabaseClient<Database>;

export interface StockPlace {
  tenantId: string;
  branchId: string;
}

export interface PoolMoveOptions {
  referenceType: string;
  referenceId?: string | null;
  userId?: string | null;
  note: string;
}

export interface CutMove {
  cutId: string;
  /** Quantity in the cut's own unit. */
  qty: number;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function linksFromRows(
  rows: { id: string; unit_conversions?: Json | null }[],
): Map<string, StockLink> {
  const links = new Map<string, StockLink>();
  for (const row of rows) {
    const link = stockLink(row.unit_conversions ?? null);
    if (link) links.set(row.id, link);
  }
  return links;
}

/** The cuts among these products, each with the purchase product it sells from. */
export async function loadStockLinks(
  client: Client,
  tenantId: string,
  productIds: string[],
): Promise<Map<string, StockLink>> {
  const ids = [...new Set(productIds)];
  const links = new Map<string, StockLink>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await client
      .from("products")
      .select("id, unit_conversions")
      .eq("tenant_id", tenantId)
      .in("id", ids.slice(i, i + 150));
    if (error) throw new Error(error.message);
    for (const [id, link] of linksFromRows(data ?? [])) links.set(id, link);
  }
  return links;
}

export function sourcesOf(links: Map<string, StockLink>): string[] {
  return [...new Set([...links.values()].map((link) => link.from))];
}

async function availableOf(
  client: Client,
  branchId: string,
  productIds: string[],
): Promise<Map<string, number>> {
  const held = new Map<string, number>();
  if (productIds.length === 0) return held;
  const { data, error } = await client
    .from("stock_balances")
    .select("product_id, quantity")
    .eq("branch_id", branchId)
    .eq("state", "available")
    .is("variant_id", null)
    .in("product_id", productIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    held.set(row.product_id, (held.get(row.product_id) ?? 0) + Number(row.quantity ?? 0));
  }
  return held;
}

/**
 * What each purchase product really holds: its own stock plus anything its
 * cuts still hold (normally nothing, as cuts empty into it).
 */
export async function poolTotals(
  client: Client,
  place: StockPlace,
  sourceIds: string[],
): Promise<Map<string, number>> {
  const cutLists = await Promise.all(sourceIds.map((id) => listCutsOf(client, place.tenantId, id)));
  const cutLinks = linksFromRows(cutLists.flat());
  const held = await availableOf(client, place.branchId, [...sourceIds, ...cutLinks.keys()]);
  const totals = new Map<string, number>();
  for (const id of sourceIds) totals.set(id, held.get(id) ?? 0);
  for (const [cutId, link] of cutLinks) {
    totals.set(link.from, (totals.get(link.from) ?? 0) + (held.get(cutId) ?? 0) * link.factor);
  }
  for (const [id, qty] of totals) totals.set(id, round4(qty));
  return totals;
}

/** A purchase product and each of its cuts all show the weight left, in their own unit. */
export async function applyPooledStock(
  client: Client,
  place: StockPlace,
  rows: { id: string; unit_conversions?: Json | null }[],
  stock: Map<string, number>,
): Promise<void> {
  const links = linksFromRows(rows);
  const sources = new Set(sourcesOf(links));
  const pools = rows.filter((row) => isStockPool(row.unit_conversions ?? null));
  for (const row of pools) sources.add(row.id);
  if (sources.size === 0) return;
  const totals = await poolTotals(client, place, [...sources]);
  for (const [id, link] of links) {
    stock.set(id, round4((totals.get(link.from) ?? 0) / link.factor));
  }
  for (const row of pools) stock.set(row.id, totals.get(row.id) ?? 0);
}

/** Purchase products are bought and counted, never sold, so the till leaves them out. */
export function withoutStockPools<T extends { unit_conversions?: Json | null }>(rows: T[]): T[] {
  return rows.filter((row) => !isStockPool(row.unit_conversions ?? null));
}

async function costsOf(admin: Client, tenantId: string, ids: string[]) {
  const costs = new Map<string, number>();
  if (ids.length === 0) return costs;
  const { data, error } = await admin
    .from("products")
    .select("id, purchase_price")
    .eq("tenant_id", tenantId)
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) costs.set(row.id, Number(row.purchase_price ?? 0));
  return costs;
}

/** The cuts that sell from one purchase product. */
export async function listCutsOf(client: Client, tenantId: string, sourceId: string) {
  const { data, error } = await client
    .from("products")
    .select("id, name, sku, purchase_price, unit_conversions")
    .eq("tenant_id", tenantId)
    .contains("unit_conversions", [{ stock_from: sourceId }])
    .order("sku");
  if (error) throw new Error(error.message);
  return (data ?? []).filter((row) => stockLink(row.unit_conversions)?.from === sourceId);
}

/** Every cut costs what its purchase product costs, so profit follows the price paid. */
export async function syncCutCosts(admin: Client, tenantId: string, sourceIds: string[]) {
  if (sourceIds.length === 0) return;
  const costs = await costsOf(admin, tenantId, sourceIds);
  for (const sourceId of sourceIds) {
    const cost = costs.get(sourceId);
    if (cost == null) continue;
    for (const cut of await listCutsOf(admin, tenantId, sourceId)) {
      const target = round4(cost * (stockLink(cut.unit_conversions)?.factor ?? 1));
      if (Math.abs(Number(cut.purchase_price ?? 0) - target) < 0.00005) continue;
      const { error } = await admin
        .from("products")
        .update({ purchase_price: target })
        .eq("id", cut.id)
        .eq("tenant_id", tenantId);
      if (error) throw new Error(error.message);
    }
  }
}

async function shiftAvailable(admin: Client, place: StockPlace, productId: string, delta: number) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data: row, error } = await admin
      .from("stock_balances")
      .select("id, quantity")
      .eq("tenant_id", place.tenantId)
      .eq("branch_id", place.branchId)
      .eq("product_id", productId)
      .is("variant_id", null)
      .eq("state", "available")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) {
      const { error: insertError } = await admin.from("stock_balances").insert({
        tenant_id: place.tenantId,
        branch_id: place.branchId,
        product_id: productId,
        state: "available",
        quantity: round4(delta),
      });
      if (!insertError) return;
      continue;
    }
    // Only write if nobody changed the row since it was read; sales update it too.
    const { data: done, error: updateError } = await admin
      .from("stock_balances")
      .update({ quantity: round4(Number(row.quantity ?? 0) + delta) })
      .eq("id", row.id)
      .eq("quantity", row.quantity)
      .select("id");
    if (updateError) throw new Error(updateError.message);
    if ((done ?? []).length > 0) return;
  }
  throw new Error("Stock was changing while it was being moved. Please try again.");
}

async function transfer(
  admin: Client,
  place: StockPlace,
  move: {
    fromId: string;
    fromQty: number;
    fromCost: number;
    toId: string;
    toQty: number;
    toCost: number;
  },
  opts: PoolMoveOptions,
) {
  const base = {
    tenant_id: place.tenantId,
    branch_id: place.branchId,
    reference_type: opts.referenceType,
    reference_id: opts.referenceId ?? null,
    user_id: opts.userId ?? null,
    note: opts.note,
  };
  const { data: out, error: outError } = await admin
    .from("stock_ledger")
    .insert({
      ...base,
      product_id: move.fromId,
      movement_type: "transfer_out",
      from_state: "available",
      to_state: null,
      quantity: round4(move.fromQty),
      unit_cost: round4(move.fromCost),
    })
    .select("id")
    .single();
  if (outError) throw new Error(outError.message);
  await shiftAvailable(admin, place, move.fromId, -move.fromQty);

  const { error: inError } = await admin.from("stock_ledger").insert({
    ...base,
    product_id: move.toId,
    movement_type: "transfer_in",
    from_state: null,
    to_state: "available",
    quantity: round4(move.toQty),
    unit_cost: round4(move.toCost),
    related_movement_id: out.id,
  });
  if (inError) throw new Error(inError.message);
  await shiftAvailable(admin, place, move.toId, move.toQty);
}

/**
 * Moves the weight being sold from each purchase product into its cut, so the
 * sale takes it from the whole beef or lamb.
 *
 * With `cover`, used before a sale that checks stock, each cut is topped up to
 * the amount ordered, and a cut whose purchase product is short is skipped so
 * the sale reports it out of stock.
 */
export async function borrowForCuts(
  admin: Client,
  place: StockPlace,
  lines: { productId: string; qty: number }[],
  links: Map<string, StockLink>,
  opts: PoolMoveOptions & { cover?: boolean },
): Promise<CutMove[]> {
  const need = new Map<string, number>();
  for (const line of lines) {
    if (!links.has(line.productId) || !(line.qty > 0)) continue;
    need.set(line.productId, round4((need.get(line.productId) ?? 0) + line.qty));
  }
  if (need.size === 0) return [];

  const sources = [...new Set([...need.keys()].map((id) => links.get(id)!.from))];
  const [costs, pools, own] = await Promise.all([
    costsOf(admin, place.tenantId, sources),
    opts.cover ? poolTotals(admin, place, sources) : null,
    opts.cover ? availableOf(admin, place.branchId, [...need.keys()]) : null,
  ]);
  const moved: CutMove[] = [];
  for (const [cutId, qty] of need) {
    const link = links.get(cutId)!;
    let amount = qty;
    if (pools && own) {
      const left = pools.get(link.from) ?? 0;
      if (left + 0.00005 < qty * link.factor) continue;
      pools.set(link.from, left - qty * link.factor);
      amount = round4(qty - (own.get(cutId) ?? 0));
      if (amount <= 0) continue;
    }
    const cost = costs.get(link.from) ?? 0;
    await transfer(
      admin,
      place,
      {
        fromId: link.from,
        fromQty: round4(amount * link.factor),
        fromCost: cost,
        toId: cutId,
        toQty: amount,
        toCost: cost * link.factor,
      },
      opts,
    );
    moved.push({ cutId, qty: amount });
  }
  return moved;
}

/** Puts weight a cut holds back on its purchase product. */
export async function returnToSource(
  admin: Client,
  place: StockPlace,
  moves: CutMove[],
  links: Map<string, StockLink>,
  opts: PoolMoveOptions,
) {
  const todo = moves.filter((m) => links.has(m.cutId) && m.qty > 0);
  if (todo.length === 0) return;
  const costs = await costsOf(admin, place.tenantId, sourcesOf(links));
  for (const m of todo) {
    const link = links.get(m.cutId)!;
    const cost = costs.get(link.from) ?? 0;
    await transfer(
      admin,
      place,
      {
        fromId: m.cutId,
        fromQty: m.qty,
        fromCost: cost * link.factor,
        toId: link.from,
        toQty: round4(m.qty * link.factor),
        toCost: cost,
      },
      opts,
    );
  }
}

/** Empties each cut into its purchase product, or covers a cut that went below zero. */
export async function settleCuts(
  admin: Client,
  place: StockPlace,
  links: Map<string, StockLink>,
  opts: PoolMoveOptions,
) {
  if (links.size === 0) return;
  const held = await availableOf(admin, place.branchId, [...links.keys()]);
  const surplus: CutMove[] = [];
  const short: { productId: string; qty: number }[] = [];
  for (const cutId of links.keys()) {
    const qty = round4(held.get(cutId) ?? 0);
    if (qty > 0) surplus.push({ cutId, qty });
    if (qty < 0) short.push({ productId: cutId, qty: -qty });
  }
  await returnToSource(admin, place, surplus, links, opts);
  await borrowForCuts(admin, place, short, links, opts);
}

/** Empties every cut of these purchase products back into them, e.g. before a stock count. */
export async function settlePools(
  admin: Client,
  place: StockPlace,
  sourceIds: string[],
  opts: PoolMoveOptions,
) {
  if (sourceIds.length === 0) return;
  const lists = await Promise.all(sourceIds.map((id) => listCutsOf(admin, place.tenantId, id)));
  await settleCuts(admin, place, linksFromRows(lists.flat()), opts);
}

/** True when a sale already took its cuts' weight, e.g. an offline sale sent twice. */
export async function cutsAlreadyMoved(admin: Client, tenantId: string, referenceId: string) {
  const { data, error } = await admin
    .from("stock_ledger")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("reference_id", referenceId)
    .eq("movement_type", "transfer_in")
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** The branch online orders take stock from; matches `commit_online_order`. */
export async function onlineStockBranch(admin: Client, tenantId: string): Promise<string | null> {
  const { data: store } = await admin
    .from("tenant_storefronts")
    .select("branch_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (store?.branch_id) return store.branch_id;
  const { data: branch } = await admin
    .from("branches")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("is_warehouse", false)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return branch?.id ?? null;
}
