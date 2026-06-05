/**
 * Creates manager / warehouse / accountant demo users (local only).
 * Run: npm run db:seed:roles
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const BRANCH_ID = "00000000-0000-0000-0000-000000000010";

const EXTRA_USERS = [
  {
    email: "manager@demo.shopos.local",
    password: "DemoPass123!",
    fullName: "Niamh Kelly (Manager)",
    role: "manager" as const,
  },
  {
    email: "warehouse@demo.shopos.local",
    password: "DemoPass123!",
    fullName: "Sean Doyle (Warehouse)",
    role: "warehouse" as const,
  },
  {
    email: "accountant@demo.shopos.local",
    password: "DemoPass123!",
    fullName: "Orla Finn (Accountant)",
    role: "accountant" as const,
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;
  if (!url || !serviceRole || !dbUrl) {
    throw new Error("Missing Supabase env vars in .env.local");
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sql = postgres(dbUrl, { onnotice: () => {} });

  try {
    for (const u of EXTRA_USERS) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listErr) throw listErr;

      let userId = list.users.find((row) => row.email === u.email)?.id;
      if (userId) {
        const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.fullName },
        });
        if (updErr) throw updErr;
        console.info(`[seed-roles] updated ${u.email}`);
      } else {
        const { data, error: createErr } = await admin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.fullName },
        });
        if (createErr) throw createErr;
        userId = data.user.id;
        console.info(`[seed-roles] created ${u.email}`);
      }

      if (u.role === "warehouse") {
        await sql`
          insert into public.user_tenants (user_id, tenant_id, role, branch_id, is_active, accepted_at)
          values (${userId}, ${TENANT_ID}, ${u.role}, ${BRANCH_ID}, true, now())
          on conflict do nothing
        `;
      } else {
        await sql`
          insert into public.user_tenants (user_id, tenant_id, role, is_active, accepted_at)
          values (${userId}, ${TENANT_ID}, ${u.role}, true, now())
          on conflict do nothing
        `;
      }
      console.info(`[seed-roles] membership ${u.role} for ${u.email}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.info("[seed-roles] done.");
}

main().catch((e) => {
  console.error("[seed-roles] failed:", e);
  process.exit(1);
});
