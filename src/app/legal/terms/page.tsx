import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export const metadata: Metadata = {
  title: "Terms",
};

export default async function TermsPage() {
  const locale = await getRequestLocale();
  const m = getMessages(locale);
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16">
      <PublicHeader />
      <h1 className="mt-6 text-3xl font-bold tracking-tight">{m.legal.termsTitle}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{m.legal.updated}</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <p>{m.legal.t1}</p>
        <p>{m.legal.t2}</p>
        <p>
          {m.legal.t3}{" "}
          <Link
            href="/legal/privacy"
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            {m.common.privacy}
          </Link>
          .
        </p>
        <p>{m.legal.t4}</p>
        <p>{m.legal.t5}</p>
      </div>
    </main>
  );
}
