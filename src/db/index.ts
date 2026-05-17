import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "@/db/schema";

/**
 * Drizzle client for direct Postgres access.
 *
 * - Server-only (never import from a client component).
 * - Uses the Supabase Postgres connection string.
 * - Pooled in dev to avoid exhausting connections under HMR; one client per
 *   Node process in production.
 *
 * Most application code should prefer the Supabase client (which respects RLS).
 * Drizzle is used for:
 *   - Migrations (drizzle-kit)
 *   - Privileged server-side admin tasks
 *   - Heavy reads where SQL is clearer than the supabase-js builder
 */

const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

const connectionString = env.DATABASE_URL;

const client =
  globalForDb.client ??
  postgres(connectionString, {
    max: env.NEXT_PUBLIC_APP_ENV === "production" ? 10 : 1,
    prepare: false, // Supabase Pooler is in transaction mode by default.
    idle_timeout: 30,
    connect_timeout: 10,
  });

if (env.NEXT_PUBLIC_APP_ENV !== "production") {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema, logger: env.NEXT_PUBLIC_APP_ENV === "development" });

export type DB = typeof db;
