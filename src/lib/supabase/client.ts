import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Supabase client for the browser (Client Components).
 * Uses the public anon key. RLS is enforced server-side.
 *
 * Usage (in a "use client" component):
 *   const supabase = createClient();
 *   const { data, error } = await supabase.from("products").select();
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
