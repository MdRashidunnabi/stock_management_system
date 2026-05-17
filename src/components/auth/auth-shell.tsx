import Link from "next/link";
import { Store } from "lucide-react";

/**
 * Visual shell shared by every auth-related page (login, signup, forgot,
 * reset, verify-email). Pure presentation - no redirect logic.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
              <Store className="size-4" />
            </span>
            <span className="text-base">ShopOS</span>
          </Link>
          <span className="text-muted-foreground text-xs">Ireland</span>
        </header>

        <main className="flex flex-1 flex-col justify-center">{children}</main>

        <footer className="text-muted-foreground mt-10 text-center text-xs">
          By continuing you agree to our{" "}
          <Link
            href="/legal/terms"
            className="hover:text-foreground underline-offset-2 hover:underline"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/legal/privacy"
            className="hover:text-foreground underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </footer>
      </div>
    </div>
  );
}
