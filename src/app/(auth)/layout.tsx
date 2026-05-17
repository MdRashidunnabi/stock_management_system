import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { getCurrentUser } from "@/lib/auth/tenant";

/**
 * Layout for routes that signed-OUT users are supposed to use:
 * /login, /signup, /forgot-password.
 *
 * If a user is already signed in, send them to the dashboard. Pages that need
 * the visual shell BUT must allow signed-in users (e.g. /reset-password,
 * /verify-email) sit outside this group and use <AuthShell> directly.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return <AuthShell>{children}</AuthShell>;
}
