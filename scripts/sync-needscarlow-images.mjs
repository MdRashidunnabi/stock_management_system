#!/usr/bin/env node
/**
 * Copy Needscarlow demo images into public/ for static serving.
 * Avoids a symlink (copying into public/shops/needscarlow used to loop into itself).
 */
import fs from "node:fs";
import path from "node:path";
import { cp } from "node:fs/promises";

const root = process.cwd();
const src = path.join(root, "Shops", "Needscarlow", "needscarlow_images");
const dest = path.join(root, "public", "shops", "needscarlow");

if (!fs.existsSync(src)) {
  console.info("[sync-needscarlow-images] skip — source missing");
  process.exit(0);
}

if (fs.existsSync(dest)) {
  const stat = fs.lstatSync(dest);
  if (stat.isSymbolicLink()) {
    fs.rmSync(dest);
    console.info("[sync-needscarlow-images] removed symlink at public/shops/needscarlow");
  } else if (stat.isDirectory()) {
    console.info("[sync-needscarlow-images] already synced");
    process.exit(0);
  } else {
    fs.rmSync(dest, { force: true });
  }
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
await cp(src, dest, { recursive: true });
console.info(`[sync-needscarlow-images] synced → ${path.relative(root, dest)}`);
