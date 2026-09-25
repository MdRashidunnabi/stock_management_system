import Link from "next/link";
import { Store } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AuthNav } from "@/components/auth/auth-nav";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export async function AuthShell({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale();
  const m = getMessages(locale);

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-8">
        <header className="mb-8 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
              <Store className="size-4" />
            </span>
            <span className="text-lg font-bold">{m.brand}</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher compact />
            <AuthNav />
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center">
          <Card className="overflow-hidden">
            <div className="bg-primary h-1" />
            <CardContent className="pt-6">{children}</CardContent>
          </Card>
        </main>

        <footer className="text-muted-foreground mt-8 text-center text-xs">
          {m.auth.agree}{" "}
          <Link
            href="/legal/terms"
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            {m.common.terms}
          </Link>{" "}
          {m.auth.and}{" "}
          <Link
            href="/legal/privacy"
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            {m.common.privacy}
          </Link>
          .
        </footer>
      </div>
    </div>
  );
}
