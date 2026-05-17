"use client";

import { QueryProvider } from "@/components/providers/query-provider";

/**
 * Root client-side provider stack.
 * Add new client-side providers here (theme, feature flags, etc.).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
