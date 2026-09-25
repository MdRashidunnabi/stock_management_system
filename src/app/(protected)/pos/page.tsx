import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listBranchesForCurrentTenant } from "@/lib/pos/actions";
import { getOpenSessionForBranch } from "@/lib/pos/sessions/actions";
import { PosTerminal } from "@/components/pos/pos-terminal";
import { DesktopPosBadge } from "@/components/pos/desktop-pos-badge";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages, interpolate } from "@/lib/i18n/messages";
import { formatShiftLabel, formatTillLabel } from "@/lib/pos/shifts";

export const metadata = {
  title: "Till · ShopOS",
};

const ALLOWED_ROLES = new Set(["owner", "manager", "cashier", "warehouse"]);

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
  const openSession = defaultBranchId ? await getOpenSessionForBranch(defaultBranchId) : null;
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
        {openSession ? (
          <Link
            href={`/sessions/${openSession.id}`}
            className="border-border bg-card hover:bg-accent flex items-center gap-3 rounded-md border px-3 py-2 text-xs"
          >
            <Badge variant="default">{m.pos.tillOpen}</Badge>
            <span className="text-muted-foreground">
              {formatTillLabel(openSession.till_number)} ·{" "}
              {formatShiftLabel(openSession.shift_code)} ·{" "}
              {interpolate(m.pos.since, {
                when: formatDateTime(openSession.opened_at, tenant.timezone, tenant.locale),
                amount: formatMoney(openSession.opening_cash, tenant.currency, tenant.locale),
              })}
            </span>
          </Link>
        ) : (
          <Link
            href={`/sessions/open${defaultBranchId ? `?branch=${defaultBranchId}` : ""}`}
            className="border-input bg-card hover:bg-accent inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
          >
            <KeyRound className="size-4" /> {m.pos.openTill}
          </Link>
        )}
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
