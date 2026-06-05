import "server-only";

import { getCurrentTenant, getUserTenants } from "@/lib/auth/tenant";
import { isPlatformStaff } from "@/lib/platform/auth";
import { getTenantSubscriptionAccess } from "@/lib/billing/queries";

/** Where to send a signed-in user after login or signup. */
export async function getPostAuthRedirectPath(): Promise<string> {
  const platform = await isPlatformStaff();
  const tenant = await getCurrentTenant();
  const memberships = await getUserTenants();

  if (!tenant && memberships.length === 0) {
    return platform ? "/platform" : "/onboarding";
  }

  if (!tenant) return "/onboarding";

  const access = await getTenantSubscriptionAccess(tenant.tenantId);
  if (access?.needsCard && tenant.role === "owner") {
    return "/onboarding/subscribe";
  }
  if (access && !access.canUseApp) {
    return "/billing/locked";
  }
  return "/dashboard";
}
