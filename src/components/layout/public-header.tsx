"use client";

import Link from "next/link";
import { Store } from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useT } from "@/components/i18n/locale-provider";

export function PublicHeader({ showAuth = true }: { showAuth?: boolean }) {
  const { t } = useT();
  return (
    <header className="flex items-center justify-between gap-3 py-4">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
          <Store className="size-4" />
        </span>
        <span className="text-lg font-bold tracking-tight">{t("brand")}</span>
      </Link>
      <div className="flex items-center gap-1 sm:gap-2">
        <LanguageSwitcher compact />
        {showAuth ? (
          <>
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground px-2 py-2 text-sm font-medium sm:px-3"
            >
              {t("common.signIn")}
            </Link>
            <Link
              href="/signup"
              className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap"
            >
              {t("common.createAccount")}
            </Link>
          </>
        ) : null}
      </div>
    </header>
  );
}
