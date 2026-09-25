"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/i18n/locale-provider";

export function AuthNav() {
  const pathname = usePathname();
  const { t } = useT();
  const onSignup = pathname.startsWith("/signup");

  if (onSignup) {
    return (
      <Link
        href="/login"
        className="text-muted-foreground hover:text-foreground px-2 py-2 text-sm font-medium sm:px-3"
      >
        {t("common.signIn")}
      </Link>
    );
  }

  return (
    <Link
      href="/signup"
      className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap"
    >
      {t("common.createAccount")}
    </Link>
  );
}
