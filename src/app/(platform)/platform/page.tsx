import { PlatformTenantsList } from "@/components/platform/platform-tenants-list";
import { listAllTenantsForPlatform } from "@/lib/billing/queries";

function toListRows(tenants: Awaited<ReturnType<typeof listAllTenantsForPlatform>>) {
  return tenants.map((t) => ({
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
}

export const metadata = { title: "Shops" };

export default async function PlatformHomePage() {
  const tenants = await listAllTenantsForPlatform();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-guide="platform">
          Shops
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          One row per shop. Use Edit on the right for billing, tills, and extra controls.
        </p>
      </div>
      <PlatformTenantsList tenants={toListRows(tenants)} />
    </div>
  );
}
