import Link from "next/link";
import { Building2, CreditCard, Users, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listAllTenantsForPlatform } from "@/lib/billing/queries";

export const metadata = { title: "Platform admin" };

export default async function PlatformHomePage() {
  const tenants = await listAllTenantsForPlatform();
  const trial = tenants.filter((t) => t.status === "trial").length;
  const active = tenants.filter((t) => t.status === "active").length;
  const suspended = tenants.filter((t) => t.status === "suspended").length;
  const pastDue = tenants.filter((t) => t.status === "past_due").length;
  const needsCard = tenants.filter((t) => t.status === "trial" && !t.billing?.cardOnFile).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Shop control centre</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Manage every customer shop in one place. Use plain actions — record payment, extend trial,
          or pause a shop if they have not paid.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total shops</CardDescription>
            <CardTitle className="text-3xl">{tenants.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>On free trial</CardDescription>
            <CardTitle className="text-3xl text-emerald-600">{trial}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid & active</CardDescription>
            <CardTitle className="text-3xl">{active}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={suspended + pastDue > 0 ? "border-destructive/50" : ""}>
          <CardHeader className="pb-2">
            <CardDescription>Need attention</CardDescription>
            <CardTitle className="text-destructive text-3xl">{suspended + pastDue}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground pt-0 text-xs">
            {suspended} paused · {pastDue} payment issue
          </CardContent>
        </Card>
      </div>

      {needsCard > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <p>
            <strong>{needsCard}</strong> shop(s) on trial still need a card on file. They cannot use
            POS until the owner completes billing.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/platform/tenants">
                <Building2 className="size-4" />
                Find a shop
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/platform/staff">
                <Users className="size-4" />
                Who can access this panel
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="size-5" />
              Billing mode
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Demo billing is on. Buttons here do what Stripe will do later when you connect payments.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
