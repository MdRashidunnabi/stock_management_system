/**
 * Demo auth users seed (LOCAL DEVELOPMENT ONLY).
 *
 * Run with:
 *   npm run db:seed:auth
 *
 * This script is idempotent. It:
 *  1. Creates two confirmed auth users:
 *       owner@demo.shopos.local   / DemoPass123!
 *       cashier@demo.shopos.local / DemoPass123!
 *  2. Re-runs `supabase/seed.sql` so the user_tenants memberships are
 *     attached to the freshly-created auth users.
 *
 * It uses the SERVICE ROLE key (loaded from .env.local) to call the Auth
 * Admin API. Never run this against production.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

interface DemoUser {
  email: string;
  password: string;
  fullName: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    email: "owner@demo.shopos.local",
    password: "DemoPass123!",
    fullName: "Aoife O'Reilly (Owner)",
  },
  {
    email: "cashier@demo.shopos.local",
    password: "DemoPass123!",
    fullName: "Liam Byrne (Cashier)",
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;

  if (!url || !serviceRole) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Did you run `npm run supabase:start` and check .env.local?",
    );
  }
  if (!dbUrl) {
    throw new Error("Missing DATABASE_URL.");
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.info(`[seed-auth] target = ${url}`);

  for (const u of DEMO_USERS) {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw listErr;

    const existing = list.users.find((row) => row.email === u.email);
    if (existing) {
      // Make sure password and email-confirmed flag are aligned with the seed.
      const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });
      if (updErr) throw updErr;
      console.info(`[seed-auth] updated ${u.email}`);
    } else {
      const { error: createErr } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });
      if (createErr) throw createErr;
      console.info(`[seed-auth] created ${u.email}`);
    }
  }

  // Re-run the SQL seed so user_tenants rows exist for the just-created users.
  const seedPath = path.join(process.cwd(), "supabase", "seed.sql");
  const seedSql = readFileSync(seedPath, "utf8");
  const sql = postgres(dbUrl, { onnotice: () => {} });
  try {
    await sql.unsafe(seedSql);
    console.info(`[seed-auth] re-applied ${seedPath} (memberships attached)`);
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.info("[seed-auth] done. Sign in with:");
  for (const u of DEMO_USERS) {
    console.info(`  ${u.email}  /  ${u.password}`);
  }
}

main().catch((e) => {
  console.error("[seed-auth] failed:", e);
  process.exit(1);
});
