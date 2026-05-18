import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Coins,
  FilePlus2,
  KeyRound,
  PackagePlus,
  Receipt,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { requireTenant, requireUser } from "@/lib/auth/tenant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEuro } from "@/lib/utils";
import {
  getDailySalesSeries,
  getLowStockRows,
  getOutstandingPosSummary,
  getPeriodRange,
  getPriorPeriodRange,
  getSalesSummary,
  getSessionVarianceSummary,
  getTopProducts,
  type ReportPeriod,
} from "@/lib/reports/queries";
import { createClient } from "@/lib/supabase/server";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { LowStockList } from "@/components/dashboard/low-stock-list";
import { PeriodTabs } from "@/components/dashboard/period-tabs";
import { RecentShifts } from "@/components/dashboard/recent-shifts";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { TopProducts } from "@/components/dashboard/top-products";

export const metadata: Metadata = {
  title: "Dashboard",
};

type SearchParams = Promise<{ period?: string }>;

const VALID_PERIODS = new Set<ReportPeriod>(["today", "week", "month"]);

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const period: ReportPeriod = VALID_PERIODS.has(sp.period as ReportPeriod)
    ? (sp.period as ReportPeriod)
    : "today";

  const user = await requireUser();
  const tenant = await requireTenant();

  const periodRange = getPeriodRange(period);
  const priorRange = getPriorPeriodRange(periodRange);

  const supabase = await createClient();

  const [
    salesSummary,
    priorSummary,
    series,
    topProducts,
    lowStock,
    sessionVariance,
    outstandingPos,
    openTillsRes,
    draftReceiptsRes,
  ] = await Promise.all([
    getSalesSummary(periodRange),
    getSalesSummary(priorRange),
    getDailySalesSeries(14),
    getTopProducts(periodRange, 5),
    getLowStockRows(10),
    getSessionVarianceSummary(periodRange, 5),
    getOutstandingPosSummary(),
    supabase.from("pos_sessions").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase
      .from("goods_receipts")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
  ]);

  const openTills = openTillsRes.count ?? 0;
  const draftReceipts = draftReceiptsRes.count ?? 0;

  const revenueDelta = pctDelta(salesSummary.grossRevenue, priorSummary.grossRevenue);
  const profitDelta = pctDelta(salesSummary.grossProfit, priorSummary.grossProfit);
  const basketDelta = pctDelta(salesSummary.averageBasket, priorSummary.averageBasket);
  const salesCountDelta = pctDelta(salesSummary.salesCount, priorSummary.salesCount);

  const varianceTone: "good" | "warn" | "bad" =
    Math.abs(sessionVariance.totalVariance) < 0.005
      ? "good"
      : sessionVariance.totalVariance < 0
        ? "bad"
        : "warn";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
            Step 14 - regression-proof: 48 unit + 173 smoke + 2 e2e tests
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back, {user.user_metadata?.full_name ?? user.email?.split("@")[0]}
          </h1>
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium">{tenant.tenantName}</span> · signed in as{" "}
            <span className="capitalize">{tenant.role}</span> · viewing{" "}
            <span className="text-foreground font-medium">{periodRange.label.toLowerCase()}</span>
          </p>
        </div>
        <PeriodTabs active={period} />
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          icon={<TrendingUp className="size-4" />}
          label="Revenue"
          value={formatEuro(salesSummary.grossRevenue)}
          hint={`${salesSummary.salesCount} sale${salesSummary.salesCount === 1 ? "" : "s"}`}
          trend={revenueDelta}
          href="/sales"
        />
        <KpiTile
          icon={<Sparkles className="size-4" />}
          label="Gross profit"
          value={formatEuro(salesSummary.grossProfit)}
          hint={`${salesSummary.grossMarginPct.toFixed(1)}% margin · cost ${formatEuro(salesSummary.costOfGoods)}`}
          trend={profitDelta}
          emphasis={salesSummary.grossProfit < 0 ? "bad" : "default"}
        />
        <KpiTile
          icon={<ShoppingCart className="size-4" />}
          label="Avg basket"
          value={formatEuro(salesSummary.averageBasket)}
          hint={
            salesSummary.salesCount > 0 ? `from ${salesSummary.salesCount} sales` : "no sales yet"
          }
          trend={basketDelta}
        />
        <KpiTile
          icon={<Coins className="size-4" />}
          label="Cash variance"
          value={formatEuro(sessionVariance.totalVariance)}
          hint={
            sessionVariance.closedSessions === 0
              ? "no closed shifts"
              : `${sessionVariance.closedSessions} shift${sessionVariance.closedSessions === 1 ? "" : "s"}`
          }
          emphasis={sessionVariance.closedSessions > 0 ? varianceTone : "default"}
          href="/sessions"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          icon={<Receipt className="size-4" />}
          label="Sales count"
          value={salesSummary.salesCount.toString()}
          hint={`prior period: ${priorSummary.salesCount}`}
          trend={salesCountDelta}
        />
        <KpiTile
          icon={<KeyRound className="size-4" />}
          label="Open tills"
          value={openTills.toString()}
          hint={openTills === 0 ? "no shift in progress" : "shift in progress"}
          href="/sessions"
          emphasis={openTills > 0 ? "good" : "default"}
        />
        <KpiTile
          icon={<FilePlus2 className="size-4" />}
          label="Open POs"
          value={outstandingPos.count.toString()}
          hint={`${formatEuro(outstandingPos.totalValue)} on order`}
          href="/purchase-orders"
        />
        <KpiTile
          icon={<PackagePlus className="size-4" />}
          label="Draft receipts"
          value={draftReceipts.toString()}
          hint={draftReceipts === 0 ? "all caught up" : "needs finalising"}
          href="/goods-receipts"
          emphasis={draftReceipts > 0 ? "warn" : "default"}
        />
      </div>

      {/* Sales chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Daily revenue (last 14 days)</CardTitle>
              <CardDescription className="text-xs">
                Each bar is one day in Europe/Dublin time. The most recent bar is highlighted.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SalesChart series={series} highlightLast={1} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top products */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Top movers · {periodRange.label}</CardTitle>
                <CardDescription className="text-xs">
                  Best-selling products by gross revenue. Profit uses each line&apos;s captured unit
                  cost.
                </CardDescription>
              </div>
              <Link
                href="/sales"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
              >
                All sales <ArrowRight className="size-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <TopProducts rows={topProducts} />
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                  Low stock
                </CardTitle>
                <CardDescription className="text-xs">
                  Products at or below their per-branch <span className="font-mono">min_stock</span>
                  .
                </CardDescription>
              </div>
              <Link
                href="/products"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
              >
                Products <ArrowRight className="size-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <LowStockList rows={lowStock} />
          </CardContent>
        </Card>
      </div>

      {/* Recent shifts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Recent shifts</CardTitle>
              <CardDescription className="text-xs">
                Closed tills in this window with their cash variance.
              </CardDescription>
            </div>
            <Link
              href="/sessions"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
            >
              All shifts <ArrowRight className="size-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <RecentShifts rows={sessionVariance.rows} />
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-primary size-5" />
            <CardTitle className="text-lg">Regression-proof POS critical path</CardTitle>
          </div>
          <CardDescription>
            Every release runs 48 Vitest unit tests (VAT maths, Dublin time periods incl. DST, audit
            diffs, offline catalog ranking, sale-queue lifecycle), 173 smoke tests against the live
            local Supabase, and 2 Playwright e2e specs that walk a real cashier through an online
            sale and an offline-then-reconnect sale. Up next: production deploy on Vercel + Supabase
            (Step 15).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/pos">
                <ScanLine className="size-4" /> Take payment
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/purchase-orders/new">
                <FilePlus2 className="size-4" /> New purchase order
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sessions/open">
                <KeyRound className="size-4" /> Open a till
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/sales">
                <Receipt className="size-4" /> Recent sales
              </Link>
            </Button>
            {(tenant.role === "owner" || tenant.role === "accountant") && (
              <Button asChild variant="ghost">
                <Link href="/audit">
                  <ShieldCheck className="size-4" /> View audit log
                </Link>
              </Button>
            )}
          </div>
          {salesSummary.paymentsByMethod.length > 0 ? (
            <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-3 text-xs">
              <BarChart3 className="size-3" /> Payment mix:
              {salesSummary.paymentsByMethod.map((p) => (
                <span key={p.method} className="capitalize">
                  {p.method}: {formatEuro(p.amount)}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function pctDelta(current: number, prior: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return null;
  if (prior === 0) {
    if (current === 0) return 0;
    return null; // can't compute % from 0
  }
  return ((current - prior) / Math.abs(prior)) * 100;
}
