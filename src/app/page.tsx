import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Store, ShoppingCart, BarChart3, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-start justify-center p-6 sm:items-center sm:p-10">
      <div className="mx-auto w-full max-w-4xl space-y-10">
        <div className="space-y-4 text-center">
          <Badge className="rounded-full px-3 py-1 text-xs font-medium">
            ShopOS · Ireland · v0.1.0
          </Badge>
          <h1 className="from-primary via-info to-secondary-foreground bg-gradient-to-r bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            The Retail Operating System for Irish Shops
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-base sm:text-lg">
            POS, stock, suppliers, branches, and online sales in one platform — built for shop
            owners, not accountants.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs">
            <Badge variant="success">EUR</Badge>
            <Badge variant="info">en-IE</Badge>
            <Badge variant="secondary">Europe/Dublin</Badge>
            <Badge variant="warning">VAT ready</Badge>
          </div>
        </div>

        <Separator className="bg-primary/20" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<ShoppingCart className="size-5" />}
            accent="primary"
            title="POS"
            description="Fast tablet POS with scanner, cash drawer, and receipt printer support."
          />
          <FeatureCard
            icon={<Boxes className="size-5" />}
            accent="info"
            title="Stock Ledger"
            description="Every movement tracked — sale, receipt, transfer, return, expiry."
          />
          <FeatureCard
            icon={<Store className="size-5" />}
            accent="secondary"
            title="Multi-branch"
            description="One owner dashboard, many shops, real-time transfers."
          />
          <FeatureCard
            icon={<BarChart3 className="size-5" />}
            accent="warning"
            title="Owner Reports"
            description="Daily profit, cash variance, top movers — on your phone."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/login"
            className="border-primary/20 from-primary/5 hover:border-primary bg-card rounded-xl border bg-gradient-to-br p-5 transition hover:shadow-lg"
          >
            <div className="text-primary text-sm font-semibold">Sign in</div>
            <div className="text-muted-foreground text-xs">Owners, managers, and cashiers</div>
          </Link>
          <Link
            href="/signup"
            className="border-info/25 from-info/5 hover:border-info bg-card rounded-xl border bg-gradient-to-br p-5 transition hover:shadow-lg"
          >
            <div className="text-info text-sm font-semibold">Create an account</div>
            <div className="text-muted-foreground text-xs">30-day pilot, no card required</div>
          </Link>
        </div>

        <div className="border-primary/20 bg-primary/5 text-muted-foreground rounded-xl border border-dashed p-4 text-center text-xs">
          POS, stock, online shop, and Irish VAT — one colourful, professional workspace.
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: "primary" | "info" | "secondary" | "warning";
}) {
  const iconWrap = {
    primary: "bg-primary/15 text-primary",
    info: "bg-info/15 text-info",
    secondary: "bg-secondary text-secondary-foreground",
    warning: "bg-warning/15 text-warning",
  }[accent];

  return (
    <Card className="overflow-hidden">
      <div
        className={`h-1 ${accent === "primary" ? "bg-primary" : accent === "info" ? "bg-info" : accent === "warning" ? "bg-warning" : "bg-secondary"}`}
      />
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={cn("flex size-10 items-center justify-center rounded-lg", iconWrap)}>
            {icon}
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
