import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireUser } from "@/lib/auth/tenant";

/**
 * Platform staff = profiles.is_platform_staff OR super_admin/support_admin on any tenant.
 */
export async function isPlatformStaff(): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_staff")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_platform_staff) return true;

  const { data: roles } = await supabase
    .from("user_tenants")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role", ["super_admin", "support_admin"])
    .limit(1);

  return (roles?.length ?? 0) > 0;
}

export async function requirePlatformStaff() {
  await requireUser();
  const ok = await isPlatformStaff();
  if (!ok) redirect("/dashboard?error=forbidden");
}
