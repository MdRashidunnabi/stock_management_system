import type { Metadata } from "next";
import { TeamSettingsPanel } from "@/components/team/team-settings-panel";
import { requireRole } from "@/lib/auth/tenant";
import { listPendingInvites, listTeamMembers } from "@/lib/team/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Team" };

export default async function TeamSettingsPage() {
  const tenant = await requireRole(["owner", "manager"]);
  const [members, invites] = await Promise.all([
    listTeamMembers(tenant.tenantId),
    listPendingInvites(tenant.tenantId),
  ]);

  const supabase = await createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, code")
    .eq("tenant_id", tenant.tenantId)
    .eq("is_active", true)
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-guide="team">
          Team
        </h1>
      </div>
      <TeamSettingsPanel
        members={members}
        invites={invites}
        branches={branches ?? []}
        canManage={tenant.role === "owner" || tenant.role === "manager"}
      />
    </div>
  );
}
