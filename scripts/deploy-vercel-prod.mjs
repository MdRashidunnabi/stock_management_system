#!/usr/bin/env node
/**
 * Deploy ShopOS to Vercel production from your machine (private repo safe).
 *
 * Prerequisites:
 *   1. npx vercel login   (once — opens browser)
 *   2. Add env vars in Vercel dashboard OR run: npm run vercel:env:push
 *
 * Usage: npm run deploy:vercel
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const vercel = process.platform === "win32" ? "npx.cmd" : "npx";
const args = (sub) => [vercel, "vercel", ...sub];

function run(sub, opts = {}) {
  const r = spawnSync(args(sub)[0], args(sub).slice(1), {
    stdio: "inherit",
    cwd: root,
    ...opts,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.info("\n[deploy] Checking Vercel login…");
const who = spawnSync(vercel, ["vercel", "whoami"], { encoding: "utf8", cwd: root });
if (who.status !== 0 || who.stdout?.includes("Error")) {
  console.error("\n[deploy] Not logged in. Run:  npx vercel login\n");
  process.exit(1);
}
console.info(`[deploy] Logged in as ${who.stdout?.trim()}`);

if (!fs.existsSync(path.join(root, ".vercel", "project.json"))) {
  console.info("[deploy] Linking to Vercel project shop-os…");
  run(["link", "--yes", "--project", "shop-os"]);
}

console.info("[deploy] Deploying to production…\n");
run(["deploy", "--prod", "--yes"]);

console.info("\n[deploy] Done. Share your *.vercel.app URL for demos.\n");
