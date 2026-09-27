import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listBranchesForCurrentTenant } from "@/lib/pos/actions";
import { listOpenSessionsForBranch } from "@/lib/pos/sessions/actions";
import { PosTerminal } from "@/components/pos/pos-terminal";
import { DesktopPosBadge } from "@/components/pos/desktop-pos-badge";
import { ThisTillBanner } from "@/components/pos/this-till-banner";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export const metadata = {
  title: "Till · ShopOS",
};

const ALLOWED_ROLES = new Set(["owner", "manager", "cashier", "warehouse", "accountant"]);

export default async function PosPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const locale = await getRequestLocale();
  const m = getMessages(locale);

  if (!ALLOWED_ROLES.has(tenant.role)) {
    return (
      <div className="border-border bg-card mx-auto max-w-md rounded-xl border p-6 text-center">
        <h1 className="text-lg font-semibold">{m.pos.noAccessTitle}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{m.pos.noAccessBody}</p>
      </div>
    );
  }

  const branches = await listBranchesForCurrentTenant();
  if (branches.length === 0) {
    return (
      <div className="border-border bg-card mx-auto max-w-md rounded-xl border p-6 text-center">
        <h1 className="text-lg font-semibold">{m.pos.noBranchTitle}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{m.pos.noBranchBody}</p>
      </div>
    );
  }

  const defaultBranchId = branches[0]?.id ?? null;
  const openSessions = defaultBranchId ? await listOpenSessionsForBranch(defaultBranchId) : [];
  const tenantId = tenant.tenantId;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight" data-guide="pos">
            {m.pos.title}
          </h1>
          <DesktopPosBadge />
        </div>
        <ThisTillBanner
          sessions={openSessions}
          defaultBranchId={defaultBranchId}
          timezone={tenant.timezone}
          locale={tenant.locale}
          currency={tenant.currency}
          labels={{ tillOpen: m.pos.tillOpen, openTill: m.pos.openTill, since: m.pos.since }}
        />
      </div>

      <PosTerminal
        tenantId={tenantId}
        shopName={tenant.tenantName}
        branches={branches}
        defaultBranchId={defaultBranchId}
        currency={tenant.currency}
        locale={tenant.locale}
        vatRates={tenant.vatRates}
      />
    </div>
  );
}
