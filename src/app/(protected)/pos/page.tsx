import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listBranchesForCurrentTenant } from "@/lib/pos/actions";
import { getOpenSessionForBranch } from "@/lib/pos/sessions/actions";
import { PosTerminal } from "@/components/pos/pos-terminal";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeIE, formatEuro } from "@/lib/utils";

export const metadata = {
  title: "POS · ShopOS",
};

const ALLOWED_ROLES = new Set(["owner", "manager", "cashier", "warehouse"]);

export default async function PosPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  if (!ALLOWED_ROLES.has(tenant.role)) {
    return (
      <div className="border-border bg-card mx-auto max-w-md rounded-xl border p-6 text-center">
        <h1 className="text-lg font-semibold">No access</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your role on <strong>{tenant.tenantName}</strong> ({tenant.role}) does not allow taking
          payments. Ask the shop owner to grant you the cashier or manager role.
        </p>
      </div>
    );
  }

  const branches = await listBranchesForCurrentTenant();
  if (branches.length === 0) {
    return (
      <div className="border-border bg-card mx-auto max-w-md rounded-xl border p-6 text-center">
        <h1 className="text-lg font-semibold">No active branch</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          You need at least one active branch to start selling. Add one from the Onboarding wizard
          or in branch settings.
        </p>
      </div>
    );
  }

  const defaultBranchId = branches[0]?.id ?? null;
  const openSession = defaultBranchId ? await getOpenSessionForBranch(defaultBranchId) : null;
  const tenantId = tenant.tenantId;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Point of sale</h1>
          <p className="text-muted-foreground text-sm">
            Take payments, print receipts, and update stock - all in one tap.
          </p>
        </div>
        {openSession ? (
          <Link
            href={`/sessions/${openSession.id}`}
            className="border-border bg-card hover:bg-accent flex items-center gap-3 rounded-md border px-3 py-2 text-xs"
          >
            <Badge variant="default">Till open</Badge>
            <span className="text-muted-foreground">
              Since {formatDateTimeIE(openSession.opened_at)} · float{" "}
              <strong>{formatEuro(openSession.opening_cash)}</strong>
            </span>
          </Link>
        ) : (
          <Link
            href={`/sessions/open${defaultBranchId ? `?branch=${defaultBranchId}` : ""}`}
            className="border-input bg-card hover:bg-accent inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
          >
            <KeyRound className="size-4" /> Open till
          </Link>
        )}
      </div>

      <PosTerminal tenantId={tenantId} branches={branches} defaultBranchId={defaultBranchId} />
    </div>
  );
}
