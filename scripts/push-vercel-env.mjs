#!/usr/bin/env node
/**
 * Push required env vars to the linked Vercel project.
 * Prefers gitignored `.env.cloud.local` so Docker `.env.local` is never uploaded.
 * Run once after: npx vercel login && npx vercel link
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CLOUD_ENV_FILE = path.join(process.cwd(), ".env.cloud.local");
const LOCAL_ENV_FILE = path.join(process.cwd(), ".env.local");
const ENV_FILE = fs.existsSync(CLOUD_ENV_FILE) ? CLOUD_ENV_FILE : LOCAL_ENV_FILE;
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
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_DEFAULT_LOCALE",
  "NEXT_PUBLIC_DEFAULT_CURRENCY",
  "NEXT_PUBLIC_DEFAULT_TIMEZONE",
  "NEXT_PUBLIC_DEFAULT_COUNTRY",
  "EMAIL_FROM",
];

const LIVE_APP_URL = "https://shopos-red.vercel.app";

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

const vercelBin = process.platform === "win32" ? "npx.cmd" : "npx";

function addEnv(name, value, target) {
  console.info(`  + ${name} → ${target}`);
  const typeFlag =
    name.startsWith("NEXT_PUBLIC_") || name === "EMAIL_FROM"
      ? ["--type", "config"]
      : ["--type", "secret"];
  const r = spawnSync(
    vercelBin,
    [
      "vercel",
      "env",
      "add",
      name,
      target,
      "--value",
      value,
      "--force",
      "--yes",
      ...typeFlag,
    ],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!fs.existsSync(ENV_FILE)) {
  console.error("Missing .env.cloud.local (or .env.local)");
  process.exit(1);
}

const env = parseEnvFile(ENV_FILE);
if (/localhost|127\.0\.0\.1/i.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
  console.error(
    "Refusing to push Docker/localhost Supabase keys to Vercel. Put cloud keys in .env.cloud.local.",
  );
  process.exit(1);
}
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
    let nextValue = value;
    if (
      key === "NEXT_PUBLIC_APP_URL" &&
      target === "production" &&
      /localhost|127\.0\.0\.1/i.test(value)
    ) {
      console.warn(
        `  ! ${key} is localhost in the env file. Using ${LIVE_APP_URL} for production.`,
      );
      nextValue = LIVE_APP_URL;
    }
    addEnv(key, nextValue, target);
  }
}

if (env.NEXT_PUBLIC_APP_ENV !== "production") {
  addEnv("NEXT_PUBLIC_APP_ENV", "production", "production");
}
const prodUrl = process.env.VERCEL_PROD_URL?.trim() || LIVE_APP_URL;
addEnv("NEXT_PUBLIC_APP_URL", prodUrl, "production");

console.info("\n[vercel-env] Done. Run: npm run deploy:vercel\n");
