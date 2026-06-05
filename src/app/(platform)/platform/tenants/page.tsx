import { PlatformTenantsList } from "@/components/platform/platform-tenants-list";
import { listAllTenantsForPlatform } from "@/lib/billing/queries";

export const metadata = { title: "All shops" };

export default async function PlatformTenantsPage() {
  const tenants = await listAllTenantsForPlatform();

  const rows = tenants.map((t) => ({
    id: t.id,
    displayName: t.displayName,
    slug: t.slug,
    status: t.status,
    trialEndsAt: t.trialEndsAt,
    cardOnFile: t.billing?.cardOnFile ?? false,
    cardLast4: t.billing?.cardLast4 ?? null,
    memberCount: t.memberCount,
    monthlyEur: (t.billing?.monthlyAmountCents ?? 2000) / 100,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All shops</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Search a shop, open it, then use simple buttons to extend trial, record payment, or pause
          the shop.
        </p>
      </div>
      <PlatformTenantsList tenants={rows} />
    </div>
  );
}
