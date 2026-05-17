import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Supabase admin client (server-only).
 *
 * - Uses the SERVICE ROLE key. BYPASSES Row Level Security.
 * - NEVER use this from a Client Component or expose its key to the browser.
 * - Use only for trusted server-side operations: provisioning a new tenant,
 *   running cross-tenant maintenance, or seeding.
 *
 * Usage:
 *   import { createAdminClient } from "@/lib/supabase/admin";
 *   const admin = createAdminClient();
 *   await admin.from("tenants").insert({ ... });
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
