import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type TeamMemberRow = {
  user_id: string;
  role: string;
  branch_id: string | null;
  is_active: boolean;
  invited_at: string | null;
  accepted_at: string | null;
  email: string | null;
  full_name: string | null;
};

export async function listTeamMembers(tenantId: string): Promise<TeamMemberRow[]> {
  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("user_tenants")
    .select("user_id, role, branch_id, is_active, invited_at, accepted_at")
    .eq("tenant_id", tenantId)
    .order("created_at");

  if (error) throw new Error(error.message);
  if (!members?.length) return [];

  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return members.map((m) => {
    const p = profileById.get(m.user_id);
    return {
      ...m,
      email: p?.email ?? null,
      full_name: p?.full_name ?? null,
    };
  });
}

export async function listPendingInvites(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_invites")
    .select("id, email, role, token, invited_at, expires_at")
    .eq("tenant_id", tenantId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("invited_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getInviteByToken(token: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tenant_invites")
    .select("id, email, role, tenant_id, expires_at, tenants:tenant_id ( display_name, slug )")
    .eq("token", token)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return null;
  const tenant = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants;
  return {
    id: data.id,
    email: data.email,
    role: data.role,
    tenantId: data.tenant_id,
    expiresAt: data.expires_at,
    shopName: tenant?.display_name ?? "Shop",
    shopSlug: tenant?.slug ?? "",
  };
}
