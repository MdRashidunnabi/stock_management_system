import "server-only";

import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";
import { getCurrentUser, getCurrentTenant } from "@/lib/auth/tenant";

/**
 * Safe action client.
 *
 * - Validates input with Zod.
 * - Catches and serialises errors so the client never sees raw stack traces.
 * - Provides three flavours:
 *     actionClient        - public (no auth needed)
 *     authActionClient    - requires an authenticated user
 *     tenantActionClient  - requires an authenticated user + active tenant
 */

class ActionError extends Error {}

export const actionClient = createSafeActionClient({
  defineMetadataSchema() {
    return z.object({
      actionName: z.string().optional(),
    });
  },
  handleServerError(e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[server action error]", e);
    }
    if (e instanceof ActionError) {
      return e.message;
    }
    return "Something went wrong on our side. Please try again.";
  },
});

export const authActionClient = actionClient.use(async ({ next }) => {
  const user = await getCurrentUser();
  if (!user) {
    throw new ActionError("You must be signed in to do that.");
  }
  return next({ ctx: { user } });
});

export const tenantActionClient = authActionClient.use(async ({ next, ctx }) => {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    throw new ActionError("No active shop. Please complete onboarding.");
  }
  return next({ ctx: { ...ctx, tenant } });
});

export { ActionError };
