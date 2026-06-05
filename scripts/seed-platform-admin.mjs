#!/usr/bin/env node
/**
 * @deprecated Use npm run db:seed:platform (seed-platform-superadmins.ts).
 * This wrapper keeps the old CLI working.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const extra = process.argv.slice(2);
const result = spawnSync(
  "npx",
  ["tsx", "--env-file=.env.local", "src/db/seed-platform-superadmins.ts", ...extra],
  { cwd: root, stdio: "inherit", shell: true },
);
process.exit(result.status ?? 1);
