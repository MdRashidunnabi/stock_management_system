import "server-only";

import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";
import { getCurrentUser, getCurrentTenant, type AppRole } from "@/lib/auth/tenant";

/**
 * Safe action client.
 *
 * - Validates input with Zod.
 * - Catches and serialises errors so the client never sees raw stack traces.
 * - Provides four flavours:
 *     actionClient        - public (no auth needed)
 *     authActionClient    - requires an authenticated user
 *     tenantActionClient  - requires an authenticated user + active tenant
 *     staffActionClient   - tenant + role in {owner, manager} by default
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

/**
 * Default staff roles for "write" operations on catalog and supplier data.
 * Mirrors the RLS policies in `supabase/migrations/20260517109000_init_rls.sql`:
 *   - categories / brands         -> owner | manager
 *   - products / suppliers / etc. -> owner | manager | warehouse
 *
 * Use `requireRoles(...)` below to override per-action.
 */
export const DEFAULT_STAFF_ROLES: AppRole[] = ["owner", "manager", "warehouse"];

/**
 * staffActionClient(roles?): same as tenantActionClient but additionally
 * checks the caller has one of the allowed roles in the active tenant.
 *
 * Even with this in place, the underlying RLS policies are the source of
 * truth - this just gives users friendlier errors than raw RLS denials.
 */
export function staffActionClient(allowed: AppRole[] = DEFAULT_STAFF_ROLES) {
  return tenantActionClient.use(async ({ next, ctx }) => {
    if (!allowed.includes(ctx.tenant.role)) {
      throw new ActionError("You don't have permission to do that on this shop.");
    }
    return next({ ctx });
  });
}

export { ActionError };
