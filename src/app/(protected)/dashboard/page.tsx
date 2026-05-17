import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  FolderTree,
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

  const [products, categories, brands, suppliers, todaySales] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("brands").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("sales")
      .select("total")
      .eq("status", "completed")
      .gte("created_at", since.toISOString()),
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
          Step 8 - POS sale flow live
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
        <StatCard
          href="/pos"
          icon={<ScanLine className="size-4" />}
          label="Open POS"
          value="Sell"
          hint="cash · card · split"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-primary size-5" />
            <CardTitle className="text-lg">POS is ready</CardTitle>
          </div>
          <CardDescription>
            Take payments at the till - cash, card, contactless, or split. Each sale writes the
            receipt, line items, payments and stock movements in one atomic transaction. Up next:
            till open/close + Z-report (Step 9).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/pos">
                Open the till
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sales">Recent sales</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/products/new">Add a product</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/products/import">Bulk import</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ComingSoonCard
          icon={<Boxes className="size-5" />}
          title="Till sessions"
          description="Open / close till, Z-reports, cash drawer movements - Step 9."
        />
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
