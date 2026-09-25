"use client";

import { Suspense } from "react";
import { QueryProvider } from "@/components/providers/query-provider";
import { AssistantPageGuide } from "@/components/assistant/assistant-page-guide";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";

export function Providers({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: Locale;
  messages: Messages;
}) {
  return (
    <LocaleProvider locale={locale} messages={messages}>
      <QueryProvider>
        {children}
        <Suspense fallback={null}>
          <AssistantPageGuide />
        </Suspense>
      </QueryProvider>
    </LocaleProvider>
  );
}
