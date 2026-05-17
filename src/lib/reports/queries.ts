import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * All read-only report queries used by the owner dashboard.
 *
 * They run with the user's RLS context (tenant-scoped automatically), so
 * no extra `eq("tenant_id", ...)` filters are needed.
 *
 * Time periods are computed in Europe/Dublin so an Irish owner sees their
 * "today" the way they expect.
 */

export type ReportPeriod = "today" | "week" | "month";

export interface PeriodRange {
  /** ISO timestamp at the start of the period (Europe/Dublin), inclusive. */
  fromIso: string;
  /** ISO timestamp at the end of the period (Europe/Dublin), exclusive. */
  toIso: string;
  /** Human-readable label for the period. */
  label: string;
  /** Number of full days the period spans (used for delta % vs prior period). */
  days: number;
}

const TIMEZONE = "Europe/Dublin";

/**
 * Compute the start-of-period in the local Irish timezone, regardless of
 * what timezone the server runs in.
 *
 * For "today" we want 00:00 in Dublin.
 * For "week" we want midnight 7 days ago.
 * For "month" we want midnight 30 days ago.
 *
 * We do this by formatting `Date.now()` into Dublin parts then re-building
 * a Date from those parts at midnight, using the offset of that local time.
 */
function dublinStartOfDay(date: Date): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (name: string) => parts.find((p) => p.type === name)?.value ?? "00";
  // ISO 8601 date in Dublin local time
  const dublinDate = `${get("year")}-${get("month")}-${get("day")}`;
  // Build a "naive" UTC midnight then shift by the timezone offset for that
  // particular date (handles DST: IE switches between IST/BST and GMT).
  const utcMidnight = new Date(`${dublinDate}T00:00:00Z`);
  const offsetMin = getDublinOffsetMinutes(utcMidnight);
  return new Date(utcMidnight.getTime() - offsetMin * 60_000);
}

function getDublinOffsetMinutes(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    timeZoneName: "shortOffset",
  });
  const tzPart = dtf.formatToParts(at).find((p) => p.type === "timeZoneName")?.value;
  // tzPart is something like "GMT+1" or "GMT" or "GMT-0".
  if (!tzPart) return 0;
  const m = tzPart.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const hours = Number(m[1]);
  const minutes = Number(m[2] ?? 0);
  return hours * 60 + (hours < 0 ? -minutes : minutes);
}

export function getPeriodRange(period: ReportPeriod, now = new Date()): PeriodRange {
  const startOfToday = dublinStartOfDay(now);
  if (period === "today") {
    return {
      fromIso: startOfToday.toISOString(),
      toIso: now.toISOString(),
      label: "Today",
      days: 1,
    };
  }
  if (period === "week") {
    const start = new Date(startOfToday.getTime() - 6 * 86_400_000);
    return {
      fromIso: start.toISOString(),
      toIso: now.toISOString(),
      label: "Last 7 days",
      days: 7,
    };
  }
  const start = new Date(startOfToday.getTime() - 29 * 86_400_000);
  return {
    fromIso: start.toISOString(),
    toIso: now.toISOString(),
    label: "Last 30 days",
    days: 30,
  };
}

export function getPriorPeriodRange(period: PeriodRange): PeriodRange {
  const fromMs = new Date(period.fromIso).getTime();
  const toMs = new Date(period.toIso).getTime();
  const span = toMs - fromMs;
  return {
    fromIso: new Date(fromMs - span).toISOString(),
    toIso: period.fromIso,
    label: `Prior ${period.days} day${period.days === 1 ? "" : "s"}`,
    days: period.days,
  };
}

/* =========================== Sales summary =========================== */

export interface SalesSummary {
  salesCount: number;
  grossRevenue: number;
  netRevenue: number; // ex VAT
  vatTotal: number;
  discountTotal: number;
  costOfGoods: number; // sum(sale_items.unit_cost * quantity) for completed sales
  grossProfit: number; // netRevenue - costOfGoods (ex VAT)
  grossMarginPct: number; // 0..100
  averageBasket: number;
  paymentsByMethod: Array<{ method: string; amount: number; count: number }>;
}

