import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { listBranchesForCurrentTenant } from "@/lib/pos/actions";
import { OpenSessionForm } from "@/components/pos/sessions/open-session-form";
import { parseShiftCode } from "@/lib/pos/shifts";
import { listTillSlotsByBranch } from "@/lib/pos/sessions/actions";

export const metadata = { title: "Open till · ShopOS" };

export default async function OpenSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; shift?: string; date?: string }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const params = await searchParams;

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

  const tillSlotsByBranch = await listTillSlotsByBranch(branches.map((b) => b.id));

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/sessions"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="size-4" /> Back to till sessions
      </Link>
      <div className="border-border bg-card rounded-lg border p-6">
        <h1 className="text-xl font-semibold tracking-tight" data-guide="open-till">
          Open a till
        </h1>
        <div className="mt-6">
          <OpenSessionForm
            branches={branches}
            defaultBranchId={
              branches.find((b) => b.id === params.branch)?.id ?? branches[0]?.id ?? null
            }
            defaultShift={params.shift ? parseShiftCode(params.shift) : undefined}
            defaultBusinessDate={
              params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : undefined
            }
            tillSlotsByBranch={tillSlotsByBranch}
          />
        </div>
      </div>
    </div>
  );
}
