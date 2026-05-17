import { customType } from "drizzle-orm/pg-core";

/**
 * Drizzle representation of Postgres `citext` (case-insensitive text).
 *
 * Requires the `citext` extension (created in
 * supabase/migrations/20260517100000_init_extensions_and_helpers.sql).
 */
export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});
