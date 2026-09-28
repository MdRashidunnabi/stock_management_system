import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PeriodRange, ReportChannel } from "@/lib/reports/period";

export interface ProductSalesRow {
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  brand: string | null;
  supplier: string | null;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number;
  till_revenue: number;
  online_revenue: number;
}

export interface CatalogIntelRow {
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  brand: string | null;
  supplier: string | null;
  on_hand: number;
  min_stock: number;
  low_stock: boolean;
  qty_sold: number;
  revenue: number;
  profit: number;
  margin_pct: number;
}

export interface ChannelSalesSplit {
  till: { salesCount: number; revenue: number; profit: number };
  online: { salesCount: number; revenue: number; profit: number };
}

export interface ReportLookups {
  categories: Array<{ id: string; name: string }>;
  brands: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
}

export interface ReportFilters {
  period: PeriodRange;
  channel: ReportChannel;
  q?: string;
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function matchesQuery(
  q: string | undefined,
  row: { name: string; sku: string | null; barcode: string | null },
): boolean {
  if (!q) return true;
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return (
    row.name.toLowerCase().includes(n) ||
    (row.sku ?? "").toLowerCase().includes(n) ||
    (row.barcode ?? "").toLowerCase().includes(n)
  );
}

export async function listReportLookups(): Promise<ReportLookups> {
  const supabase = await createClient();
  const [cats, brands, suppliers] = await Promise.all([
    supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
    supabase.from("brands").select("id, name").eq("is_active", true).order("name"),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
  ]);
  return {
    categories: cats.data ?? [],
    brands: brands.data ?? [],
    suppliers: suppliers.data ?? [],
  };
}

async function loadCompletedSales(period: PeriodRange, channel: ReportChannel) {
  const supabase = await createClient();
  let q = supabase
    .from("sales")
    .select("id, channel, total, created_at")
    .eq("status", "completed")
    .gte("created_at", period.fromIso)
    .lt("created_at", period.toIso);
  if (channel !== "all") q = q.eq("channel", channel);
  const { data, error } = await q;
  if (error) throw new Error(`loadCompletedSales: ${error.message}`);
  return data ?? [];
}

export async function getProductSalesGrid(filters: ReportFilters): Promise<ProductSalesRow[]> {
  const sales = await loadCompletedSales(filters.period, filters.channel);
  const ids = sales.map((s) => s.id);
  if (ids.length === 0) return [];

  const channelBySale = new Map(sales.map((s) => [s.id, s.channel]));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sale_items")
    .select(
      `sale_id, product_id, name_snapshot, sku_snapshot, quantity, unit_cost, line_total_gross, line_total_net,
       product:products(
         id, name, sku, barcode, category_id, brand_id, default_supplier_id,
         category:categories(id, name),
         brand:brands(id, name),
         supplier:suppliers!default_supplier_id(id, name)
       )`,
    )
    .in("sale_id", ids);
  if (error) throw new Error(`getProductSalesGrid: ${error.message}`);

  type Prod = {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    category_id: string | null;
    brand_id: string | null;
    default_supplier_id: string | null;
    category: { id: string; name: string } | { id: string; name: string }[] | null;
    brand: { id: string; name: string } | { id: string; name: string }[] | null;
    supplier: { id: string; name: string } | { id: string; name: string }[] | null;
  };

  const agg = new Map<string, ProductSalesRow>();
  for (const row of data ?? []) {
    const product = pickFirst(row.product as Prod | Prod[] | null);
    if (filters.categoryId && product?.category_id !== filters.categoryId) continue;
    if (filters.brandId && product?.brand_id !== filters.brandId) continue;
    if (filters.supplierId && product?.default_supplier_id !== filters.supplierId) continue;

    const name = product?.name ?? row.name_snapshot;
    const sku = product?.sku ?? row.sku_snapshot;
    const barcode = product?.barcode ?? null;
    if (!matchesQuery(filters.q, { name, sku, barcode })) continue;

    const key = row.product_id;
    const cur =
      agg.get(key) ??
      ({
        product_id: key,
        name,
        sku,
        barcode,
        category: pickFirst(product?.category)?.name ?? null,
        brand: pickFirst(product?.brand)?.name ?? null,
        supplier: pickFirst(product?.supplier)?.name ?? null,
        qty: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        margin_pct: 0,
        till_revenue: 0,
        online_revenue: 0,
      } satisfies ProductSalesRow);

    const qty = Number(row.quantity ?? 0);
    const gross = Number(row.line_total_gross ?? 0);
    const net = Number(row.line_total_net ?? gross);
    const cost = qty * Number(row.unit_cost ?? 0);
    cur.qty += qty;
    cur.revenue += gross;
    cur.cost += cost;
    cur.profit += net - cost;
    const ch = channelBySale.get(row.sale_id);
    if (ch === "online") cur.online_revenue += gross;
    else cur.till_revenue += gross;
    agg.set(key, cur);
  }

  return Array.from(agg.values())
    .map((r) => ({
      ...r,
      qty: round2(r.qty),
      revenue: round2(r.revenue),
      cost: round2(r.cost),
      profit: round2(r.profit),
      margin_pct: r.revenue > 0 ? round2((r.profit / r.revenue) * 100) : 0,
      till_revenue: round2(r.till_revenue),
      online_revenue: round2(r.online_revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 400);
}

export async function getChannelSalesSplit(period: PeriodRange): Promise<ChannelSalesSplit> {
  const [tillRows, onlineRows] = await Promise.all([
    getProductSalesGrid({ period, channel: "pos" }),
    getProductSalesGrid({ period, channel: "online" }),
  ]);
  const sum = (rows: ProductSalesRow[]) => ({
    salesCount: 0,
    revenue: round2(rows.reduce((s, r) => s + r.revenue, 0)),
    profit: round2(rows.reduce((s, r) => s + r.profit, 0)),
  });
  const tillSales = await loadCompletedSales(period, "pos");
  const onlineSales = await loadCompletedSales(period, "online");
  return {
    till: { ...sum(tillRows), salesCount: tillSales.length },
    online: { ...sum(onlineRows), salesCount: onlineSales.length },
  };
}

export async function getCatalogIntelligence(filters: ReportFilters): Promise<CatalogIntelRow[]> {
  const supabase = await createClient();
  let pq = supabase
    .from("products")
    .select(
      `id, name, sku, barcode, category_id, brand_id, default_supplier_id, is_active,
       category:categories(id, name),
       brand:brands(id, name),
       supplier:suppliers!default_supplier_id(id, name)`,
    )
    .eq("is_active", true)
    .is("archived_at", null)
    .order("name")
    .limit(200);

  if (filters.categoryId) pq = pq.eq("category_id", filters.categoryId);
  if (filters.brandId) pq = pq.eq("brand_id", filters.brandId);
  if (filters.supplierId) pq = pq.eq("default_supplier_id", filters.supplierId);

  const { data: products, error } = await pq;
  if (error) throw new Error(`getCatalogIntelligence(products): ${error.message}`);
  const list = (products ?? []).filter((p) =>
    matchesQuery(filters.q, { name: p.name, sku: p.sku, barcode: p.barcode }),
  );
  if (list.length === 0) return [];

  const ids = list.map((p) => p.id);
  const salesRows = await getProductSalesGrid({ ...filters, q: undefined });
  const sold = new Map(salesRows.map((r) => [r.product_id, r]));

  const [{ data: balances }, { data: settings }] = await Promise.all([
    supabase
      .from("stock_balances")
      .select("product_id, quantity")
      .eq("state", "available")
      .in("product_id", ids),
    supabase.from("product_branch_settings").select("product_id, min_stock").in("product_id", ids),
  ]);

  const onHand = new Map<string, number>();
  for (const b of balances ?? []) {
    onHand.set(b.product_id, (onHand.get(b.product_id) ?? 0) + Number(b.quantity ?? 0));
  }
  const minStock = new Map<string, number>();
  for (const s of settings ?? []) {
    const cur = minStock.get(s.product_id) ?? 0;
    minStock.set(s.product_id, Math.max(cur, Number(s.min_stock ?? 0)));
  }

  type Cat = { id: string; name: string };
  return list.map((p) => {
    const sale = sold.get(p.id);
    const hand = round2(onHand.get(p.id) ?? 0);
    const min = minStock.get(p.id) ?? 0;
    return {
      product_id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: pickFirst(p.category as Cat | Cat[] | null)?.name ?? null,
      brand: pickFirst(p.brand as Cat | Cat[] | null)?.name ?? null,
      supplier: pickFirst(p.supplier as Cat | Cat[] | null)?.name ?? null,
      on_hand: hand,
      min_stock: min,
      low_stock: min > 0 && hand <= min,
      qty_sold: sale?.qty ?? 0,
      revenue: sale?.revenue ?? 0,
      profit: sale?.profit ?? 0,
      margin_pct: sale?.margin_pct ?? 0,
    };
  });
}
