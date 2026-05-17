"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
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

/**
 * Friendly mapping for the small set of Supabase auth errors that should be
 * shown to end-users verbatim. Anything else falls back to a generic message.
 */
function mapAuthError(message: string | undefined): string {
  if (!message) return "Something went wrong. Please try again.";
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email before signing in. Check your inbox.";
  if (m.includes("user already registered"))
    return "An account with this email already exists. Try signing in.";
  if (m.includes("password") && m.includes("at least"))
    return "Password is too weak. Use at least 8 characters with letters and numbers.";
  if (m.includes("rate limit"))
    return "Too many attempts. Please wait a minute before trying again.";
  return message;
}

/**
 * Email + password sign-in.
 * On success: redirects to `next` (if safe) or /dashboard.
 */
export const signInAction = actionClient
  .metadata({ actionName: "auth.signIn" })
  .inputSchema(signInSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsedInput.email,
      password: parsedInput.password,
    });

    if (error) {
      return { ok: false as const, message: mapAuthError(error.message) };
    }

    let target = "/dashboard";
    if (
      parsedInput.next &&
      parsedInput.next.startsWith("/") &&
      !parsedInput.next.startsWith("//")
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
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsedInput.email,
      password: parsedInput.password,
      options: {
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
        data: {
          full_name: parsedInput.fullName,
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
        message: "An account with this email already exists. Try signing in.",
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
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsedInput.email, {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
    });
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
        message: "You don't have access to that shop.",
      };
    }
    await writeActiveTenantCookie(parsedInput.tenantId);
    revalidatePath("/", "layout");
    return { ok: true as const };
  });
