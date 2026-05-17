import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listBranchesForCurrentTenant } from "@/lib/pos/actions";
import { PosTerminal } from "@/components/pos/pos-terminal";

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

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Point of sale</h1>
          <p className="text-muted-foreground text-sm">
            Take payments, print receipts, and update stock - all in one tap.
          </p>
        </div>
      </div>

      <PosTerminal branches={branches} defaultBranchId={branches[0]?.id ?? null} />
    </div>
  );
}
