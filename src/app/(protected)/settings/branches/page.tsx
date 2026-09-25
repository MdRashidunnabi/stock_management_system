import type { Metadata } from "next";
import { BranchesPanel } from "@/components/settings/branches-panel";
import { getBillingAccountForTenant } from "@/lib/billing/account-queries";
import { requireRole } from "@/lib/auth/tenant";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Branches" };

export default async function BranchesSettingsPage() {
  const tenant = await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, code, name, city")
    .eq("tenant_id", tenant.tenantId)
    .eq("is_active", true)
    .order("name");

  const account = await getBillingAccountForTenant(tenant.tenantId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-guide="branches">
          Branches
        </h1>
      </div>
      <BranchesPanel
        branches={branches ?? []}
        licensedBranchCount={account?.licensedBranchCount ?? 1}
      />
    </div>
  );
}
