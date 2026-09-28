import Link from "next/link";
import { requireRole } from "@/lib/auth/tenant";
import { formatMoney } from "@/lib/utils";
import { getPeriodRange, type ReportChannel, type ReportPeriod } from "@/lib/reports/period";
import {
  getCatalogIntelligence,
  getChannelSalesSplit,
  getProductSalesGrid,
  listReportLookups,
} from "@/lib/reports/intelligence";
import { ReportFiltersBar } from "@/components/reports/report-filters-bar";
import { ReportCsvButton } from "@/components/reports/report-csv-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata = { title: "Reports · ShopOS" };

type Tab = "products" | "catalogue" | "channels";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "products", label: "What sold" },
  { id: "catalogue", label: "By supplier & brand" },
  { id: "channels", label: "Till vs online" },
];

function parsePeriod(v: string | undefined): ReportPeriod {
  if (v === "week" || v === "month" || v === "today") return v;
  return "today";
}

function parseChannel(v: string | undefined): ReportChannel {
  if (v === "pos" || v === "online") return v;
  return "all";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    period?: string;
    channel?: string;
    q?: string;
    category?: string;
    brand?: string;
    supplier?: string;
  }>;
}) {
  const tenant = await requireRole(["owner", "manager", "accountant", "warehouse"]);
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : "products";
  const period = parsePeriod(sp.period);
  const channel = parseChannel(sp.channel);
  const q = sp.q?.trim() ?? "";
  const categoryId = sp.category ?? "";
  const brandId = sp.brand ?? "";
  const supplierId = sp.supplier ?? "";
  const range = getPeriodRange(period, new Date(), tenant.timezone);
  const money = (n: number) => formatMoney(n, tenant.currency, tenant.locale);
  const filters = {
    period: range,
    channel,
    q: q || undefined,
    categoryId: categoryId || undefined,
    brandId: brandId || undefined,
    supplierId: supplierId || undefined,
  };

  const [lookups, productRows, catalogRows, split] = await Promise.all([
    listReportLookups(),
    tab === "catalogue" ? Promise.resolve([]) : getProductSalesGrid(filters),
    tab === "catalogue" ? getCatalogIntelligence(filters) : Promise.resolve([]),
    tab === "channels" ? getChannelSalesSplit(range) : Promise.resolve(null),
  ]);

  const hrefFor = (id: Tab) => {
    const p = new URLSearchParams();
    p.set("tab", id);
    p.set("period", period);
    if (channel !== "all") p.set("channel", channel);
    if (q) p.set("q", q);
    if (categoryId) p.set("category", categoryId);
    if (brandId) p.set("brand", brandId);
    if (supplierId) p.set("supplier", supplierId);
    return `/reports?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-guide="reports">
          Reports
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {range.label}. Filter by SKU, barcode, category, brand, or supplier. Till and online use
          the same numbers.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={hrefFor(t.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium",
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <ReportFiltersBar
        tab={tab}
        period={period}
        channel={channel}
        q={q}
        categoryId={categoryId}
        brandId={brandId}
        supplierId={supplierId}
        lookups={lookups}
      />

      {tab === "channels" && split ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="border-border bg-card rounded-xl border p-5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Till
            </p>
            <p className="mt-2 text-2xl font-semibold">{money(split.till.revenue)}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {split.till.salesCount} sales · profit {money(split.till.profit)}
            </p>
          </div>
          <div className="border-border bg-card rounded-xl border p-5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Online
            </p>
            <p className="mt-2 text-2xl font-semibold">{money(split.online.revenue)}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {split.online.salesCount} orders · profit {money(split.online.profit)}
            </p>
          </div>
        </div>
      ) : null}

      {tab === "products" || tab === "channels" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">
              {productRows.length} product{productRows.length === 1 ? "" : "s"}
            </h2>
            <ReportCsvButton
              filename={`shopos-sales-${period}.csv`}
              headers={[
                "Name",
                "SKU",
                "Barcode",
                "Category",
                "Brand",
                "Supplier",
                "Qty",
                "Revenue",
                "Profit",
                "Margin %",
                "Till",
                "Online",
              ]}
              rows={productRows.map((r) => [
                r.name,
                r.sku,
                r.barcode,
                r.category,
                r.brand,
                r.supplier,
                r.qty,
                r.revenue,
                r.profit,
                r.margin_pct,
                r.till_revenue,
                r.online_revenue,
              ])}
            />
          </div>
          <div className="border-border bg-card overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Take</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Till</TableHead>
                  <TableHead className="text-right">Online</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-muted-foreground py-10 text-center text-sm"
                    >
                      Nothing sold in this period for these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  productRows.map((r) => (
                    <TableRow key={r.product_id}>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {[r.brand, r.supplier].filter(Boolean).join(" · ")}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.sku ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.barcode ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.category ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.qty}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {money(r.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {money(r.profit)}
                        <span className="text-muted-foreground ml-1 text-xs">{r.margin_pct}%</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {money(r.till_revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {money(r.online_revenue)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">
              {catalogRows.length} product{catalogRows.length === 1 ? "" : "s"}
            </h2>
            <ReportCsvButton
              filename={`shopos-catalogue-${period}.csv`}
              headers={[
                "Name",
                "SKU",
                "Barcode",
                "Category",
                "Brand",
                "Supplier",
                "On hand",
                "Min",
                "Low stock",
                "Qty sold",
                "Revenue",
                "Profit",
                "Margin %",
              ]}
              rows={catalogRows.map((r) => [
                r.name,
                r.sku,
                r.barcode,
                r.category,
                r.brand,
                r.supplier,
                r.on_hand,
                r.min_stock,
                r.low_stock ? "yes" : "no",
                r.qty_sold,
                r.revenue,
                r.profit,
                r.margin_pct,
              ])}
            />
          </div>
          <div className="border-border bg-card overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU / barcode</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Take</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalogRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground py-10 text-center text-sm"
                    >
                      No products match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  catalogRows.map((r) => (
                    <TableRow key={r.product_id}>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {[r.category, r.brand].filter(Boolean).join(" · ")}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.sku ?? "—"}
                        <div>{r.barcode ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-xs">{r.supplier ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-sm">{r.on_hand}</span>
                        {r.low_stock ? (
                          <Badge variant="destructive" className="ml-2">
                            Low
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.qty_sold}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {money(r.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {money(r.profit)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
