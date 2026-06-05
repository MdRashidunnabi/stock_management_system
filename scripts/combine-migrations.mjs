#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const OUT = join(ROOT, "supabase", "combined-migrations.sql");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const parts = [
  "-- ShopOS: run once in Supabase SQL Editor if CLI db push cannot connect.",
  "-- https://supabase.com/dashboard/project/dpemvmotwxkrwsqhonhv/sql/new",
  "",
];

for (const file of files) {
  parts.push(`-- >>> ${file}`);
  parts.push(readFileSync(join(MIGRATIONS_DIR, file), "utf8").trim());
  parts.push("");
}

writeFileSync(OUT, parts.join("\n") + "\n", "utf8");
console.info(`Wrote ${OUT} (${files.length} files)`);
