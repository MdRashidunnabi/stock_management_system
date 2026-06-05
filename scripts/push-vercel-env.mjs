#!/usr/bin/env node
/**
 * Push required env vars from .env.local to the linked Vercel project.
 * Run once after: npx vercel login && npx vercel link
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ENV_FILE = path.join(process.cwd(), ".env.local");
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "NEXT_PUBLIC_APP_ENV",
];

const OPTIONAL = [
  "NEXT_PUBLIC_DEFAULT_LOCALE",
  "NEXT_PUBLIC_DEFAULT_CURRENCY",
  "NEXT_PUBLIC_DEFAULT_TIMEZONE",
  "NEXT_PUBLIC_DEFAULT_COUNTRY",
  "EMAIL_FROM",
];

function parseEnvFile(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function addEnv(name, value, target) {
  console.info(`  + ${name} → ${target}`);
  const r = spawnSync(
    "npx",
    ["vercel", "env", "add", name, target, "--force"],
    { input: value, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!fs.existsSync(ENV_FILE)) {
  console.error("Missing .env.local");
  process.exit(1);
}

const env = parseEnvFile(ENV_FILE);
const targets = ["production", "preview", "development"];

console.info("[vercel-env] Pushing variables to all environments…\n");
for (const key of [...REQUIRED, ...OPTIONAL]) {
  const value = env[key];
  if (!value) {
    if (REQUIRED.includes(key)) {
      console.error(`Missing required key in .env.local: ${key}`);
      process.exit(1);
    }
    continue;
  }
  for (const target of targets) {
    addEnv(key, value, target);
  }
}

// Production app URL override for production only (optional; Vercel auto-detects if unset)
const prodUrl = process.env.VERCEL_PROD_URL?.trim() || "https://shop-os-gamma.vercel.app";
addEnv("NEXT_PUBLIC_APP_URL", prodUrl, "production");
if (env.NEXT_PUBLIC_APP_ENV !== "production") {
  addEnv("NEXT_PUBLIC_APP_ENV", "production", "production");
}

console.info("\n[vercel-env] Done. Run: npm run deploy:vercel\n");
