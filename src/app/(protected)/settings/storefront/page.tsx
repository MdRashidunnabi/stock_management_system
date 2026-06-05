import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Globe, Settings } from "lucide-react";
import { StorefrontSettingsForm } from "@/components/storefront/storefront-settings-form";
import { requireRole } from "@/lib/auth/tenant";
import { getStorefrontSettingsForTenant } from "@/lib/storefront/settings-queries";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Online shop settings",
};

export default async function StorefrontSettingsPage() {
  const tenant = await requireRole(["owner", "manager", "super_admin"]);
  const settings = await getStorefrontSettingsForTenant(tenant.tenantId);
  const shopPath = `/shop/${tenant.tenantSlug}`;
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!settings) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Online shop settings</h1>
        <p className="text-muted-foreground text-sm">
          Your shop does not have an online storefront row yet. Complete onboarding or contact
          support.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-muted-foreground mb-1 flex items-center gap-2 text-sm">
            <Settings className="size-4" />
            Settings
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Online shop</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Website name, footer, contact, social links, online pricing defaults, delivery, and
            checkout for {settings.tenantDisplayName}.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={shopPath} target="_blank" rel="noopener noreferrer">
            <Globe className="size-4" />
            Preview shop
            <ExternalLink className="size-3" />
          </Link>
        </Button>
      </div>

      <StorefrontSettingsForm settings={settings} shopPath={shopPath} appOrigin={appOrigin} />
    </div>
  );
}
