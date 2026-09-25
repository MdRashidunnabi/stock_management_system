"use client";

import { createContext, useCallback, useContext, type Context } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { interpolate, type Messages } from "@/lib/i18n/messages";
import { en } from "@/lib/i18n/en";

type LocaleContextValue = {
  locale: Locale;
  messages: Messages;
  t: (path: string, vars?: Record<string, string>) => string;
};

const globalForLocale = globalThis as typeof globalThis & {
  __shoposLocaleContext?: Context<LocaleContextValue | null>;
};

const LocaleContext: Context<LocaleContextValue | null> =
  globalForLocale.__shoposLocaleContext ?? createContext<LocaleContextValue | null>(null);

if (process.env.NODE_ENV !== "production") {
  globalForLocale.__shoposLocaleContext = LocaleContext;
}

function lookup(messages: Messages, path: string): string {
  const parts = path.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

function translate(messages: Messages, path: string, vars?: Record<string, string>) {
  return interpolate(lookup(messages, path), vars);
}

export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const t = useCallback(
    (path: string, vars?: Record<string, string>) => translate(messages, path, vars),
    [messages],
  );
  return (
    <LocaleContext.Provider value={{ locale, messages, t }}>{children}</LocaleContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  return {
    locale: DEFAULT_LOCALE,
    messages: en,
    t: (path: string, vars?: Record<string, string>) => translate(en, path, vars),
  };
}
