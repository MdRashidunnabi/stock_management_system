"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { authEmailRedirectTo, originFromForwardedHeaders } from "@/lib/auth/email-redirect";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  setActiveTenantSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/auth/schemas";
import { clearActiveTenantCookie, writeActiveTenantCookie } from "@/lib/auth/cookies";
import { actionClient, authActionClient } from "@/lib/safe-action";
import { getUserTenants } from "@/lib/auth/tenant";
import { getPostAuthRedirectPath } from "@/lib/auth/routing";
import { hitRateLimit } from "@/lib/security/rate-limit";
import { hitAuthEmailLimit } from "@/lib/auth/email-rate-limit";

async function authCallbackRedirect(nextPath: string): Promise<string> {
  const h = await headers();
  const origin = originFromForwardedHeaders({
    origin: h.get("origin"),
    forwardedHost: h.get("x-forwarded-host"),
    forwardedProto: h.get("x-forwarded-proto"),
    host: h.get("host"),
  });
  return authEmailRedirectTo(origin, env.NEXT_PUBLIC_APP_URL, nextPath);
}

/**
 * Friendly mapping for the small set of Supabase auth errors that should be
 * shown to end-users verbatim. Anything else falls back to a generic message.
 */
function mapAuthError(message: string | undefined): string {
  if (!message) return "errors.generic";
  const m = message.toLowerCase();
  if (
    m.includes("fetch failed") ||
    m.includes("enotfound") ||
    m.includes("failed to fetch") ||
    m.includes("network")
  ) {
    return "errors.unreachable";
  }
  if (m.includes("invalid login")) return "errors.badLogin";
  if (m.includes("email not confirmed")) return "errors.emailUnconfirmed";
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "errors.emailTaken";
  }
  if (m.includes("password") && m.includes("at least")) return "errors.passwordWeak";
  if (m.includes("rate limit") || m.includes("only request this after") || m.includes("too many")) {
    return "errors.rateLimit";
  }
  return "errors.generic";
}

/**
 * Email + password sign-in.
 * On success: redirects to `next` (if safe) or /dashboard.
 */
export const signInAction = actionClient
  .metadata({ actionName: "auth.signIn" })
  .inputSchema(signInSchema)
  .action(async ({ parsedInput }) => {
    const gate = hitRateLimit(`signin:${parsedInput.email}`, 10, 15 * 60 * 1000);
    if (!gate.ok) {
      return { ok: false as const, message: "errors.rateLimit" };
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsedInput.email,
      password: parsedInput.password,
    });

    if (error) {
      return { ok: false as const, message: mapAuthError(error.message) };
    }

    let target = await getPostAuthRedirectPath();
    if (
      parsedInput.next &&
      parsedInput.next.startsWith("/") &&
      !parsedInput.next.startsWith("//") &&
      parsedInput.next !== "/dashboard"
    ) {
      target = parsedInput.next;
    }
    revalidatePath("/", "layout");
    redirect(target);
  });

/**
 * Email + password sign-up.
 * Supabase will auto-send a confirmation email (or, in local dev, drop it
 * into Mailpit at http://127.0.0.1:54324). The DB trigger
 * `app.handle_new_auth_user` automatically inserts the matching profile row.
 */
export const signUpAction = actionClient
  .metadata({ actionName: "auth.signUp" })
  .inputSchema(signUpSchema)
  .action(async ({ parsedInput }) => {
    const gate = hitRateLimit(`signup:${parsedInput.email}`, 8, 60 * 60 * 1000);
    if (!gate.ok) {
      return { ok: false as const, message: "errors.rateLimit" };
    }
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsedInput.email,
      password: parsedInput.password,
      options: {
        emailRedirectTo: await authCallbackRedirect("/dashboard"),
        data: {
          full_name: parsedInput.fullName,
          country: parsedInput.country,
          marketing_opt_in: parsedInput.marketingOptIn ?? false,
        },
      },
    });

    if (error) {
      return { ok: false as const, message: mapAuthError(error.message) };
    }

    // If Supabase returned a user with an existing identities array of length 0,
    // it means the email is already registered (Supabase obscures this for
    // security but we can detect it).
    const identities = data.user?.identities ?? [];
    if (data.user && identities.length === 0) {
      return {
        ok: false as const,
        message: "errors.emailTaken",
      };
    }

    // If `Confirm email` is OFF in supabase/config.toml, a session is returned
    // straight away. Otherwise the user must click the link in their email.
    return {
      ok: true as const,
      requiresEmailConfirmation: !data.session,
      email: parsedInput.email,
    };
  });

