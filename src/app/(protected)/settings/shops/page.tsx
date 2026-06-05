import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Store } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/tenant";
import { getBillingAccountForOwner, listOwnerShops } from "@/lib/billing/account-queries";
import { formatPlanSummary } from "@/lib/billing/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "My shops" };

export default async function MyShopsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [shops, account] = await Promise.all([
    listOwnerShops(user.id),
    getBillingAccountForOwner(user.id),
  ]);

  const licensed = account?.licensedShopCount ?? 1;
  const canAdd = shops.length < licensed;
  const planText = account && formatPlanSummary(account.planShopTier, account.planBranchTier);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My shops</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Switch between shops from the menu at the top. Each shop has its own products and
            website.
          </p>
          {planText ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Plan: {planText} · {shops.length} of {licensed} shop(s) used
            </p>
          ) : null}
        </div>
        {canAdd ? (
          <Button asChild>
            <Link href="/onboarding">
              <Plus className="size-4" />
              Add another shop
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/settings/billing">Upgrade plan</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {shops.map((s) => (
          <Card key={s.tenantId}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Store className="size-5" />
                {s.displayName}
              </CardTitle>
              <CardDescription>{s.slug}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <Badge variant="outline" className="capitalize">
                {s.status.replace("_", " ")}
              </Badge>
              <Button variant="link" size="sm" asChild>
                <Link href={`/shop/${s.slug}`} target="_blank">
                  View website
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
