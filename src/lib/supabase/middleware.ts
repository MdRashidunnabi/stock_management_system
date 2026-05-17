import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Routes that NEVER require authentication.
 * Add new public routes here (marketing pages, legal, public APIs).
 */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/legal/privacy",
  "/legal/terms",
];

const PUBLIC_PREFIXES = [
  "/api/health",
  "/api/auth/",
  "/auth/",
  "/_next/",
  "/favicon",
  "/icons/",
  "/images/",
  "/static/",
];

/**
 * Routes signed-in users should be redirected AWAY from. Keeps people from
 * landing on /login when they already have a session.
 */
const SIGNED_IN_REDIRECT_AWAY = new Set(["/login", "/signup", "/forgot-password"]);

/**
 * Routes that require a real session AND a recovery/email link to land on.
 * Public users hitting these should be sent to /forgot-password.
 */
const RECOVERY_REQUIRED = new Set(["/reset-password"]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Refreshes the user's Supabase session cookies on every request and routes
 * users based on auth state.
 *
 * This is THE ONLY place that should set Supabase auth cookies during
 * navigation. Server Components must use the read-only `createClient` from
 * `./server.ts`.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: this triggers a token refresh if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 1. Public path + signed in + on a "signed-out only" route -> /dashboard
  if (user && SIGNED_IN_REDIRECT_AWAY.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 2. Recovery-required path with no session -> /forgot-password
  if (!user && RECOVERY_REQUIRED.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/forgot-password";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 3. Protected path with no session -> /login?next=...
  if (!user && !isPublicPath(pathname) && !RECOVERY_REQUIRED.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
