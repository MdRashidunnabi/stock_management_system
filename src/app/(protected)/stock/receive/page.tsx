import { redirect } from "next/navigation";
import { ScanBarcode } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listBranchesForCurrentTenant } from "@/lib/pos/actions";
import { ReceiveStockStation } from "@/components/inventory/receive-stock-station";

export const metadata = {
  title: "Scan in · ShopOS",
};

const ALLOWED_ROLES = new Set(["owner", "manager", "warehouse"]);

export default async function ReceiveStockPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  if (!ALLOWED_ROLES.has(tenant.role)) {
    return (
      <div className="border-border bg-card mx-auto max-w-md rounded-xl border p-6 text-center">
        <h1 className="text-lg font-semibold">No access</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Receiving stock is for the owner, manager, or warehouse.
        </p>
      </div>
    );
  }

  const branches = await listBranchesForCurrentTenant();
  if (branches.length === 0) {
    return (
      <div className="border-border bg-card mx-auto max-w-md rounded-xl border p-6 text-center">
        <h1 className="text-lg font-semibold">No branch</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Add a branch in Settings before you scan stock in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1
          className="flex items-center gap-2 text-2xl font-semibold tracking-tight"
          data-guide="scan-in"
        >
          <ScanBarcode className="size-6" />
          Scan in
        </h1>
      </div>
      <ReceiveStockStation branches={branches} defaultBranchId={branches[0]?.id ?? null} />
    </div>
  );
}
