#!/usr/bin/env node
/**
 * Apply supabase/migrations to a remote project over HTTPS (Management API).
 * Use when `supabase db push` fails (IPv6 unreachable / port 5432 blocked).
 *
 * Requires SUPABASE_ACCESS_TOKEN in .env.local:
 *   https://supabase.com/dashboard/account/tokens
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "dpemvmotwxkrwsqhonhv";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!TOKEN) {
  console.error(`
Missing SUPABASE_ACCESS_TOKEN.

1. Open https://supabase.com/dashboard/account/tokens
2. Generate a token (name: "ShopOS CLI")
3. Add to .env.local:
   SUPABASE_ACCESS_TOKEN=sbp_...
4. Run: npm run db:push:remote

Or paste supabase/combined-migrations.sql in Supabase SQL Editor (one shot).
`);
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}`;

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(typeof body === "object" ? JSON.stringify(body) : body);
  }
  return body;
}

function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function versionFromFilename(filename) {
  return filename.replace(/\.sql$/, "").split("_")[0];
}

async function getAppliedVersions() {
  try {
    const rows = await api("/database/migrations");
    if (!Array.isArray(rows)) return new Set();
    return new Set(rows.map((r) => String(r.version ?? r.name ?? "").split("_")[0]));
  } catch {
    return new Set();
  }
}

async function runQuery(sql) {
  return api("/database/query", {
    method: "POST",
    body: JSON.stringify({ query: sql }),
  });
}

async function main() {
  console.info(`Project: ${PROJECT_REF}`);
  const applied = await getAppliedVersions();
  const files = listMigrationFiles();
  let count = 0;

  for (const file of files) {
    const version = versionFromFilename(file);
    if (applied.has(version)) {
      console.info(`skip  ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    console.info(`apply ${file} ...`);
    await runQuery(sql);
    count++;
    console.info(`ok    ${file}`);
  }

  console.info(count ? `Done: applied ${count} migration(s).` : "Done: all migrations already applied.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
