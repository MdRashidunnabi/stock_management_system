import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
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
  Globe,
  ExternalLink,
} from "lucide-react";
import { requireTenant, requireUser } from "@/lib/auth/tenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages, interpolate } from "@/lib/i18n/messages";
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
  const money = (n: number) => formatMoney(n, tenant.currency, tenant.locale);

  const periodRange = getPeriodRange(period, new Date(), tenant.timezone);
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

  const locale = await getRequestLocale();
  const m = getMessages(locale);
  const greetName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    user.email?.split("@")[0] ||
    "";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" data-guide="dashboard">
            {interpolate(m.dash.hello, { name: greetName })}
          </h1>
          <p className="text-muted-foreground text-sm">
            {interpolate(m.dash.shopLine, {
              shop: tenant.tenantName,
              role: tenant.role,
              period: periodRange.label.toLowerCase(),
            })}
          </p>
        </div>
        <PeriodTabs active={period} />
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          icon={<TrendingUp className="size-4" />}
          label={m.dash.revenue}
          value={money(salesSummary.grossRevenue)}
          hint={`${salesSummary.salesCount} ${salesSummary.salesCount === 1 ? m.dash.sale : m.dash.salesPlural}`}
          trend={revenueDelta}
          href="/sales"
        />
        <KpiTile
          icon={<Sparkles className="size-4" />}
          label={m.dash.profit}
          value={money(salesSummary.grossProfit)}
          hint={`${salesSummary.grossMarginPct.toFixed(1)}% margin · cost ${money(salesSummary.costOfGoods)}`}
          trend={profitDelta}
          emphasis={salesSummary.grossProfit < 0 ? "bad" : "default"}
        />
        <KpiTile
          icon={<ShoppingCart className="size-4" />}
          label={m.dash.basket}
          value={money(salesSummary.averageBasket)}
          hint={
            salesSummary.salesCount > 0
              ? `${salesSummary.salesCount} ${m.dash.salesPlural}`
              : m.dash.noSales
          }
          trend={basketDelta}
        />
        <KpiTile
          icon={<Coins className="size-4" />}
          label={m.dash.variance}
          value={money(sessionVariance.totalVariance)}
          hint={
            sessionVariance.closedSessions === 0
              ? m.dash.noShifts
              : `${sessionVariance.closedSessions} ${m.dash.shifts}`
          }
          emphasis={sessionVariance.closedSessions > 0 ? varianceTone : "default"}
          href="/sessions"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          icon={<Receipt className="size-4" />}
          label={m.dash.salesCount}
          value={salesSummary.salesCount.toString()}
          hint={interpolate(m.dash.prior, { n: String(priorSummary.salesCount) })}
          trend={salesCountDelta}
        />
        <KpiTile
          icon={<KeyRound className="size-4" />}
          label={m.dash.openTills}
          value={openTills.toString()}
          hint={openTills === 0 ? m.dash.noShift : m.dash.shiftOn}
          href="/sessions"
          emphasis={openTills > 0 ? "good" : "default"}
        />
        <KpiTile
          icon={<FilePlus2 className="size-4" />}
          label={m.dash.openPos}
          value={outstandingPos.count.toString()}
          hint={interpolate(m.dash.onOrder, { amount: money(outstandingPos.totalValue) })}
          href="/purchase-orders"
        />
        <KpiTile
          icon={<PackagePlus className="size-4" />}
          label={m.dash.drafts}
          value={draftReceipts.toString()}
          hint={draftReceipts === 0 ? m.dash.caughtUp : m.dash.needsDone}
          href="/goods-receipts"
          emphasis={draftReceipts > 0 ? "warn" : "default"}
        />
      </div>

      {/* Sales chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">{m.dash.chart}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SalesChart
            series={series}
            highlightLast={1}
            currency={tenant.currency}
            locale={tenant.locale}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top products */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{m.dash.top}</CardTitle>
              </div>
              <Link
                href="/sales"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
              >
                {m.dash.sales} <ArrowRight className="size-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <TopProducts rows={topProducts} currency={tenant.currency} locale={tenant.locale} />
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                  {m.dash.low}
                </CardTitle>
              </div>
              <Link
                href="/products"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
              >
                {m.nav.products} <ArrowRight className="size-3" />
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
              <CardTitle className="text-base">{m.dash.shifts}</CardTitle>
            </div>
            <Link
              href="/sessions"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
            >
              {m.nav.sessions} <ArrowRight className="size-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <RecentShifts
            rows={sessionVariance.rows}
            currency={tenant.currency}
            locale={tenant.locale}
            timezone={tenant.timezone}
          />
        </CardContent>
      </Card>

      {/* Online store */}
      <Card className="border-primary/25 from-primary/10 to-info/5 bg-gradient-to-br">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="text-primary size-4" />
            {m.dash.online}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/shop/${tenant.tenantSlug}`} target="_blank" rel="noopener noreferrer">
              {m.dash.openShop}
              <ExternalLink className="size-3.5" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/online-orders">{m.dash.onlineOrders}</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.dash.quick}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/pos">
                <ScanLine className="size-4" /> {m.dash.takePayment}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/purchase-orders/new">
                <FilePlus2 className="size-4" /> {m.dash.newPo}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sessions/open">
                <KeyRound className="size-4" /> {m.dash.openTill}
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/sales">
                <Receipt className="size-4" /> {m.dash.sales}
              </Link>
            </Button>
            {(tenant.role === "owner" || tenant.role === "accountant") && (
              <Button asChild variant="ghost">
                <Link href="/audit">
                  <ShieldCheck className="size-4" /> {m.dash.audit}
                </Link>
              </Button>
            )}
          </div>
          {salesSummary.paymentsByMethod.length > 0 ? (
            <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-3 text-xs">
              <BarChart3 className="size-3" /> Payment mix:
              {salesSummary.paymentsByMethod.map((p) => (
                <span key={p.method} className="capitalize">
                  {p.method}: {money(p.amount)}
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
