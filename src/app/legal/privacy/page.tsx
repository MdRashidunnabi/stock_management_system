import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export const metadata: Metadata = {
  title: "Privacy",
};

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const m = getMessages(locale);
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16">
      <PublicHeader />
      <h1 className="mt-6 text-3xl font-bold tracking-tight">{m.legal.privacyTitle}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{m.legal.updated}</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <p>{m.legal.p1}</p>
        <p>{m.legal.p2}</p>
        <p>{m.legal.p3}</p>
        <p>{m.legal.p4}</p>
        <p>{m.legal.p5}</p>
      </div>
    </main>
  );
}
