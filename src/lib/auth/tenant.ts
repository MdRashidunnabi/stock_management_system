import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readActiveTenantCookie } from "@/lib/auth/cookies";
import {
  DEFAULT_VAT_RATES,
  getCountry,
  normalizeVatRates,
  type VatRates,
} from "@/lib/geo/countries";
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "@/lib/constants";

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
  country: string;
  currency: string;
  timezone: string;
  locale: string;
  vatRates: VatRates;
}

export interface TenantMembership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: AppRole;
  branchId: string | null;
  isActive: boolean;
  country: string;
  currency: string;
  timezone: string;
  locale: string;
  vatRates: VatRates;
}

/**
 * Resolve the currently authenticated Supabase user, or null if not signed in.
 * Uses the SSR-aware cookie-bound client so RLS is honoured.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

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
const MEMBERSHIP_SELECT = `
        tenant_id,
        role,
        branch_id,
        is_active,
        tenants:tenant_id (
          slug,
          display_name,
          country,
          currency,
          timezone,
          default_locale,
          vat_rates
        )
      `;

function isRetryableJwtError(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "PGRST301" ||
    code === "PGRST303" ||
    message.includes("issued at future") ||
    message.includes("jwt expired")
  );
}

type MembershipClient = Awaited<ReturnType<typeof createClient>>;

async function fetchActiveMemberships(client: MembershipClient, userId: string) {
  return client
    .from("user_tenants")
    .select(MEMBERSHIP_SELECT)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
}

export const getUserTenants = cache(async (): Promise<TenantMembership[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let { data, error } = await fetchActiveMemberships(supabase, user.id);

  if (error && isRetryableJwtError(error)) {
    await supabase.auth.refreshSession();
    const retried = await fetchActiveMemberships(supabase, user.id);
    data = retried.data;
    error = retried.error;
  }

  if (error && isRetryableJwtError(error)) {
    const fallback = await fetchActiveMemberships(createAdminClient(), user.id);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.warn("[getUserTenants]", error.code ?? "unknown", error.message);
    return [];
  }

  type TenantJoin = {
    slug: string;
    display_name: string;
    country: string | null;
    currency: string | null;
    timezone: string | null;
    default_locale: string | null;
    vat_rates: unknown;
  };

  type Row = {
    tenant_id: string;
    role: AppRole;
    branch_id: string | null;
    is_active: boolean;
    tenants: TenantJoin | TenantJoin[] | null;
  };

  return ((data as Row[] | null) ?? []).flatMap<TenantMembership>((row) => {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    if (!tenant) return [];
    const country = tenant.country ?? "IE";
    const profile = getCountry(country);
    return [
      {
        tenantId: row.tenant_id,
        tenantSlug: tenant.slug,
        tenantName: tenant.display_name,
        role: row.role,
        branchId: row.branch_id,
        isActive: row.is_active,
        country,
        currency: tenant.currency ?? profile?.currency ?? DEFAULT_CURRENCY,
        timezone: tenant.timezone ?? profile?.timezone ?? DEFAULT_TIMEZONE,
        locale: tenant.default_locale ?? profile?.locale ?? "en",
        vatRates: tenant.vat_rates
          ? normalizeVatRates(tenant.vat_rates)
          : (profile?.vatRates ?? DEFAULT_VAT_RATES),
      },
    ];
  });
});

/**
 * Resolve the active tenant for the current request:
 *   1. read `shopos_active_tenant` cookie and verify the user is a member;
 *   2. fall back to the user's first membership;
 *   3. return null if the user has no membership at all (will be sent to onboarding).
 */
export const getCurrentTenant = cache(async (): Promise<TenantContext | null> => {
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
    country: chosen.country,
    currency: chosen.currency,
    timezone: chosen.timezone,
    locale: chosen.locale,
    vatRates: chosen.vatRates,
  };
});

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
