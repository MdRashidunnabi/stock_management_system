import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Resolve the currently authenticated user (server-side).
 * Returns null if no session.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Like getCurrentUser but redirects to /login if not authenticated.
 * Use at the top of protected Server Components.
 */
export async function requireUser(redirectTo = "/login"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(redirectTo);
  }
  return user;
}

/**
 * Tenant context object bound to a request.
 * Step 5 will populate this from the user's `user_tenants` row(s).
 */
export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  branchId: string | null;
  role:
    | "owner"
    | "manager"
    | "cashier"
    | "warehouse"
    | "accountant"
    | "delivery"
    | "support_admin"
    | "super_admin";
}

/**
 * Resolve the active tenant for the current user.
 * Step 5 will implement this against a `user_tenants` join. For now it
 * returns null so callers compile.
 */
export async function getCurrentTenant(): Promise<TenantContext | null> {
  // TODO(Step 5): join user_tenants with the current user, with branch context
  // resolved from a cookie or path segment.
  return null;
}

export async function requireTenant(): Promise<TenantContext> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    redirect("/onboarding");
  }
  return tenant;
}
