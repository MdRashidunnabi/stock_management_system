/**
 * Creates/updates platform super-admin auth users and sets profiles.is_platform_staff.
 *
 * Credentials are defined in src/db/platform-superadmins.ts (local dev only).
 *
 * Run:
 *   npm run db:seed:platform
 *
 * Optional CLI: grant staff to an extra email without changing the list:
 *   npm run db:seed:platform -- other@example.com
 */
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PLATFORM_SUPERADMINS } from "@/db/platform-superadmins";
import type { Database } from "@/lib/supabase/types";

type AdminClient = SupabaseClient<Database>;

async function findUserByEmail(
  admin: AdminClient,
  email: string,
): Promise<{ id: string; email?: string } | null> {
  let page = 1;
  const normalized = email.trim().toLowerCase();
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (hit) return { id: hit.id, email: hit.email };
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function upsertPlatformSuperAdmin(
  admin: AdminClient,
  entry: (typeof PLATFORM_SUPERADMINS)[number],
): Promise<string> {
  const email = entry.email.trim().toLowerCase();
  const existing = await findUserByEmail(admin, email);

  let userId: string;
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: entry.password,
      email_confirm: true,
      user_metadata: { full_name: entry.fullName },
    });
    if (error) throw error;
    userId = existing.id;
    console.info(`[seed-platform] updated auth user ${email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: entry.password,
      email_confirm: true,
      user_metadata: { full_name: entry.fullName },
    });
    if (error) throw error;
    userId = data.user.id;
    console.info(`[seed-platform] created auth user ${email}`);
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ is_platform_staff: true, full_name: entry.fullName })
    .eq("id", userId);

  if (profileErr) throw profileErr;

  return userId;
}

async function grantStaffByEmail(admin: AdminClient, email: string) {
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", email.trim())
    .maybeSingle();

  if (error || !profile) {
    throw new Error(
      `No profile for ${email}. Add them to platform-superadmins.ts or sign up first.`,
    );
  }

  const { error: updErr } = await admin
    .from("profiles")
    .update({ is_platform_staff: true })
    .eq("id", profile.id);

  if (updErr) throw updErr;
  console.info(`[seed-platform] granted is_platform_staff to ${profile.email}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const admin = createClient<Database>(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.info(`[seed-platform] target = ${url}`);
  console.info(
    `[seed-platform] seeding ${PLATFORM_SUPERADMINS.length} super-admin(s) from platform-superadmins.ts`,
  );

  for (const entry of PLATFORM_SUPERADMINS) {
    await upsertPlatformSuperAdmin(admin, entry);
  }

  const extraEmail = process.argv[2];
  if (
    extraEmail &&
    !PLATFORM_SUPERADMINS.some((e) => e.email.toLowerCase() === extraEmail.toLowerCase())
  ) {
    await grantStaffByEmail(admin, extraEmail);
  }

  console.info("[seed-platform] done. Sign in at /login then open /platform:");
  for (const entry of PLATFORM_SUPERADMINS) {
    console.info(`  ${entry.email}  /  ${entry.password}`);
  }
}

main().catch((e) => {
  console.error("[seed-platform] failed:", e);
  process.exit(1);
});
