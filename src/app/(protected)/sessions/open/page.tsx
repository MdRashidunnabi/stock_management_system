import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listBranchesForCurrentTenant } from "@/lib/pos/actions";
import { OpenSessionForm } from "@/components/pos/sessions/open-session-form";

export const metadata = { title: "Open till · ShopOS" };

export default async function OpenSessionPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const branches = await listBranchesForCurrentTenant();
  if (branches.length === 0) {
    return (
      <div className="border-border bg-card mx-auto max-w-md rounded-xl border p-6 text-center">
        <h1 className="text-lg font-semibold">No active branch</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          You need at least one active branch to open a till.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/sessions"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="size-4" /> Back to till sessions
      </Link>
      <div className="border-border bg-card rounded-lg border p-6">
        <h1 className="text-xl font-semibold tracking-tight">Open a till</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Count the cash currently in the drawer and enter it as the opening float.
        </p>
        <div className="mt-6">
          <OpenSessionForm branches={branches} defaultBranchId={branches[0]?.id ?? null} />
        </div>
      </div>
    </div>
  );
}
