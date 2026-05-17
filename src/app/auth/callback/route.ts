import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase auth callback (PKCE).
 *
 * Used for:
 *   - email-confirm links sent after sign-up
 *   - password-reset links sent by `auth.resetPasswordForEmail`
 *   - magic links and OAuth (future)
 *
 * Supabase redirects the browser to this URL with a `code` query param.
 * We exchange it for a session cookie, then forward the user to `next`.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorDescription = url.searchParams.get("error_description");
  const requestedNext = url.searchParams.get("next") ?? "/dashboard";

  // only allow same-origin relative redirects
  const next =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";

  if (errorDescription) {
    const u = new URL("/login", url.origin);
    u.searchParams.set("error", errorDescription);
    return NextResponse.redirect(u);
  }

  if (!code) {
    const u = new URL("/login", url.origin);
    u.searchParams.set("error", "Missing authentication code.");
    return NextResponse.redirect(u);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const u = new URL("/login", url.origin);
    u.searchParams.set("error", error.message || "Could not complete sign-in.");
    return NextResponse.redirect(u);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
