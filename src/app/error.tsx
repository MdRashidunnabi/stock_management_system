"use client";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("errors.crashTitle")}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t("errors.crashBody")}</p>
      <Button type="button" className="mt-6 w-fit" onClick={() => reset()}>
        {t("common.retry")}
      </Button>
    </main>
  );
}
