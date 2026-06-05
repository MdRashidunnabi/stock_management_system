"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, authActionClient, staffActionClient } from "@/lib/safe-action";
import {
  demoCardSchema,
  extendTrialSchema,
  platformTenantActionSchema,
} from "@/lib/billing/schemas";
import { getBillingProvider } from "@/lib/billing/provider";
import { isPlatformStaff } from "@/lib/platform/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const attachDemoCardAction = staffActionClient(["owner"])
  .metadata({ actionName: "billing.attachDemoCard" })
  .inputSchema(demoCardSchema)
  .action(async ({ parsedInput, ctx }) => {
    const provider = getBillingProvider();
    if (provider.name !== "demo") {
      throw new ActionError(
        "Card collection uses Stripe in production. Connect Stripe keys first.",
      );
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
    await getBillingProvider().extendTrial(parsedInput.tenantId, parsedInput.days);
    revalidatePath(`/platform/tenants/${parsedInput.tenantId}`);
    revalidatePath("/platform/tenants");
    return { ok: true as const };
  });

export const platformSimulatePaymentAction = authActionClient
  .metadata({ actionName: "platform.simulatePay" })
  .inputSchema(platformTenantActionSchema)
  .action(async ({ parsedInput }) => {
    await assertPlatform();
    await getBillingProvider().recordSuccessfulPayment(parsedInput.tenantId);
    revalidatePath(`/platform/tenants/${parsedInput.tenantId}`);
    return { ok: true as const };
  });

export const platformMarkPastDueAction = authActionClient
  .metadata({ actionName: "platform.pastDue" })
  .inputSchema(platformTenantActionSchema)
  .action(async ({ parsedInput }) => {
    await assertPlatform();
    await getBillingProvider().markPastDue(parsedInput.tenantId);
    revalidatePath(`/platform/tenants/${parsedInput.tenantId}`);
    return { ok: true as const };
  });

export const platformSuspendAction = authActionClient
  .metadata({ actionName: "platform.suspend" })
  .inputSchema(platformTenantActionSchema)
  .action(async ({ parsedInput }) => {
    await assertPlatform();
    await getBillingProvider().suspend(parsedInput.tenantId);
    revalidatePath(`/platform/tenants/${parsedInput.tenantId}`);
    return { ok: true as const };
  });

export const platformActivateAction = authActionClient
  .metadata({ actionName: "platform.activate" })
  .inputSchema(platformTenantActionSchema)
  .action(async ({ parsedInput }) => {
    await assertPlatform();
    await getBillingProvider().activateAfterTrial(parsedInput.tenantId);
    revalidatePath(`/platform/tenants/${parsedInput.tenantId}`);
    return { ok: true as const };
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
    const admin = createAdminClient();
    const { error } = await admin
      .from("tenants")
      .update({ status: parsedInput.status })
      .eq("id", parsedInput.tenantId);
    if (error) throw new ActionError(error.message);
    revalidatePath(`/platform/tenants/${parsedInput.tenantId}`);
    return { ok: true as const };
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
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", parsedInput.email.trim())
      .maybeSingle();
    if (!profile) throw new ActionError("No user with that email. They must sign up first.");
    const { error } = await supabase
      .from("profiles")
      .update({ is_platform_staff: true })
      .eq("id", profile.id);
    if (error) throw new ActionError(error.message);
    return { ok: true as const };
  });
