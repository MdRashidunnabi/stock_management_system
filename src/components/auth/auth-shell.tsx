import Link from "next/link";
import { Store } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Visual shell shared by every auth-related page (login, signup, forgot,
 * reset, verify-email). Pure presentation - no redirect logic.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl shadow-md">
              <Store className="size-4" />
            </span>
            <span className="from-primary to-info bg-gradient-to-r bg-clip-text text-lg font-bold text-transparent">
              ShopOS
            </span>
          </Link>
          <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            Ireland
          </span>
        </header>

        <main className="flex flex-1 flex-col justify-center">
          <Card className="border-primary/15 overflow-hidden shadow-lg">
            <div className="from-primary/10 via-info/5 to-secondary/30 h-1 bg-gradient-to-r" />
            <CardContent className="pt-6">{children}</CardContent>
          </Card>
        </main>

        <footer className="text-muted-foreground mt-10 text-center text-xs">
          By continuing you agree to our{" "}
          <Link
            href="/legal/terms"
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/legal/privacy"
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </footer>
      </div>
    </div>
  );
}
