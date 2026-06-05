"use server";

import { revalidatePath } from "next/cache";
import { ActionError, authActionClient, staffActionClient } from "@/lib/safe-action";
import { acceptInviteSchema, createInviteSchema, revokeInviteSchema } from "@/lib/team/schemas";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const INVITE_ROLES = ["owner", "manager"] as const;

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
