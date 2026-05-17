#!/usr/bin/env node
/**
 * ShopOS - Step 12 - Database backup script.
 *
 * Wraps `pg_dump` for the local Supabase Postgres (or the production
 * `DATABASE_URL` if set) and writes a timestamped, schema + data dump
 * into ./backups/.
 *
 * By default emits the Postgres custom format (`-Fc`), which:
 *   - is internally compressed,
 *   - is smaller than plain SQL,
 *   - supports `pg_restore --jobs=N` parallel restore,
 *   - lets you pick individual tables to restore.
 *
 * Usage:
 *   node scripts/backup-db.mjs                           # uses local supabase URL
 *   DATABASE_URL=... node scripts/backup-db.mjs          # uses given URL
 *   node scripts/backup-db.mjs --plain                   # writes a gzipped SQL file
 *   node scripts/backup-db.mjs --output /tmp/manual.dump # custom output path
 *
 * Notes:
 *   - The script assumes `pg_dump` is on PATH. Install `postgresql-client`
 *     on Ubuntu, `brew install libpq && brew link --force libpq` on macOS.
 *   - For production the recommended pattern is to run this script from a
 *     scheduled CI job (see `.github/workflows/backup.yml.example`) and
 *     upload the resulting file to private object storage (S3 / B2 / R2).
 *   - The script never reads or writes anything except the dump file. It
 *     doesn't ship the dump anywhere - the caller decides.
 */
import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function parseArgs(argv) {
  const opts = { plain: false, output: null, url: process.env.DATABASE_URL || DEFAULT_URL };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--plain") opts.plain = true;
    else if (a === "--output" || a === "-o") opts.output = argv[++i];
    else if (a === "--url") opts.url = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.info(
        "Usage: node scripts/backup-db.mjs [--plain] [--output <path>] [--url <postgres url>]",
      );
      process.exit(0);
    }
  }
  return opts;
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

async function ensureBackupsDir() {
  const dir = path.join(ROOT, "backups");
  await mkdir(dir, { recursive: true });
  return dir;
}

function buildPgDumpArgs(url, plain) {
  const args = [
    "--no-owner",
    "--no-privileges",
    "--clean",
    "--if-exists",
    "--quote-all-identifiers",
    "--exclude-schema=auth", // Supabase manages this schema for you.
    "--exclude-schema=storage",
    "--exclude-schema=realtime",
    "--exclude-schema=supabase_functions",
    "--exclude-schema=vault",
    "--exclude-schema=graphql",
    "--exclude-schema=graphql_public",
    "--exclude-schema=pgsodium",
    "--exclude-schema=extensions",
  ];
  if (plain) args.push("-Fp");
  else args.push("-Fc");
  args.push(url);
  return args;
}

async function runBackup() {
  const opts = parseArgs(process.argv.slice(2));
  const dir = await ensureBackupsDir();
  const ts = timestamp();
  const ext = opts.plain ? ".sql.gz" : ".dump";
  const outFile = opts.output ?? path.join(dir, `shopos-${ts}${ext}`);

  console.info(`==> Dumping ${redactUrl(opts.url)}`);
  console.info(`==> Output  ${path.relative(ROOT, outFile)}`);

  const args = buildPgDumpArgs(opts.url, opts.plain);

  if (opts.plain) {
    await spawnPipeline(
      [
        ["pg_dump", args],
        ["gzip", ["-9"]],
      ],
      outFile,
    );
  } else {
    // Custom format already compresses internally - write directly to file.
    await spawnSingle("pg_dump", ["-f", outFile, ...args]);
  }

  const stats = await stat(outFile);
  if (stats.size < 256) {
    throw new Error(
      `Backup file ${outFile} is suspiciously small (${stats.size} bytes). Aborting.`,
    );
  }
  console.info(`==> Done. ${stats.size.toLocaleString()} bytes written.`);
  return outFile;
}

function redactUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "<invalid url>";
  }
}

function spawnSingle(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function spawnPipeline(stages, outFile) {
  // Spawn N child processes piped left-to-right, redirecting the final stdout
  // to a file. Implemented with Node streams instead of shell `|` so error
  // codes from any stage propagate.
  const { createWriteStream } = await import("node:fs");
  const out = createWriteStream(outFile);

  return new Promise((resolve, reject) => {
    const procs = [];
    let prev = null;
    for (let i = 0; i < stages.length; i++) {
      const [cmd, args] = stages[i];
      const child = spawn(cmd, args, {
        stdio: [prev ? prev.stdout : "ignore", i === stages.length - 1 ? "pipe" : "pipe", "inherit"],
      });
      procs.push(child);
      child.on("error", reject);
      prev = child;
    }
    const final = procs[procs.length - 1];
    final.stdout.pipe(out);
    out.on("error", reject);
    out.on("finish", () => {
      if (procs.every((p) => p.exitCode === 0)) {
        resolve();
      } else {
        const failed = procs.find((p) => p.exitCode !== 0);
        reject(new Error(`${failed?.spawnfile} exited with code ${failed?.exitCode}`));
      }
    });
  });
}

// Resolve script path through the URL constructor so paths with spaces
// (which import.meta.url percent-encodes) compare equal.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runBackup().catch((err) => {
    console.error("backup-db.mjs failed:", err.message);
    process.exit(1);
  });
}

export { runBackup };
