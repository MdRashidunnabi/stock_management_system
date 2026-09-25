import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
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

const { data: list, error: listErr } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (listErr) {
  console.error(listErr.message);
  process.exit(1);
}

for (const u of users) {
  const existing = list.users.find((row) => row.email === u.email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.fullName },
    });
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    console.info("updated", u.email);
  } else {
    const { error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.fullName },
    });
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    console.info("created", u.email);
  }
}

console.info("Auth users ready. Next: run 07-demo-shop-greenway.sql in SQL Editor.");
