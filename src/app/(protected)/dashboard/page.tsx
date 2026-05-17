import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FolderTree,
  KeyRound,
  Package,
  Receipt,
  ScanLine,
  Tag,
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

  const [products, categories, brands, suppliers, todaySales, openSessions] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("brands").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("sales")
      .select("total")
      .eq("status", "completed")
      .gte("created_at", since.toISOString()),
    supabase.from("pos_sessions").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const todaySalesRows = (todaySales.data ?? []) as Array<{ total: number }>;
  const todayRevenue = todaySalesRows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);

  return {
    products: products.count ?? 0,
    categories: categories.count ?? 0,
    brands: brands.count ?? 0,
    suppliers: suppliers.count ?? 0,
    salesToday: todaySalesRows.length,
    revenueToday: todayRevenue,
    openSessions: openSessions.count ?? 0,
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
          Step 9 - Till sessions + Z-report live
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
          href="/products"
          icon={<Package className="size-4" />}
          label="Products"
          value={counts.products.toString()}
          hint="active"
        />
        <StatCard
          href="/categories"
          icon={<FolderTree className="size-4" />}
          label="Categories"
          value={counts.categories.toString()}
          hint="active"
        />
        <StatCard
          href="/brands"
          icon={<Tag className="size-4" />}
          label="Brands"
          value={counts.brands.toString()}
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
            <CardTitle className="text-lg">Till sessions are ready</CardTitle>
          </div>
          <CardDescription>
            Open the till with a starting cash float, ring sales, record cash drops or pay-outs,
            then close with a counted cash total. We compute the variance and produce a printable
            Z-report. Up next: supplier receiving with weighted-average cost (Step 10).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/sessions/open">
                Open a till
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pos">
                <ScanLine className="size-4" /> Take payment
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/sessions">Past shifts</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/sales">Recent sales</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ComingSoonCard
          icon={<Truck className="size-5" />}
          title="Receiving"
          description="POs and goods receipts with weighted-average cost - Step 10."
        />
        <ComingSoonCard
          icon={<Users className="size-5" />}
          title="Customers"
          description="Loyalty, accounts, store credit - later in MVP."
        />
        <ComingSoonCard
          icon={<BarChart3 className="size-5" />}
          title="Owner reports"
          description="Daily profit, cash variance, top movers - Step 11."
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
