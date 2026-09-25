import Link from "next/link";
import { ScanLine, Boxes, Globe, BarChart3 } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export default async function HomePage() {
  const locale = await getRequestLocale();
  const m = getMessages(locale);

  const features = [
    { icon: ScanLine, title: m.home.fPos, hint: m.home.fPosHint },
    { icon: Boxes, title: m.home.fStock, hint: m.home.fStockHint },
    { icon: Globe, title: m.home.fOnline, hint: m.home.fOnlineHint },
    { icon: BarChart3, title: m.home.fReports, hint: m.home.fReportsHint },
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-24 sm:px-6">
      <PublicHeader />

      <section className="flex flex-1 flex-col justify-center py-8 sm:py-12">
        <p className="text-primary text-sm font-semibold tracking-wide">{m.home.kicker}</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {m.home.headline}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-md text-lg">{m.home.sub}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="bg-primary text-primary-foreground shadow-primary/25 rounded-2xl px-6 py-3.5 text-center text-base font-semibold shadow-lg"
          >
            {m.home.ctaNew}
          </Link>
          <Link
            href="/login"
            className="border-border bg-card rounded-xl border px-6 py-3.5 text-center text-base font-semibold"
          >
            {m.home.ctaIn}
          </Link>
          <Link
            href="/demo"
            className="text-muted-foreground hover:text-foreground rounded-xl px-6 py-3.5 text-center text-base font-medium"
          >
            {m.home.ctaDemo}
          </Link>
        </div>

        <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {features.map((item) => (
            <li
              key={item.title}
              className="bg-card rounded-2xl border border-black/5 p-4 shadow-sm dark:border-white/10"
            >
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
                <item.icon className="size-5" aria-hidden />
              </span>
              <p className="mt-3 text-sm font-semibold">{item.title}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{item.hint}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
