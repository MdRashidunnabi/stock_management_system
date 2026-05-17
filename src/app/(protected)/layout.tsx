import { redirect } from "next/navigation";
import Link from "next/link";
import { Store } from "lucide-react";
import { getCurrentUser, getCurrentTenant, getUserTenants } from "@/lib/auth/tenant";
import { TenantSwitcher } from "@/components/auth/tenant-switcher";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { TopNav } from "@/components/layout/top-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * Layout for every signed-in route. Centralises:
 *   - auth gate (redirect to /login if not signed in)
 *   - tenant gate (redirect to /onboarding if no membership)
 *   - top bar with brand, tenant switcher, user menu
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const memberships = await getUserTenants();
  const profileInitial =
    user.user_metadata?.full_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="bg-background min-h-dvh">
      <header className="bg-card/40 border-border sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
              <Store className="size-3.5" />
            </span>
            <span className="hidden text-sm sm:inline">ShopOS</span>
          </Link>
          <span className="text-muted-foreground hidden text-xs sm:inline">·</span>
          <TenantSwitcher current={tenant} memberships={memberships} />
        </div>

        <div className="flex items-center gap-3">
          <div className="text-muted-foreground hidden text-xs sm:flex sm:flex-col sm:items-end">
            <span className="text-foreground text-sm leading-none">
              {user.user_metadata?.full_name ?? user.email}
            </span>
            <span className="leading-tight">{tenant.role}</span>
          </div>
          <Avatar className="size-8">
            <AvatarFallback>{profileInitial}</AvatarFallback>
          </Avatar>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <TopNav />
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
