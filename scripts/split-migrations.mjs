import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const OUT_DIR = join(ROOT, "supabase", "sql-chunks");
const MAX_BYTES = 70_000;

mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const chunks = [];
let current = [];
let currentBytes = 0;

for (const file of files) {
  const sql = `-- >>> ${file}\n${readFileSync(join(MIGRATIONS_DIR, file), "utf8").trim()}\n`;
  const size = Buffer.byteLength(sql, "utf8");
  if (current.length && currentBytes + size > MAX_BYTES) {
    chunks.push(current);
    current = [];
    currentBytes = 0;
  }
  current.push(sql);
  currentBytes += size;
}
if (current.length) chunks.push(current);

const index = [];
for (let i = 0; i < chunks.length; i++) {
  const name = `${String(i + 1).padStart(2, "0")}.sql`;
  const body =
    `-- ShopOS SQL Editor chunk ${i + 1} of ${chunks.length}. Run in order.\n` +
    `-- Paste ALL of this file, then Run. Wait for success before the next chunk.\n\n` +
    chunks[i].join("\n");
  writeFileSync(join(OUT_DIR, name), body, "utf8");
  index.push(`${name}\t${Buffer.byteLength(body, "utf8")} bytes`);
}

writeFileSync(join(OUT_DIR, "README.txt"), `Run in SQL Editor, in this order:\n${index.join("\n")}\n`, "utf8");
console.info(`Wrote ${chunks.length} chunks to ${OUT_DIR}`);
console.info(index.join("\n"));
