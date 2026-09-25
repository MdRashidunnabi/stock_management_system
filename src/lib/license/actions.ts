"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, authActionClient, staffActionClient } from "@/lib/safe-action";
import { entityIdSchema } from "@/lib/entity-id";
import { isPlatformStaff } from "@/lib/platform/auth";
import { restorePosDevice, revokePosDevice } from "@/lib/license/issue";

const deviceIdSchema = z.string().trim().min(8).max(80);

export const revokeTillAction = staffActionClient(["owner", "manager"])
  .metadata({ actionName: "license.revokeTill" })
  .inputSchema(z.object({ deviceId: deviceIdSchema }))
  .action(async ({ parsedInput, ctx }) => {
    await revokePosDevice(ctx.tenant.tenantId, parsedInput.deviceId);
    revalidatePath("/settings/tills");
    return { ok: true as const };
  });

export const restoreTillAction = staffActionClient(["owner", "manager"])
  .metadata({ actionName: "license.restoreTill" })
  .inputSchema(z.object({ deviceId: deviceIdSchema }))
  .action(async ({ parsedInput, ctx }) => {
    await restorePosDevice(ctx.tenant.tenantId, parsedInput.deviceId);
    revalidatePath("/settings/tills");
    return { ok: true as const };
  });

export const platformRevokeTillAction = authActionClient
  .metadata({ actionName: "platform.revokeTill" })
  .inputSchema(
    z.object({
      tenantId: entityIdSchema,
      deviceId: deviceIdSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    if (!(await isPlatformStaff())) throw new ActionError("Platform access required.");
    await revokePosDevice(parsedInput.tenantId, parsedInput.deviceId);
    revalidatePath(`/platform/tenants/${parsedInput.tenantId}`);
    return { ok: true as const };
  });

export const platformRestoreTillAction = authActionClient
  .metadata({ actionName: "platform.restoreTill" })
  .inputSchema(
    z.object({
      tenantId: entityIdSchema,
      deviceId: deviceIdSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    if (!(await isPlatformStaff())) throw new ActionError("Platform access required.");
    await restorePosDevice(parsedInput.tenantId, parsedInput.deviceId);
    revalidatePath(`/platform/tenants/${parsedInput.tenantId}`);
    return { ok: true as const };
  });
