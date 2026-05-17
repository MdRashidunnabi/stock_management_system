import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Store, ShoppingCart, BarChart3, Boxes } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-start justify-center p-6 sm:items-center sm:p-10">
      <div className="mx-auto w-full max-w-4xl space-y-10">
        <div className="space-y-3 text-center">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
            ShopOS - Ireland - v0.1.0
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            The Retail Operating System for Irish Shops
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-base sm:text-lg">
            POS, stock, suppliers, branches, and online sales in one platform - built for shop
            owners, not accountants.
          </p>
          <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-2 pt-2 text-xs">
            <Badge variant="outline">EUR</Badge>
            <Badge variant="outline">en-IE</Badge>
            <Badge variant="outline">Europe/Dublin</Badge>
            <Badge variant="outline">VAT 23% / 13.5% / 9% / 4.8% / 0%</Badge>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<ShoppingCart className="size-5" />}
            title="POS"
            description="Fast tablet POS with scanner, cash drawer, and receipt printer support."
          />
          <FeatureCard
            icon={<Boxes className="size-5" />}
            title="Stock Ledger"
            description="Every movement tracked - sale, receipt, transfer, return, expiry."
          />
          <FeatureCard
            icon={<Store className="size-5" />}
            title="Multi-branch"
            description="One owner dashboard, many shops, real-time transfers."
          />
          <FeatureCard
            icon={<BarChart3 className="size-5" />}
            title="Owner Reports"
            description="Daily profit, cash variance, top movers - on your phone."
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/login"
            className="border-border bg-card hover:border-primary rounded-lg border p-4 transition hover:shadow-sm"
          >
            <div className="text-sm font-medium">Sign in</div>
            <div className="text-muted-foreground text-xs">Owners, managers, and cashiers</div>
          </Link>
          <Link
            href="/signup"
            className="border-border bg-card hover:border-primary rounded-lg border p-4 transition hover:shadow-sm"
          >
            <div className="text-sm font-medium">Create an account</div>
            <div className="text-muted-foreground text-xs">30-day pilot, no card required</div>
          </Link>
        </div>

        <div className="border-border bg-muted/40 text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
          Status: Step 13 complete (installable PWA via Serwist, offline POS shell, IndexedDB
          catalog cache, queued-sale flusher, idempotent commit_pos_sale so replays never charge
          twice). Next: Step 14 - Vitest + Playwright e2e tests.
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">{icon}</div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
