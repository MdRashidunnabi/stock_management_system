import "server-only";

import { cookies } from "next/headers";

/**
 * Cookie name that stores the user's currently selected tenant id.
 *
 * One auth user may belong to many tenants (e.g. accountant for multiple
 * shops). The middleware/server resolves the active tenant in this order:
 *
 *   1. value of this cookie (if it points at a tenant the user belongs to)
 *   2. the user's first active membership in `public.user_tenants`
 *
 * If neither is available the user is sent to /onboarding.
 */
export const ACTIVE_TENANT_COOKIE = "shopos_active_tenant";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function readActiveTenantCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_TENANT_COOKIE)?.value ?? null;
}

export async function writeActiveTenantCookie(tenantId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}

export async function clearActiveTenantCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ACTIVE_TENANT_COOKIE);
}
