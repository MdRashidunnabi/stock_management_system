import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TenantAdminPanel } from "@/components/platform/tenant-admin-panel";
import { Badge } from "@/components/ui/badge";
import { getPlatformTenantDetail } from "@/lib/billing/queries";
import { formatEuro } from "@/lib/utils";

export const metadata = { title: "Shop detail" };

export default async function PlatformTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const detail = await getPlatformTenantDetail(tenantId);
  if (!detail) notFound();

  const { tenant, billing, members } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/platform/tenants"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ChevronLeft className="size-4" />
        All shops
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{tenant.display_name}</h1>
        <p className="text-muted-foreground text-sm">
          {tenant.slug} · {tenant.legal_name}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge className="capitalize">{tenant.status.replace("_", " ")}</Badge>
        {billing?.cardOnFile ? (
          <Badge variant="secondary">
            {billing.cardBrand} •••• {billing.cardLast4}
          </Badge>
        ) : null}
        {billing ? (
          <Badge variant="outline">{formatEuro(billing.monthlyAmountCents / 100)}/mo</Badge>
        ) : null}
      </div>

      <TenantAdminPanel tenantId={tenant.id} status={tenant.status} />

      <div className="border-border rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">Team members</h2>
        <ul className="space-y-2 text-sm">
          {members.map((m) => (
            <li key={m.user_id} className="flex justify-between">
              <span>{m.email}</span>
              <span className="text-muted-foreground capitalize">{m.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
