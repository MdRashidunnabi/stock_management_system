import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { getRequestLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export default async function NotFound() {
  const locale = await getRequestLocale();
  const m = getMessages(locale);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      <PublicHeader />
      <div className="flex flex-1 flex-col justify-center py-12">
        <h1 className="text-2xl font-semibold tracking-tight">{m.errors.notFoundTitle}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{m.errors.notFoundBody}</p>
        <Link href="/" className="text-primary mt-6 text-sm font-semibold">
          {m.common.goHome}
        </Link>
      </div>
    </main>
  );
}
