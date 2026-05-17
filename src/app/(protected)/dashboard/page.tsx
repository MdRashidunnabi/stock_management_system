import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  FolderTree,
  Package,
  ShoppingCart,
  Tag,
  Truck,
  Users,
} from "lucide-react";
import { requireTenant, requireUser } from "@/lib/auth/tenant";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard",
};

async function loadCounts() {
  const supabase = await createClient();
  const [products, categories, brands, suppliers] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("brands").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  return {
    products: products.count ?? 0,
    categories: categories.count ?? 0,
    brands: brands.count ?? 0,
    suppliers: suppliers.count ?? 0,
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
          Step 7 - Catalog CRUD live
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          href="/products"
          icon={<Package className="size-4" />}
          label="Products"
          value={counts.products}
        />
        <StatCard
          href="/categories"
          icon={<FolderTree className="size-4" />}
          label="Categories"
          value={counts.categories}
        />
        <StatCard
          href="/brands"
          icon={<Tag className="size-4" />}
          label="Brands"
          value={counts.brands}
        />
        <StatCard
          href="/suppliers"
          icon={<Truck className="size-4" />}
          label="Suppliers"
          value={counts.suppliers}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-primary size-5" />
            <CardTitle className="text-lg">Catalog is ready</CardTitle>
          </div>
          <CardDescription>
            You can now manage products, categories, brands, and suppliers, and bulk-import products
            from a CSV. Up next: POS sale flow with stock ledger writes (Step 8).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/products/new">
                Add a product
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/products/import">Bulk import</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/categories">Manage categories</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/suppliers">Manage suppliers</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ComingSoonCard
          icon={<ShoppingCart className="size-5" />}
          title="POS"
          description="Tablet POS with scanner, payments, and stock writes - Step 8."
        />
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
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
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
          <p className="text-muted-foreground text-xs">active in this shop</p>
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
