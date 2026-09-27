import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { sendAppEmail } from "@/lib/mail/send";
import { liveAuthCallbackUrlFromPastedLink } from "@/lib/auth/email-redirect";

export async function sendStaffAccessEmail(input: {
  email: string;
  shopName: string;
  role: string;
}): Promise<{ emailed: boolean; via: "resend" | "supabase" | "none"; error?: string }> {
  const origin = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const loginUrl = `${origin}/login`;
  const roleLabel = input.role.replaceAll("_", " ");
  const resendConfigured = Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());

  // Only mint a magic link when Resend can deliver it. generateLink counts
  // against GoTrue's email rate limit even when nothing is sent.
  if (resendConfigured) {
    let signInLink = loginUrl;
    try {
      const admin = createAdminClient();
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: input.email,
        options: { redirectTo: `${origin}/auth/callback?next=/dashboard` },
      });
      const hashed = linkData?.properties?.hashed_token;
      const rawLink = linkData?.properties?.action_link ?? "";
      if (hashed && hashed.length >= 20) {
        const dest = new URL("/auth/callback", `${origin}/`);
        dest.searchParams.set("token_hash", hashed);
        dest.searchParams.set("type", "magiclink");
        dest.searchParams.set("next", "/dashboard");
        signInLink = dest.toString();
      } else {
        signInLink =
          liveAuthCallbackUrlFromPastedLink(rawLink, origin, "/dashboard") ??
          (rawLink.startsWith("http") ? rawLink : loginUrl);
      }
    } catch {
      signInLink = loginUrl;
    }

    const subject = `Your ShopOS login for ${input.shopName}`;
    const text = [
      `You were added to ${input.shopName} as ${roleLabel}.`,
      "",
      `Sign in: ${loginUrl}`,
      `One-time sign-in link: ${signInLink}`,
      "",
      "If you were also given a password, you can use that on the sign-in page.",
    ].join("\n");

    const resend = await sendAppEmail({ to: input.email, subject, text });
    if (resend.ok) return { emailed: true, via: "resend" };
  }

  try {
    const recover = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        redirect_to: `${origin}/auth/callback?next=/reset-password`,
      }),
    });
    if (recover.ok) return { emailed: true, via: "supabase" };
    const errText = (await recover.text().catch(() => "")).toLowerCase();
    if (recover.status === 429 || errText.includes("rate")) {
      return {
        emailed: false,
        via: "none",
        error: "Wait a minute, then send the login email again.",
      };
    }
  } catch {
    /* fall through */
  }

  return { emailed: false, via: "none" };
}
