import { NextResponse, type NextRequest } from "next/server";
import { getPostAuthRedirectPath } from "@/lib/auth/routing";
import { createClient } from "@/lib/supabase/server";
import { publicAuthCallbackError } from "@/lib/security/public-error";
import {
  asEmailOtpType,
  defaultNextForAuthType,
  looksLikeAuthCode,
  looksLikeAuthTokenHash,
} from "@/lib/auth/email-redirect";

/**
 * Supabase auth callback.
 *
 * Emails may arrive as:
 *   - PKCE `?code=` (exchangeCodeForSession)
 *   - OTP `?token_hash=&type=` (verifyOtp) — used by reset / confirm templates
 *   - Hash fragments (`#access_token=` / `#error=`) which the browser keeps;
 *     those are finished by AuthUrlHandler on the next page
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = asEmailOtpType(url.searchParams.get("type"));
  const errorDescription =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const requestedNext = url.searchParams.get("next");

  if (errorDescription) {
    const dest = otpType === "recovery" ? "/forgot-password" : "/login";
    const u = new URL(dest, url.origin);
    u.searchParams.set("error", publicAuthCallbackError(errorDescription));
    return NextResponse.redirect(u);
  }

  const supabase = await createClient();

  if (tokenHash && looksLikeAuthTokenHash(tokenHash) && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    if (error) {
      const dest = otpType === "recovery" ? "/forgot-password" : "/login";
      const u = new URL(dest, url.origin);
      u.searchParams.set("error", publicAuthCallbackError(error.message));
      return NextResponse.redirect(u);
    }
    const next = defaultNextForAuthType(otpType, requestedNext);
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (code && looksLikeAuthCode(code)) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const dest = otpType === "recovery" ? "/forgot-password" : "/login";
      const u = new URL(dest, url.origin);
      u.searchParams.set("error", publicAuthCallbackError(error.message));
      return NextResponse.redirect(u);
    }

    const forced = defaultNextForAuthType(otpType, requestedNext);
    if (otpType === "recovery" || (requestedNext && requestedNext !== "/dashboard")) {
      return NextResponse.redirect(new URL(forced, url.origin));
    }

    const next = await getPostAuthRedirectPath();
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // Implicit hash tokens are not visible to this GET. Send the browser to `/`
  // so AuthUrlHandler can finish the session from `window.location.hash`.
  const fallback = new URL("/", url.origin);
  if (requestedNext) fallback.searchParams.set("next", requestedNext);
  return NextResponse.redirect(fallback);
}
