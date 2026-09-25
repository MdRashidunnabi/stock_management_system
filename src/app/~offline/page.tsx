import Link from "next/link";
import { CloudOff } from "lucide-react";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export const metadata = {
  title: "Offline · ShopOS",
};

export default async function OfflinePage() {
  const locale = await getRequestLocale();
  const m = getMessages(locale);
  return (
    <main className="bg-background text-foreground flex min-h-svh items-center justify-center px-4">
      <div className="border-border bg-card mx-auto max-w-md rounded-xl border p-6 text-center">
        <CloudOff className="text-muted-foreground mx-auto size-10" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{m.offline.title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{m.offline.body}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/pos"
            className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium"
          >
            {m.offline.openPos}
          </Link>
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm"
          >
            {m.offline.tryDash}
          </Link>
        </div>
      </div>
    </main>
  );
}
