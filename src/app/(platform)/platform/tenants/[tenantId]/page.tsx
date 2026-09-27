import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PlatformTenantWorkbench } from "@/components/platform/platform-tenant-workbench";
import { getPlatformTenantDetail } from "@/lib/billing/queries";
import { listPosDevices } from "@/lib/license/issue";
import { formatEuro } from "@/lib/utils";

export const metadata = { title: "Shop" };

export default async function PlatformTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const detail = await getPlatformTenantDetail(tenantId);
  if (!detail) notFound();

  const { tenant, billing, members } = detail;
  const devices = await listPosDevices(tenant.id);
  const cardLabel = billing?.cardOnFile
    ? `${billing.cardBrand ?? "Card"} •••• ${billing.cardLast4}`
    : "No card";
  const monthlyLabel = billing
    ? `${formatEuro(billing.monthlyAmountCents / 100)}/mo`
    : "€20.00/mo";

  return (
    <div className="space-y-6">
      <Link
        href="/platform"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ChevronLeft className="size-4" />
        All shops
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{tenant.display_name}</h1>
        <p className="text-muted-foreground text-sm">Each row is shop, till, or team. Edit is on the right.</p>
      </div>
      <PlatformTenantWorkbench
        tenantId={tenant.id}
        displayName={tenant.display_name}
        slug={tenant.slug}
        status={tenant.status}
        cardLabel={cardLabel}
        monthlyLabel={monthlyLabel}
        members={members.map((m) => ({
          user_id: m.user_id,
          email: m.email,
          role: m.role,
        }))}
        devices={devices}
      />
    </div>
  );
}