/**
 * Sign out the current user, drop the active-tenant cookie, send them home.
 */
export const signOutAction = authActionClient
  .metadata({ actionName: "auth.signOut" })
  .action(async () => {
    const supabase = await createClient();
    await supabase.auth.signOut();
    await clearActiveTenantCookie();
    revalidatePath("/", "layout");
    redirect("/login");
  });

/**
 * Send a password-reset email. Always reports success to avoid leaking which
 * emails are registered.
 */
export const requestPasswordResetAction = actionClient
  .metadata({ actionName: "auth.requestPasswordReset" })
  .inputSchema(forgotPasswordSchema)
  .action(async ({ parsedInput }) => {
    const gate = hitAuthEmailLimit("reset", parsedInput.email);
    if (!gate.ok) {
      return {
        ok: false as const,
        message: "errors.resetWait",
        seconds: String(gate.retryAfterSec),
      };
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsedInput.email, {
      redirectTo: await authCallbackRedirect("/reset-password"),
    });
    if (error) {
      const mapped = mapAuthError(error.message);
      if (mapped === "errors.rateLimit") {
        return { ok: false as const, message: "errors.resetRateLimit" };
      }
    }
    return { ok: true as const, email: parsedInput.email };
  });

/**
 * Send a new signup confirmation email. Always reports success so this page
 * cannot be used to probe which addresses are registered.
 */
export const resendSignupEmailAction = actionClient
  .metadata({ actionName: "auth.resendSignupEmail" })
  .inputSchema(forgotPasswordSchema)
  .action(async ({ parsedInput }) => {
    const gate = hitAuthEmailLimit("signup", parsedInput.email);
    if (!gate.ok) {
      return {
        ok: false as const,
        message: "errors.resetWait",
        seconds: String(gate.retryAfterSec),
      };
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsedInput.email,
      options: { emailRedirectTo: await authCallbackRedirect("/dashboard") },
    });
    if (error) {
      const mapped = mapAuthError(error.message);
      if (mapped === "errors.rateLimit") {
        return { ok: false as const, message: mapped };
      }
    }
    return { ok: true as const, email: parsedInput.email };
  });

/**
 * Set the user's password. Used by the password-reset flow once the user has
 * arrived back at /reset-password with an active recovery session (set up by
 * the /auth/callback handler).
 */
export const updatePasswordAction = authActionClient
  .metadata({ actionName: "auth.updatePassword" })
  .inputSchema(resetPasswordSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsedInput.password,
    });
    if (error) {
      return { ok: false as const, message: mapAuthError(error.message) };
    }
    revalidatePath("/", "layout");
    return { ok: true as const };
  });

/**
 * Switch the active tenant for the current user. Verifies that the user
 * actually has an active membership in that tenant before writing the cookie.
 */
export const setActiveTenantAction = authActionClient
  .metadata({ actionName: "auth.setActiveTenant" })
  .inputSchema(setActiveTenantSchema)
  .action(async ({ parsedInput }) => {
    const memberships = await getUserTenants();
    const ok = memberships.some((m) => m.tenantId === parsedInput.tenantId);
    if (!ok) {
      return {
        ok: false as const,
        message: "errors.shopAccess",
      };
    }
    await writeActiveTenantCookie(parsedInput.tenantId);
    revalidatePath("/", "layout");
    return { ok: true as const };
  });
