import Link from "next/link";
import { CloudOff } from "lucide-react";

export const metadata = {
  title: "Offline · ShopOS",
};

/**
 * Default fallback page rendered by the service worker when the user is
 * offline and visiting an uncached route. The POS terminal itself is
 * cached on first visit, so this is mostly a safety net for deep links
 * the cashier might have followed before going offline.
 */
export default function OfflinePage() {
  return (
    <main className="bg-background text-foreground flex min-h-svh items-center justify-center px-4">
      <div className="border-border bg-card mx-auto max-w-md rounded-xl border p-6 text-center">
        <CloudOff className="text-muted-foreground mx-auto size-10" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">You are offline</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          ShopOS still works for the cashier - sales taken now will be queued on this device and
          posted automatically the moment your shop&apos;s connection is restored.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/pos"
            className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium"
          >
            Open the POS terminal
          </Link>
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm"
          >
            Try the dashboard (online only)
          </Link>
        </div>
      </div>
    </main>
  );
}
