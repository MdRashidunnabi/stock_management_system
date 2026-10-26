"use server";

import { revalidatePath } from "next/cache";
import { ActionError, authActionClient, staffActionClient } from "@/lib/safe-action";
import {
  acceptInviteSchema,
  createInviteSchema,
  createStaffLoginSchema,
  removeStaffSchema,
  type STAFF_LOGIN_ROLES,
  revokeInviteSchema,
  setStaffPasswordSchema,
} from "@/lib/team/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const INVITE_ROLES = ["owner", "manager"] as const;
const LOGIN_CONTROL_ROLES = ["owner", "super_admin"] as const;

export const createTeamInviteAction = staffActionClient([...INVITE_ROLES])
  .metadata({ actionName: "team.createInvite" })
  .inputSchema(createInviteSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const email = parsedInput.email.trim().toLowerCase();

    const members = await supabase
      .from("user_tenants")
      .select("user_id")
      .eq("tenant_id", ctx.tenant.tenantId)
      .eq("is_active", true);

    if (members.data?.length) {
      const userIds = members.data.map((m) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("email").in("id", userIds);
      if (profiles?.some((p) => p.email?.toLowerCase() === email)) {
        throw new ActionError("This person is already on your team.");
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("tenant_invites")
      .insert({
        tenant_id: ctx.tenant.tenantId,
        email,
        role: parsedInput.role,
        branch_id: parsedInput.branchId?.trim() ? parsedInput.branchId : null,
        invited_by: user?.id ?? null,
      })
      .select("id, token")
      .single();

    if (error) throw new ActionError(error.message);

    const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/invite/${data.token}`;
    revalidatePath("/settings/team");
    return { ok: true as const, inviteUrl, inviteId: data.id };
  });

export const revokeTeamInviteAction = staffActionClient([...INVITE_ROLES])
  .metadata({ actionName: "team.revokeInvite" })
  .inputSchema(revokeInviteSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("tenant_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", parsedInput.inviteId)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) throw new ActionError(error.message);
    revalidatePath("/settings/team");
    return { ok: true as const };
  });

export const acceptTeamInviteAction = authActionClient
  .metadata({ actionName: "team.acceptInvite" })
  .inputSchema(acceptInviteSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("accept_tenant_invite", {
      p_token: parsedInput.token,
    });

    if (error) throw new ActionError(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as {
      tenant_id: string;
      role: string;
      tenant_slug: string;
    } | null;
    if (!row?.tenant_id) throw new ActionError("Could not accept invite.");

    return {
      ok: true as const,
      tenantId: row.tenant_id,
      tenantSlug: row.tenant_slug,
    };
  });

const PROTECTED_ROLES = new Set(["owner", "super_admin"]);

export const createStaffLoginAction = staffActionClient([...LOGIN_CONTROL_ROLES])
  .metadata({ actionName: "team.createStaffLogin" })
  .inputSchema(createStaffLoginSchema)
  .action(async ({ parsedInput, ctx }) => {
    const email = parsedInput.email.trim().toLowerCase();
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    let userId = profile?.id ?? null;
    if (userId) {
      const memberships = await loadMemberships(admin, ctx.tenant.tenantId, userId);
      assertNotProtected(memberships);
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: parsedInput.password,
        email_confirm: true,
        user_metadata: await withStaffPassword(admin, userId, parsedInput.password),
      });
      if (error) throw new ActionError(error.message);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: parsedInput.password,
        email_confirm: true,
        user_metadata: { shopos_staff_password: parsedInput.password },
      });
      if (error || !data.user)
        throw new ActionError(error?.message ?? "Could not create that login.");
      userId = data.user.id;
    }

    await upsertStaffMembership({
      admin,
      userId,
      tenantId: ctx.tenant.tenantId,
      role: parsedInput.role,
      invitedBy: ctx.user.id,
    });
    revalidatePath("/settings/team");
    return { ok: true as const, email, password: parsedInput.password };
  });

export const setStaffPasswordAction = staffActionClient([...LOGIN_CONTROL_ROLES])
  .metadata({ actionName: "team.setStaffPassword" })
  .inputSchema(setStaffPasswordSchema)
  .action(async ({ parsedInput, ctx }) => {
    const admin = createAdminClient();
    const memberships = await loadMemberships(admin, ctx.tenant.tenantId, parsedInput.userId);
    if (!memberships.length) throw new ActionError("That person is not on this shop.");
    assertNotProtected(memberships);
    const { error } = await admin.auth.admin.updateUserById(parsedInput.userId, {
      password: parsedInput.password,
      email_confirm: true,
      user_metadata: await withStaffPassword(admin, parsedInput.userId, parsedInput.password),
    });
    if (error) throw new ActionError(error.message);
    revalidatePath("/settings/team");
    return { ok: true as const };
  });

export const removeStaffAction = staffActionClient([...LOGIN_CONTROL_ROLES])
  .metadata({ actionName: "team.removeStaff" })
  .inputSchema(removeStaffSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (parsedInput.userId === ctx.user.id) {
      throw new ActionError("You cannot remove your own login.");
    }
    const admin = createAdminClient();
    const memberships = await loadMemberships(admin, ctx.tenant.tenantId, parsedInput.userId);
    if (!memberships.length) throw new ActionError("That person is not on this shop.");
    assertNotProtected(memberships);
    const { error } = await admin
      .from("user_tenants")
      .update({ is_active: false })
      .eq("tenant_id", ctx.tenant.tenantId)
      .eq("user_id", parsedInput.userId);
    if (error) throw new ActionError(error.message);
    await admin.auth.admin.updateUserById(parsedInput.userId, {
      user_metadata: await withStaffPassword(admin, parsedInput.userId, null),
    });
    revalidatePath("/settings/team");
    return { ok: true as const };
  });

async function loadMemberships(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  userId: string,
) {
  const { data, error } = await admin
    .from("user_tenants")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw new ActionError(error.message);
  return data ?? [];
}

function assertNotProtected(rows: Array<{ role: string }>) {
  if (rows.some((row) => PROTECTED_ROLES.has(row.role))) {
    throw new ActionError("The owner login is managed by the superadmin.");
  }
}

async function withStaffPassword(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  password: string | null,
) {
  const { data } = await admin.auth.admin.getUserById(userId);
  const current = data.user?.user_metadata ?? {};
  return { ...current, shopos_staff_password: password };
}

async function upsertStaffMembership(input: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  tenantId: string;
  role: (typeof STAFF_LOGIN_ROLES)[number];
  invitedBy: string;
}) {
  const { data: existing, error } = await input.admin
    .from("user_tenants")
    .select("id, role")
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.userId);
  if (error) throw new ActionError(error.message);
  if (existing?.some((row) => PROTECTED_ROLES.has(row.role))) {
    throw new ActionError("The owner login is managed by the superadmin.");
  }
  const now = new Date().toISOString();
  if (existing?.length) {
    const { error: updateError } = await input.admin
      .from("user_tenants")
      .update({ role: input.role, is_active: true, accepted_at: now })
      .eq("id", existing[0]!.id);
    if (updateError) throw new ActionError(updateError.message);
    return;
  }
  const { error: insertError } = await input.admin.from("user_tenants").insert({
    user_id: input.userId,
    tenant_id: input.tenantId,
    role: input.role,
    is_active: true,
    invited_by: input.invitedBy,
    accepted_at: now,
  });
  if (insertError) throw new ActionError(insertError.message);
}
