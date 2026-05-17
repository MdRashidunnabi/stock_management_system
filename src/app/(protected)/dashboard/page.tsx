import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FilePlus2,
  KeyRound,
  Package,
  PackagePlus,
  Receipt,
  ScanLine,
  Truck,
  Users,
} from "lucide-react";
import { requireTenant, requireUser } from "@/lib/auth/tenant";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEuro } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
};

async function loadCounts() {
  const supabase = await createClient();

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const [products, suppliers, todaySales, openSessions, openOrders, draftReceipts] =
    await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("sales")
        .select("total")
        .eq("status", "completed")
        .gte("created_at", since.toISOString()),
      supabase
        .from("pos_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "submitted", "partially_received"]),
      supabase
        .from("goods_receipts")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
    ]);

  const todaySalesRows = (todaySales.data ?? []) as Array<{ total: number }>;
  const todayRevenue = todaySalesRows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);

  return {
    products: products.count ?? 0,
    suppliers: suppliers.count ?? 0,
    salesToday: todaySalesRows.length,
    revenueToday: todayRevenue,
    openSessions: openSessions.count ?? 0,
    openOrders: openOrders.count ?? 0,
    draftReceipts: draftReceipts.count ?? 0,
  };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const tenant = await requireTenant();
  const counts = await loadCounts();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
          Step 10 - Supplier receiving + weighted-average cost live
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome back, {user.user_metadata?.full_name ?? user.email?.split("@")[0]}
        </h1>
        <p className="text-muted-foreground text-sm">
          You are signed in to{" "}
          <span className="text-foreground font-medium">{tenant.tenantName}</span> as a{" "}
          <span className="capitalize">{tenant.role}</span>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          href="/sales"
          icon={<Receipt className="size-4" />}
          label="Sales today"
          value={counts.salesToday.toString()}
          hint={formatEuro(counts.revenueToday)}
        />
        <StatCard
          href="/sessions"
          icon={<KeyRound className="size-4" />}
          label="Open tills"
          value={counts.openSessions.toString()}
          hint={counts.openSessions === 0 ? "no shift in progress" : "shift in progress"}
        />
        <StatCard
          href="/purchase-orders"
          icon={<FilePlus2 className="size-4" />}
          label="Open POs"
          value={counts.openOrders.toString()}
          hint="awaiting goods"
        />
        <StatCard
          href="/goods-receipts"
          icon={<PackagePlus className="size-4" />}
          label="Draft receipts"
          value={counts.draftReceipts.toString()}
          hint="not yet finalised"
        />
        <StatCard
          href="/products"
          icon={<Package className="size-4" />}
          label="Products"
          value={counts.products.toString()}
          hint="active"
        />
        <StatCard
          href="/suppliers"
          icon={<Truck className="size-4" />}
          label="Suppliers"
          value={counts.suppliers.toString()}
          hint="active"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-primary size-5" />
            <CardTitle className="text-lg">Supplier receiving is ready</CardTitle>
          </div>
          <CardDescription>
            Order stock from your suppliers, then log a goods receipt when the boxes arrive.
            Finalising a receipt updates inventory and recalculates each product&apos;s
            weighted-average cost - so margin reports stay accurate even when supplier prices move.
            Up next: owner reports (Step 11).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/purchase-orders/new">
                Create purchase order
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/goods-receipts/new">
                <PackagePlus className="size-4" /> Receive goods
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/purchase-orders">Open POs</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/pos">
                <ScanLine className="size-4" /> Take payment
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ComingSoonCard
          icon={<BarChart3 className="size-5" />}
          title="Owner reports"
          description="Daily profit, cash variance, top movers - Step 11."
        />
        <ComingSoonCard
          icon={<Users className="size-5" />}
          title="Customers"
          description="Loyalty, accounts, store credit - later in MVP."
        />
        <ComingSoonCard
          icon={<CheckCircle2 className="size-5" />}
          title="Audit + backups"
          description="Full audit log + nightly backup script - Step 12."
        />
      </div>
    </div>
  );
}

function StatCard({
  href,
  icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:bg-muted/40 h-full transition-colors">
        <CardHeader className="pb-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            {icon}
            <span>{label}</span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{value}</p>
          {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
        </CardContent>
      </Card>
    </Link>
  );
}

function ComingSoonCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">{icon}</div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
