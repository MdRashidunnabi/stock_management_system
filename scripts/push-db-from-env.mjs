import { spawnSync } from "node:child_process";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DIRECT_URL or DATABASE_URL in .env.local");
  process.exit(1);
}

const r = spawnSync(
  "npx",
  ["supabase", "db", "push", "--db-url", url, "--yes", "--dns-resolver", "https"],
  { stdio: "inherit", shell: true },
);
process.exit(r.status ?? 1);
