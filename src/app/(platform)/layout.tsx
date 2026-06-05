import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/tenant";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requirePlatformStaff } from "@/lib/platform/auth";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await requirePlatformStaff();

  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border bg-card sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/platform" className="flex items-center gap-2 font-semibold">
            <Shield className="text-primary size-5" />
            ShopOS Platform
          </Link>
          <nav className="hidden gap-4 text-sm sm:flex">
            <Link href="/platform" className="hover:text-primary">
              Home
            </Link>
            <Link href="/platform/tenants" className="hover:text-primary">
              All shops
            </Link>
            <Link href="/platform/staff" className="hover:text-primary">
              Admin access
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-muted-foreground text-xs hover:underline">
            Shop app
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
