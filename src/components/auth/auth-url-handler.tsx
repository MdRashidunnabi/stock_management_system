"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function hashParams(): URLSearchParams {
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(raw);
}

/**
 * Finishes auth emails that land with a hash fragment (access_token / error)
 * instead of a server-visible ?code= or ?token_hash=.
 */
export function AuthUrlHandler() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = hashParams();
    const type = url.searchParams.get("type") ?? hash.get("type");
    const errorDescription =
      url.searchParams.get("error_description") ?? hash.get("error_description");
    const errorCode = url.searchParams.get("error_code") ?? hash.get("error_code");
    const tokenHash = url.searchParams.get("token_hash");

    if (tokenHash && !url.pathname.startsWith("/auth/callback")) {
      const dest = new URL("/auth/callback", window.location.origin);
      dest.searchParams.set("token_hash", tokenHash);
      if (type) dest.searchParams.set("type", type);
      dest.searchParams.set("next", type === "recovery" ? "/reset-password" : "/dashboard");
      window.location.replace(dest.toString());
      return;
    }

    if (errorDescription || errorCode === "otp_expired" || hash.get("error") === "access_denied") {
      if (url.pathname.startsWith("/login") || url.pathname.startsWith("/forgot-password")) {
        return;
      }
      const dest = new URL(
        type === "recovery" || errorCode === "otp_expired" ? "/forgot-password" : "/login",
        window.location.origin,
      );
      dest.searchParams.set("error", "This sign-in link is invalid or has expired.");
      window.location.replace(dest.toString());
      return;
    }

    if (!hash.get("access_token")) return;

    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      const next = hash.get("type") === "recovery" ? "/reset-password" : "/dashboard";
      window.history.replaceState(null, "", url.pathname);
      window.location.replace(next);
    });
  }, []);

  return null;
}
