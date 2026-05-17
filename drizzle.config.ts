import { defineConfig } from "drizzle-kit";
import { config as loadDotenv } from "dotenv";

// Load env from .env.local for local CLI use.
loadDotenv({ path: ".env.local" });

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL (or DIRECT_URL) must be set in .env.local to run drizzle-kit");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
  // Limit Drizzle to its own schema namespace so it doesn't try to manage
  // Supabase's auth/storage internal tables.
  schemaFilter: ["public"],
  tablesFilter: ["!_prisma_migrations"],
});
