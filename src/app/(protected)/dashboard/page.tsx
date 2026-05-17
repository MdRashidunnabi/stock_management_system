import type { Metadata } from "next";
import { CheckCircle2, ShoppingCart, Boxes, Truck, Users, BarChart3 } from "lucide-react";
import { requireTenant, requireUser } from "@/lib/auth/tenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const tenant = await requireTenant();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
          Step 5 - Auth flow live
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome back, {user.user_metadata?.full_name ?? user.email?.split("@")[0]}
        </h1>
        <p className="text-muted-foreground text-sm">
          You are signed in to{" "}
          <span className="text-foreground font-medium">{tenant.tenantName}</span> as a{" "}
          <span className="capitalize">{tenant.role}</span>. Tenant id{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">{tenant.tenantId}</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-primary size-5" />
            <CardTitle className="text-lg">Auth foundations are in place</CardTitle>
          </div>
          <CardDescription>
            Sign in / sign up / password reset / RLS-aware Supabase clients / tenant context
            middleware / multi-tenant switcher are all live. Next we&apos;ll wire onboarding (create
            your first shop) and the catalog CRUD.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ComingSoonCard
          icon={<Boxes className="size-5" />}
          title="Catalog"
          description="Categories, brands, suppliers, and products with bulk import - Step 7."
        />
        <ComingSoonCard
          icon={<ShoppingCart className="size-5" />}
          title="POS"
          description="Tablet POS with scanner, payments, and stock writes - Step 8."
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
