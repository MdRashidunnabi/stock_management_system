import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { readActiveTenantCookie } from "@/lib/auth/cookies";

/**
 * Roles match the `public.user_role` enum defined in the SQL migrations.
 */
export type AppRole =
  | "owner"
  | "manager"
  | "cashier"
  | "warehouse"
  | "accountant"
  | "delivery"
  | "support_admin"
  | "super_admin";

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: AppRole;
  branchId: string | null;
}

export interface TenantMembership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: AppRole;
  branchId: string | null;
  isActive: boolean;
}

/**
 * Resolve the currently authenticated Supabase user, or null if not signed in.
 * Uses the SSR-aware cookie-bound client so RLS is honoured.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Like getCurrentUser but redirects to /login if not authenticated. Use this
 * at the top of any protected Server Component or Route Handler.
 */
export async function requireUser(redirectTo = "/login"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  return user;
}

/**
 * Return every active tenant membership the current user has, joined with the
 * tenant's slug and display name. Used by the tenant switcher and the active
 * tenant resolver.
 */
export async function getUserTenants(): Promise<TenantMembership[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_tenants")
    .select(
      `
        tenant_id,
        role,
        branch_id,
        is_active,
        tenants:tenant_id (
          slug,
          display_name
        )
      `,
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getUserTenants] supabase error", error);
    return [];
  }

  type Row = {
    tenant_id: string;
    role: AppRole;
    branch_id: string | null;
    is_active: boolean;
    tenants:
      | { slug: string; display_name: string }
      | { slug: string; display_name: string }[]
      | null;
  };

  return ((data as Row[] | null) ?? []).flatMap<TenantMembership>((row) => {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    if (!tenant) return [];
    return [
      {
        tenantId: row.tenant_id,
        tenantSlug: tenant.slug,
        tenantName: tenant.display_name,
        role: row.role,
        branchId: row.branch_id,
        isActive: row.is_active,
      },
    ];
  });
}

/**
 * Resolve the active tenant for the current request:
 *   1. read `shopos_active_tenant` cookie and verify the user is a member;
 *   2. fall back to the user's first membership;
 *   3. return null if the user has no membership at all (will be sent to onboarding).
 */
export async function getCurrentTenant(): Promise<TenantContext | null> {
  const memberships = await getUserTenants();
  if (memberships.length === 0) return null;

  const cookieTenantId = await readActiveTenantCookie();
  const chosen =
    (cookieTenantId && memberships.find((m) => m.tenantId === cookieTenantId)) || memberships[0]!;

  return {
    tenantId: chosen.tenantId,
    tenantSlug: chosen.tenantSlug,
    tenantName: chosen.tenantName,
    role: chosen.role,
    branchId: chosen.branchId,
  };
}

/**
 * Like getCurrentTenant, but redirects to /onboarding if the user has no
 * active membership. Use at the top of any tenant-scoped Server Component.
 */
export async function requireTenant(): Promise<TenantContext> {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  return tenant;
}

/**
 * Authorisation helper: returns true if the current user has any of the
 * requested roles in the active tenant.
 */
export async function hasRole(roles: AppRole[]): Promise<boolean> {
  const tenant = await getCurrentTenant();
  if (!tenant) return false;
  return roles.includes(tenant.role);
}

export async function requireRole(roles: AppRole[]): Promise<TenantContext> {
  const tenant = await requireTenant();
  if (!roles.includes(tenant.role)) redirect("/dashboard?error=forbidden");
  return tenant;
}