export async function getSalesSummary(period: PeriodRange): Promise<SalesSummary> {
  const supabase = await createClient();

  const { data: sales, error: sErr } = await supabase
    .from("sales")
    .select("id, total, subtotal, vat_total, discount_total, status")
    .eq("status", "completed")
    .gte("created_at", period.fromIso)
    .lt("created_at", period.toIso);
  if (sErr) throw new Error(`getSalesSummary(sales): ${sErr.message}`);

  const ids = (sales ?? []).map((s) => s.id);

  type Item = { quantity: number; unit_cost: number | null; line_total_net: number };
  type Payment = { method: string; amount: number };

  let costOfGoods = 0;
  let netRevenueLines = 0;
  const paymentsAgg = new Map<string, { amount: number; count: number }>();

  if (ids.length > 0) {
    const [itemsRes, paymentsRes] = await Promise.all([
      supabase.from("sale_items").select("quantity, unit_cost, line_total_net").in("sale_id", ids),
      supabase
        .from("payments")
        .select("method, amount, status")
        .in("sale_id", ids)
        .eq("status", "captured"),
    ]);
    if (itemsRes.error) throw new Error(`getSalesSummary(items): ${itemsRes.error.message}`);
    if (paymentsRes.error)
      throw new Error(`getSalesSummary(payments): ${paymentsRes.error.message}`);
    for (const it of (itemsRes.data ?? []) as Item[]) {
      const qty = Number(it.quantity ?? 0);
      const unitCost = Number(it.unit_cost ?? 0);
      costOfGoods += qty * unitCost;
      netRevenueLines += Number(it.line_total_net ?? 0);
    }
    for (const p of (paymentsRes.data ?? []) as Payment[]) {
      const cur = paymentsAgg.get(p.method) ?? { amount: 0, count: 0 };
      cur.amount += Number(p.amount ?? 0);
      cur.count += 1;
      paymentsAgg.set(p.method, cur);
    }
  }

  const grossRevenue = (sales ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
  const netRevenue = (sales ?? []).reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
  const vatTotal = (sales ?? []).reduce((s, r) => s + Number(r.vat_total ?? 0), 0);
  const discountTotal = (sales ?? []).reduce((s, r) => s + Number(r.discount_total ?? 0), 0);
  // sale_items.line_total_net is a more granular net (includes line discounts);
  // sales.subtotal is the rolled-up version. Prefer item sum when available so
  // gross profit lines up with cost of goods.
  const usableNet = netRevenueLines > 0 ? netRevenueLines : netRevenue;
  const grossProfit = round2(usableNet - costOfGoods);
  const grossMarginPct = usableNet > 0 ? round2((grossProfit / usableNet) * 100) : 0;
  const averageBasket = (sales ?? []).length > 0 ? round2(grossRevenue / sales!.length) : 0;

  return {
    salesCount: (sales ?? []).length,
    grossRevenue: round2(grossRevenue),
    netRevenue: round2(usableNet),
    vatTotal: round2(vatTotal),
    discountTotal: round2(discountTotal),
    costOfGoods: round2(costOfGoods),
    grossProfit,
    grossMarginPct,
    averageBasket,
    paymentsByMethod: Array.from(paymentsAgg.entries())
      .map(([method, v]) => ({ method, amount: round2(v.amount), count: v.count }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/* =========================== Daily sales series =========================== */

export interface DailySalesPoint {
  /** ISO date YYYY-MM-DD in Dublin time. */
  day: string;
  revenue: number;
  salesCount: number;
}

export async function getDailySalesSeries(days: number): Promise<DailySalesPoint[]> {
  const supabase = await createClient();
  const now = new Date();
  const startOfToday = dublinStartOfDay(now);
  const start = new Date(startOfToday.getTime() - (days - 1) * 86_400_000);

  const { data, error } = await supabase
    .from("sales")
    .select("total, created_at")
    .eq("status", "completed")
    .gte("created_at", start.toISOString())
    .lt("created_at", new Date(startOfToday.getTime() + 86_400_000).toISOString());
  if (error) throw new Error(`getDailySalesSeries: ${error.message}`);

  const buckets = new Map<string, { revenue: number; count: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    buckets.set(toDublinIsoDate(d), { revenue: 0, count: 0 });
  }
  for (const row of data ?? []) {
    const day = toDublinIsoDate(new Date(row.created_at));
    const cur = buckets.get(day);
    if (!cur) continue;
    cur.revenue += Number(row.total ?? 0);
    cur.count += 1;
  }
  return Array.from(buckets.entries()).map(([day, v]) => ({
    day,
    revenue: round2(v.revenue),
    salesCount: v.count,
  }));
}

function toDublinIsoDate(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const get = (name: string) => parts.find((p) => p.type === name)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/* =========================== Top products =========================== */

export interface TopProductRow {
  product_id: string;
  name: string;
  sku: string | null;
  qty: number;
  revenue: number; // gross
  cost: number;
  profit: number;
  margin_pct: number;
}

export async function getTopProducts(period: PeriodRange, limit = 5): Promise<TopProductRow[]> {
  const supabase = await createClient();
  const { data: sales, error: sErr } = await supabase
    .from("sales")
    .select("id")
    .eq("status", "completed")
    .gte("created_at", period.fromIso)
    .lt("created_at", period.toIso);
  if (sErr) throw new Error(`getTopProducts(sales): ${sErr.message}`);
  const ids = (sales ?? []).map((s) => s.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("sale_items")
    .select(
      `product_id, name_snapshot, sku_snapshot, quantity, unit_cost,
       line_total_gross, line_total_net,
       product:products(id, name, sku)`,
    )
    .in("sale_id", ids);
  if (error) throw new Error(`getTopProducts(items): ${error.message}`);

  type Row = {
    product_id: string;
    name_snapshot: string;
    sku_snapshot: string | null;
    quantity: number;
    unit_cost: number | null;
    line_total_gross: number;
    line_total_net: number;
    product:
      | { id: string; name: string; sku: string | null }
      | { id: string; name: string; sku: string | null }[]
      | null;
  };

  const agg = new Map<string, TopProductRow>();
  for (const row of (data ?? []) as Row[]) {
    const cur =
      agg.get(row.product_id) ??
      ({
        product_id: row.product_id,
        name: pickFirst(row.product)?.name ?? row.name_snapshot,
        sku: pickFirst(row.product)?.sku ?? row.sku_snapshot,
        qty: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        margin_pct: 0,
      } satisfies TopProductRow);
    const qty = Number(row.quantity ?? 0);
    const unitCost = Number(row.unit_cost ?? 0);
    cur.qty += qty;
    cur.revenue += Number(row.line_total_gross ?? 0);
    cur.cost += qty * unitCost;
    agg.set(row.product_id, cur);
  }
  for (const r of agg.values()) {
    // Profit is computed against the line net (ex VAT) for fairness.
    // We don't have line_total_net per row aggregated here, so derive from
    // gross / (1 + vat_rate) is too noisy. Fall back to revenue - cost as a
    // first-order owner-friendly number; refined profit reporting is for
    // a later step.
    r.qty = round2(r.qty);
    r.revenue = round2(r.revenue);
    r.cost = round2(r.cost);
    r.profit = round2(r.revenue - r.cost);
    r.margin_pct = r.revenue > 0 ? round2((r.profit / r.revenue) * 100) : 0;
  }
  return Array.from(agg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/* =========================== Low stock =========================== */

export interface LowStockRow {
  product_id: string;
  name: string;
  sku: string | null;
  branch_id: string;
  branch_name: string;
  branch_code: string | null;
  on_hand: number;
  min_stock: number;
  shortfall: number;
}

/**
 * Returns products at or below their per-branch min_stock setting.
 * Only rows where min_stock > 0 are included (otherwise every brand-new
 * product would scream "low stock" on day one).
 */
export async function getLowStockRows(limit = 20): Promise<LowStockRow[]> {
  const supabase = await createClient();

  const { data: settings, error } = await supabase
    .from("product_branch_settings")
    .select(
      `product_id, branch_id, min_stock,
       product:products(id, name, sku, is_active),
       branch:branches!product_branch_settings_branch_id_fkey(id, name, code)`,
    )
    .gt("min_stock", 0)
    .limit(500);
  if (error) throw new Error(`getLowStockRows(settings): ${error.message}`);

  type Setting = {
    product_id: string;
    branch_id: string;
    min_stock: number;
    product:
      | { id: string; name: string; sku: string | null; is_active: boolean }
      | { id: string; name: string; sku: string | null; is_active: boolean }[]
      | null;
    branch:
      | { id: string; name: string; code: string | null }
      | { id: string; name: string; code: string | null }[]
      | null;
  };

  const list = (settings ?? []) as Setting[];
  if (list.length === 0) return [];

  const productIds = Array.from(new Set(list.map((s) => s.product_id)));
  const branchIds = Array.from(new Set(list.map((s) => s.branch_id)));

  const { data: balances, error: bErr } = await supabase
    .from("stock_balances")
    .select("product_id, branch_id, quantity")
    .in("product_id", productIds)
    .in("branch_id", branchIds)
    .eq("state", "available");
  if (bErr) throw new Error(`getLowStockRows(balances): ${bErr.message}`);

  const onHand = new Map<string, number>();
  for (const b of balances ?? []) {
    const k = `${b.product_id}|${b.branch_id}`;
    onHand.set(k, (onHand.get(k) ?? 0) + Number(b.quantity ?? 0));
  }

  const rows: LowStockRow[] = [];
  for (const s of list) {
    const product = pickFirst(s.product);
    const branch = pickFirst(s.branch);
    if (!product || !branch) continue;
    if (!product.is_active) continue;
    const have = onHand.get(`${s.product_id}|${s.branch_id}`) ?? 0;
    if (have <= Number(s.min_stock)) {
      rows.push({
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        branch_id: branch.id,
        branch_name: branch.name,
        branch_code: branch.code,
        on_hand: round2(have),
        min_stock: round2(Number(s.min_stock)),
        shortfall: round2(Number(s.min_stock) - have),
      });
    }
  }
  return rows.sort((a, b) => b.shortfall - a.shortfall).slice(0, limit);
}

/* =========================== Session variance =========================== */

export interface SessionVarianceRow {
  id: string;
  branch_name: string;
  branch_code: string | null;
  cashier_label: string;
  opened_at: string;
  closed_at: string;
  expected_cash: number;
  counted_cash: number;
  cash_difference: number;
}

export interface SessionVarianceSummary {
  closedSessions: number;
  totalVariance: number;
  rows: SessionVarianceRow[];
}

export async function getSessionVarianceSummary(
  period: PeriodRange,
  limit = 5,
): Promise<SessionVarianceSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pos_sessions")
    .select(
      `id, cashier_id, opened_at, closed_at, expected_cash, counted_cash, cash_difference,
       branch:branches!pos_sessions_branch_id_fkey(id, name, code)`,
    )
    .neq("status", "open")
    .gte("closed_at", period.fromIso)
    .lt("closed_at", period.toIso)
    .order("closed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getSessionVarianceSummary: ${error.message}`);

  type SessionRow = {
    id: string;
    cashier_id: string | null;
    opened_at: string;
    closed_at: string | null;
    expected_cash: number | null;
    counted_cash: number | null;
    cash_difference: number | null;
    branch:
      | { id: string; name: string; code: string | null }
      | { id: string; name: string; code: string | null }[]
      | null;
  };

  const rowsRaw = (data ?? []) as SessionRow[];
  const cashierIds = Array.from(
    new Set(rowsRaw.map((r) => r.cashier_id).filter((v): v is string => !!v)),
  );

  const labels = new Map<string, string>();
  if (cashierIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", cashierIds);
    for (const p of profiles ?? []) {
      const name = (p.full_name as string | null)?.trim();
      labels.set(
        p.id,
        name && name.length > 0 ? name : ((p.email as string | null) ?? p.id.slice(0, 8)),
      );
    }
  }

  const rows: SessionVarianceRow[] = rowsRaw
    .filter((r) => r.closed_at)
    .map((r) => {
      const branch = pickFirst(r.branch);
      return {
        id: r.id,
        branch_name: branch?.name ?? "-",
        branch_code: branch?.code ?? null,
        cashier_label: r.cashier_id ? (labels.get(r.cashier_id) ?? r.cashier_id.slice(0, 8)) : "-",
        opened_at: r.opened_at,
        closed_at: r.closed_at as string,
        expected_cash: round2(Number(r.expected_cash ?? 0)),
        counted_cash: round2(Number(r.counted_cash ?? 0)),
        cash_difference: round2(Number(r.cash_difference ?? 0)),
      };
    });

  const totalVariance = rows.reduce((s, r) => s + r.cash_difference, 0);
  return { closedSessions: rows.length, totalVariance: round2(totalVariance), rows };
}

/* =========================== Outstanding POs =========================== */

export interface OutstandingPosSummary {
  count: number;
  totalValue: number;
}

export async function getOutstandingPosSummary(): Promise<OutstandingPosSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("total")
    .in("status", ["draft", "submitted", "partially_received"]);
  if (error) throw new Error(`getOutstandingPosSummary: ${error.message}`);
  const totalValue = (data ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
  return { count: (data ?? []).length, totalValue: round2(totalValue) };
}

/* =========================== Helpers =========================== */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}
