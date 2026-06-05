import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { Store } from "lucide-react";
import { getCurrentUser, getCurrentTenant, getUserTenants } from "@/lib/auth/tenant";
import { TenantSwitcher } from "@/components/auth/tenant-switcher";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SubscriptionBanner } from "@/components/billing/subscription-banner";
import { DesktopShell } from "@/components/desktop/desktop-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getTenantSubscriptionAccess } from "@/lib/billing/queries";
import { isPlatformStaff } from "@/lib/platform/auth";

const BILLING_ALLOWED_PREFIXES = ["/settings/billing", "/billing/", "/onboarding/subscribe"];

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tenant = await getCurrentTenant();
  if (!tenant) {
    const platform = await isPlatformStaff();
    redirect(platform ? "/platform" : "/onboarding");
  }

  const [memberships, access, platform] = await Promise.all([
    getUserTenants(),
    getTenantSubscriptionAccess(tenant.tenantId),
    isPlatformStaff(),
  ]);

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const onBillingRoute = BILLING_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));

  if (access && !access.canUseApp && !onBillingRoute) {
    redirect("/billing/locked");
  }

  if (
    access?.needsCard &&
    tenant.role === "owner" &&
    !onBillingRoute &&
    !pathname.startsWith("/onboarding")
  ) {
    redirect("/onboarding/subscribe");
  }

  const profileInitial =
    user.user_metadata?.full_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-dvh">
      <DesktopShell />
      <header className="app-header-bar sticky top-0 z-30 flex h-14 items-center justify-between px-4 shadow-md sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <MobileNav role={tenant.role} showPlatform={platform} />
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-white">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/20 text-white shadow-inner ring-1 ring-white/30">
              <Store className="size-4" />
            </span>
            <span className="hidden text-sm tracking-tight sm:inline">ShopOS</span>
          </Link>
          <span className="hidden text-white/50 sm:inline">·</span>
          <TenantSwitcher current={tenant} memberships={memberships} />
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-xs sm:flex sm:flex-col sm:items-end">
            <span className="text-sm leading-none font-medium text-white">
              {user.user_metadata?.full_name ?? user.email}
            </span>
            <span className="leading-tight text-white/70 capitalize">{tenant.role}</span>
          </div>
          <Avatar className="size-8 ring-2 ring-white/30">
            <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
              {profileInitial}
            </AvatarFallback>
          </Avatar>
          <SignOutButton className="text-white hover:bg-white/15 hover:text-white" />
        </div>
      </header>

      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-1">
        <AppSidebar role={tenant.role} showPlatform={platform} />
        <main className="app-page min-w-0 flex-1">
          {access ? <SubscriptionBanner access={access} /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
