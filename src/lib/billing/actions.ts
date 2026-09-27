"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, authActionClient, staffActionClient } from "@/lib/safe-action";
import {
  paymentCardSchema,
  extendTrialSchema,
  platformTenantActionSchema,
  platformCreateShopMemberSchema,
  platformShopMemberIdSchema,
  platformUpdateShopMemberRoleSchema,
  platformSetShopMemberPasswordSchema,
} from "@/lib/billing/schemas";
import { getBillingProvider } from "@/lib/billing/provider";
import { isPlatformStaff } from "@/lib/platform/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  demoActivate,
  demoCancel,
  demoExtendTrial,
  demoPastDue,
  demoPay,
  demoSuspend,
} from "@/lib/billing/demo-provider";
import { emailSchema, fullNameSchema, passwordSchema } from "@/lib/auth/schemas";
import { hitRateLimit } from "@/lib/security/rate-limit";
import { sendStaffAccessEmail } from "@/lib/mail/staff-access";

function revalidatePlatform(tenantId: string) {
  revalidatePath("/platform");
  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${tenantId}`);
}

const STATUS_MESSAGE: Record<string, string> = {
  trial: "This shop is now on Trial.",
  active: "This shop is now Active. They can sell.",
  past_due: "This shop is now Past due.",
  suspended: "This shop is now Paused.",
  cancelled: "This shop is now Cancelled.",
};

async function runDemo(work: () => Promise<void>) {
  try {
    await work();
  } catch (e) {
    throw new ActionError(e instanceof Error ? e.message : "Could not update this shop.");
  }
}

async function applyForcedStatus(
  tenantId: string,
  status: "trial" | "active" | "past_due" | "suspended" | "cancelled",
) {
  await runDemo(async () => {
    if (status === "active") {
      await demoActivate(tenantId);
      return;
    }
    if (status === "past_due") {
      await demoPastDue(tenantId);
      return;
    }
    if (status === "suspended") {
      await demoSuspend(tenantId);
      return;
    }
    if (status === "cancelled") {
      await demoCancel(tenantId);
      return;
    }
    const admin = createAdminClient();
    const { data } = await admin
      .from("tenants")
      .select("trial_ends_at")
      .eq("id", tenantId)
      .maybeSingle();
    const ends = data?.trial_ends_at ? new Date(data.trial_ends_at) : new Date();
    if (Number.isNaN(ends.getTime()) || ends.getTime() < Date.now()) {
      ends.setTime(Date.now());
      ends.setDate(ends.getDate() + 14);
    }
    const { error } = await admin
      .from("tenants")
      .update({ status: "trial", trial_ends_at: ends.toISOString() })
      .eq("id", tenantId);
    if (error) throw new Error(error.message);
  });
}

export const attachDemoCardAction = staffActionClient(["owner"])
  .metadata({ actionName: "billing.attachDemoCard" })
  .inputSchema(paymentCardSchema)
  .action(async ({ parsedInput, ctx }) => {
    const provider = getBillingProvider();
    if (provider.name !== "demo") {
      throw new ActionError("Card collection is not available. Contact support.");
    }
    await provider.attachDemoCard(ctx.tenant.tenantId, parsedInput);
    revalidatePath("/settings/billing");
    revalidatePath("/onboarding/subscribe");
    return { ok: true as const };
  });

export const activateSubscriptionAction = staffActionClient(["owner"])
  .metadata({ actionName: "billing.activate" })
  .action(async ({ ctx }) => {
    const provider = getBillingProvider();
    await provider.activateAfterTrial(ctx.tenant.tenantId);
    revalidatePath("/", "layout");
    return { ok: true as const };
  });

export const simulateOwnerPaymentAction = staffActionClient(["owner"])
  .metadata({ actionName: "billing.simulatePay" })
  .action(async ({ ctx }) => {
    if (getBillingProvider().name !== "demo") {
      throw new ActionError("Payment simulation is only available in demo billing mode.");
    }
    await getBillingProvider().recordSuccessfulPayment(ctx.tenant.tenantId);
    revalidatePath("/", "layout");
    return { ok: true as const };
  });

/** Platform admin actions */
async function assertPlatform() {
  if (!(await isPlatformStaff())) throw new ActionError("Platform access required.");
}

export const platformExtendTrialAction = authActionClient
  .metadata({ actionName: "platform.extendTrial" })
  .inputSchema(extendTrialSchema)
  .action(async ({ parsedInput }) => {
    await assertPlatform();
    await runDemo(() => demoExtendTrial(parsedInput.tenantId, parsedInput.days));
    revalidatePlatform(parsedInput.tenantId);
    return {
      ok: true as const,
      status: "trial" as const,
      message: `Trial extended by ${parsedInput.days} day(s). Shop is on Trial.`,
    };
  });

export const platformSimulatePaymentAction = authActionClient
  .metadata({ actionName: "platform.simulatePay" })
  .inputSchema(platformTenantActionSchema)
  .action(async ({ parsedInput }) => {
    await assertPlatform();
    await runDemo(() => demoPay(parsedInput.tenantId));
    revalidatePlatform(parsedInput.tenantId);
    return {
      ok: true as const,
      status: "active" as const,
      message: "Payment recorded. This shop is now Active.",
    };
  });

export const platformMarkPastDueAction = authActionClient
  .metadata({ actionName: "platform.pastDue" })
  .inputSchema(platformTenantActionSchema)
  .action(async ({ parsedInput }) => {
    await assertPlatform();
    await runDemo(() => demoPastDue(parsedInput.tenantId));
    revalidatePlatform(parsedInput.tenantId);
    return { ok: true as const, status: "past_due" as const, message: STATUS_MESSAGE.past_due };
  });

export const platformSuspendAction = authActionClient
  .metadata({ actionName: "platform.suspend" })
  .inputSchema(platformTenantActionSchema)
  .action(async ({ parsedInput }) => {
    await assertPlatform();
    await runDemo(() => demoSuspend(parsedInput.tenantId));
    revalidatePlatform(parsedInput.tenantId);
    return { ok: true as const, status: "suspended" as const, message: STATUS_MESSAGE.suspended };
  });

export const platformActivateAction = authActionClient
  .metadata({ actionName: "platform.activate" })
  .inputSchema(platformTenantActionSchema)
  .action(async ({ parsedInput }) => {
    await assertPlatform();
    await runDemo(() => demoActivate(parsedInput.tenantId));
    revalidatePlatform(parsedInput.tenantId);
    return { ok: true as const, status: "active" as const, message: STATUS_MESSAGE.active };
  });

export const platformSetStatusAction = authActionClient
  .metadata({ actionName: "platform.setStatus" })
  .inputSchema(
    platformTenantActionSchema.extend({
      status: z.enum(["trial", "active", "past_due", "suspended", "cancelled"]),
    }),
  )
  .action(async ({ parsedInput }) => {
    await assertPlatform();
    await applyForcedStatus(parsedInput.tenantId, parsedInput.status);
    revalidatePlatform(parsedInput.tenantId);
    return {
      ok: true as const,
      status: parsedInput.status,
      message: STATUS_MESSAGE[parsedInput.status] ?? "Shop status updated.",
    };
  });

export const platformGrantStaffAction = authActionClient
  .metadata({ actionName: "platform.grantStaff" })
  .inputSchema(
    z.object({
      email: z.string().email(),
    }),
  )
  .action(async ({ parsedInput }) => {
    await assertPlatform();
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", parsedInput.email.trim())
      .maybeSingle();
    if (!profile) throw new ActionError("No user with that email. They must sign up first.");
    const { error } = await admin
      .from("profiles")
      .update({ is_platform_staff: true })
      .eq("id", profile.id);
    if (error) throw new ActionError(error.message);
    return { ok: true as const };
  });

export const platformCreateShopMemberAction = authActionClient
  .metadata({ actionName: "platform.createShopMember" })
  .inputSchema(platformCreateShopMemberSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertPlatform();
    const limit = hitRateLimit(`platform-member:${ctx.user.id}`, 20, 15 * 60 * 1000);
    if (!limit.ok) {
      throw new ActionError(`Wait ${limit.retryAfterSec}s before creating another account.`);
    }

    const fullName = fullNameSchema.safeParse(parsedInput.fullName);
    if (!fullName.success) throw new ActionError("Enter the person's name.");
    const emailParsed = emailSchema.safeParse(parsedInput.email);
    if (!emailParsed.success) throw new ActionError("Enter a valid email.");
    const passwordParsed = passwordSchema.safeParse(parsedInput.password);
    if (!passwordParsed.success) {
      throw new ActionError(
        "Password must be at least 8 characters and include a letter and a number.",
      );
    }

    const admin = createAdminClient();
    const email = emailParsed.data;
    const { data: tenant } = await admin
      .from("tenants")
      .select("id, display_name")
      .eq("id", parsedInput.tenantId)
      .maybeSingle();
    if (!tenant) throw new ActionError("Shop not found.");

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();

    let userId = existingProfile?.id ?? null;
    let createdAuth = false;

    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: passwordParsed.data,
        email_confirm: true,
        user_metadata: { full_name: fullName.data },
      });
      if (createErr || !created.user) {
        const { data: after } = await admin
          .from("profiles")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (!after) {
          throw new ActionError(createErr?.message ?? "Could not create that login.");
        }
        userId = after.id;
      } else {
        userId = created.user.id;
        createdAuth = true;
      }
    } else if (parsedInput.resetPasswordIfExists) {
      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
        password: passwordParsed.data,
        email_confirm: true,
      });
      if (pwErr) throw new ActionError(pwErr.message);
    }

    const { error: profileErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName.data,
      },
      { onConflict: "id" },
    );
    if (profileErr) throw new ActionError(profileErr.message);

    const { data: memberships } = await admin
      .from("user_tenants")
      .select("id, role, is_active")
      .eq("user_id", userId)
      .eq("tenant_id", parsedInput.tenantId);

    const now = new Date().toISOString();
    const existingMembership = memberships?.[0];
    if (existingMembership) {
      const { error: memErr } = await admin
        .from("user_tenants")
        .update({
          role: parsedInput.role,
          is_active: true,
          accepted_at: now,
        })
        .eq("id", existingMembership.id);
      if (memErr) throw new ActionError(memErr.message);
    } else {
      const { error: memErr } = await admin.from("user_tenants").insert({
        user_id: userId,
        tenant_id: parsedInput.tenantId,
        role: parsedInput.role,
        is_active: true,
        invited_by: ctx.user.id,
        invited_at: now,
        accepted_at: now,
      });
      if (memErr) throw new ActionError(memErr.message);
    }

    await admin.from("audit_logs").insert({
      tenant_id: parsedInput.tenantId,
      user_id: ctx.user.id,
      action: createdAuth ? "platform.member.create" : "platform.member.attach",
      entity_type: "user_tenants",
      entity_id: userId,
      after: { email, role: parsedInput.role, createdAuth },
    });

    revalidatePlatform(parsedInput.tenantId);
    revalidatePath("/settings/team");

    const mail = await sendStaffAccessEmail({
      email,
      shopName: tenant.display_name,
      role: parsedInput.role,
    }).catch(() => ({ emailed: false as const, via: "none" as const }));

    const roleLabel = parsedInput.role.replace("_", " ");
    const mailNote = mail.emailed
      ? ` A sign-in email was sent to ${email}.`
      : ` Email could not be sent — share the sign-in details with them.`;
    return {
      ok: true as const,
      createdAuth,
      emailed: mail.emailed,
      email,
      role: parsedInput.role,
      message: createdAuth
        ? `${roleLabel} account created.${mailNote}`
        : `${email} is now ${roleLabel} on ${tenant.display_name}.${mailNote}`,
    };
  });

export const platformUpdateShopMemberRoleAction = authActionClient
  .metadata({ actionName: "platform.updateShopMemberRole" })
  .inputSchema(platformUpdateShopMemberRoleSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertPlatform();
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("user_tenants")
      .select("id, role, is_active")
      .eq("tenant_id", parsedInput.tenantId)
      .eq("user_id", parsedInput.userId)
      .maybeSingle();
    if (!row) throw new ActionError("That person is not on this shop.");

    if (row.role === "owner" && parsedInput.role !== "owner") {
      const { count } = await admin
        .from("user_tenants")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", parsedInput.tenantId)
        .eq("role", "owner")
        .eq("is_active", true);
      if ((count ?? 0) <= 1) {
        throw new ActionError("Keep at least one owner on the shop.");
      }
    }

    const { error } = await admin
      .from("user_tenants")
      .update({ role: parsedInput.role, is_active: true })
      .eq("id", row.id);
    if (error) throw new ActionError(error.message);

    await admin.from("audit_logs").insert({
      tenant_id: parsedInput.tenantId,
      user_id: ctx.user.id,
      action: "platform.member.role",
      entity_type: "user_tenants",
      entity_id: parsedInput.userId,
      after: { role: parsedInput.role },
    });
    revalidatePlatform(parsedInput.tenantId);
    return {
      ok: true as const,
      message: `Role is now ${parsedInput.role.replace("_", " ")}.`,
    };
  });

export const platformRemoveShopMemberAction = authActionClient
  .metadata({ actionName: "platform.removeShopMember" })
  .inputSchema(platformShopMemberIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertPlatform();
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("user_tenants")
      .select("id, role, is_active")
      .eq("tenant_id", parsedInput.tenantId)
      .eq("user_id", parsedInput.userId)
      .maybeSingle();
    if (!row) throw new ActionError("That person is not on this shop.");
    if (row.role === "owner") {
      const { count } = await admin
        .from("user_tenants")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", parsedInput.tenantId)
        .eq("role", "owner")
        .eq("is_active", true);
      if ((count ?? 0) <= 1) {
        throw new ActionError("Keep at least one owner on the shop.");
      }
    }

    const { error } = await admin
      .from("user_tenants")
      .update({ is_active: false })
      .eq("id", row.id);
    if (error) throw new ActionError(error.message);

    await admin.from("audit_logs").insert({
      tenant_id: parsedInput.tenantId,
      user_id: ctx.user.id,
      action: "platform.member.remove",
      entity_type: "user_tenants",
      entity_id: parsedInput.userId,
    });
    revalidatePlatform(parsedInput.tenantId);
    return { ok: true as const, message: "Removed from this shop. They can no longer open it." };
  });

export const platformRestoreShopMemberAction = authActionClient
  .metadata({ actionName: "platform.restoreShopMember" })
  .inputSchema(platformShopMemberIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertPlatform();
    const admin = createAdminClient();
    const { error } = await admin
      .from("user_tenants")
      .update({ is_active: true })
      .eq("tenant_id", parsedInput.tenantId)
      .eq("user_id", parsedInput.userId);
    if (error) throw new ActionError(error.message);
    await admin.from("audit_logs").insert({
      tenant_id: parsedInput.tenantId,
      user_id: ctx.user.id,
      action: "platform.member.restore",
      entity_type: "user_tenants",
      entity_id: parsedInput.userId,
    });
    revalidatePlatform(parsedInput.tenantId);
    return { ok: true as const, message: "Restored. They can sign in to this shop again." };
  });

export const platformSendShopMemberEmailAction = authActionClient
  .metadata({ actionName: "platform.sendShopMemberEmail" })
  .inputSchema(platformShopMemberIdSchema)
  .action(async ({ parsedInput }) => {
    await assertPlatform();
    const limit = hitRateLimit(`platform-member-mail:${parsedInput.userId}`, 3, 15 * 60 * 1000);
    if (!limit.ok) {
      throw new ActionError(`Wait ${limit.retryAfterSec}s before sending another email.`);
    }
    const admin = createAdminClient();
    const { data: tenant } = await admin
      .from("tenants")
      .select("display_name")
      .eq("id", parsedInput.tenantId)
      .maybeSingle();
    const { data: membership } = await admin
      .from("user_tenants")
      .select("role")
      .eq("tenant_id", parsedInput.tenantId)
      .eq("user_id", parsedInput.userId)
      .maybeSingle();
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", parsedInput.userId)
      .maybeSingle();
    if (!tenant || !membership || !profile?.email) {
      throw new ActionError("Could not send email for that person.");
    }
    const mail = await sendStaffAccessEmail({
      email: profile.email,
      shopName: tenant.display_name,
      role: membership.role,
    });
    if (!mail.emailed) {
      throw new ActionError(mail.error ?? "Could not send the email. Try again in a minute.");
    }
    return { ok: true as const, message: `Sign-in email sent to ${profile.email}.` };
  });

export const platformSetShopMemberPasswordAction = authActionClient
  .metadata({ actionName: "platform.setShopMemberPassword" })
  .inputSchema(platformSetShopMemberPasswordSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertPlatform();
    const passwordParsed = passwordSchema.safeParse(parsedInput.password);
    if (!passwordParsed.success) {
      throw new ActionError(
        "Password must be at least 8 characters and include a letter and a number.",
      );
    }
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("user_tenants")
      .select("id")
      .eq("tenant_id", parsedInput.tenantId)
      .eq("user_id", parsedInput.userId)
      .maybeSingle();
    if (!row) throw new ActionError("That person is not on this shop.");
    const { error } = await admin.auth.admin.updateUserById(parsedInput.userId, {
      password: passwordParsed.data,
    });
    if (error) throw new ActionError(error.message);
    await admin.from("audit_logs").insert({
      tenant_id: parsedInput.tenantId,
      user_id: ctx.user.id,
      action: "platform.member.password",
      entity_type: "user_tenants",
      entity_id: parsedInput.userId,
    });
    return {
      ok: true as const,
      message: "Password updated. Share it with them yourself — it is not emailed.",
    };
  });
