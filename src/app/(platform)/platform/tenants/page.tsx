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
    tillActiveCount: t.tillActiveCount,
    tillTotalCount: t.tillTotalCount,
    teamPreview: t.teamPreview,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All shops</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          One row per shop. Edit on the right opens extra controls.
        </p>
      </div>
      <PlatformTenantsList tenants={rows} />
    </div>
  );
}
