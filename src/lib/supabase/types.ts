/**
 * Auto-generated Supabase types placeholder.
 *
 * Once the database schema is created (Step 4), regenerate this file with:
 *
 *   npx supabase gen types typescript --local > src/lib/supabase/types.ts
 *
 * For now we export a permissive type so Supabase clients compile.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
