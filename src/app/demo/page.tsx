import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Boxes,
  CreditCard,
  Globe,
  KeyRound,
  ScanLine,
  Shield,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export const metadata: Metadata = {
  title: "Demo",
};

export default async function DemoPage() {
  const locale = await getRequestLocale();
  const m = getMessages(locale);

  const sections = [
    { id: "pos", icon: ScanLine, title: m.demo.pos, body: m.demo.posBody },
    { id: "stock", icon: Boxes, title: m.demo.stock, body: m.demo.stockBody },
    { id: "purchasing", icon: Truck, title: m.demo.buying, body: m.demo.buyingBody },
    { id: "online", icon: Globe, title: m.demo.online, body: m.demo.onlineBody },
    { id: "till", icon: KeyRound, title: m.demo.till, body: m.demo.tillBody },
    { id: "sales", icon: Store, title: m.demo.sales, body: m.demo.salesBody },
    { id: "dashboard", icon: BarChart3, title: m.demo.dashboard, body: m.demo.dashboardBody },
    { id: "billing", icon: CreditCard, title: m.demo.billing, body: m.demo.billingBody },
    { id: "team", icon: Users, title: m.demo.team, body: m.demo.teamBody },
    { id: "platform", icon: Shield, title: m.demo.platform, body: m.demo.platformBody },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6">
      <PublicHeader />
      <div className="mt-6 space-y-2" data-guide="welcome">
        <h1 className="text-3xl font-bold tracking-tight">{m.demo.title}</h1>
        <p className="text-muted-foreground text-sm">{m.demo.sub}</p>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <article
              key={section.id}
              id={section.id}
              data-guide={section.id}
              className="bg-card scroll-mt-24 rounded-2xl border border-black/5 p-4 dark:border-white/10"
            >
              <div className="flex items-center gap-3">
                <Icon className="text-primary size-5 shrink-0" />
                <h2 className="font-semibold">{section.title}</h2>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">{section.body}</p>
            </article>
          );
        })}
      </div>
      <p className="mt-8 text-center">
        <Link href="/signup" className="text-primary text-sm font-semibold">
          {m.home.ctaNew}
        </Link>
      </p>
    </main>
  );
}
