import { bn } from "@/lib/i18n/bn";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { en } from "@/lib/i18n/en";
import { deepMerge, type DeepPartial } from "@/lib/i18n/merge";
import { overlays } from "@/lib/i18n/overlays";
import { pt } from "@/lib/i18n/pt";

export type Messages = typeof en;

const extra: Record<Exclude<Locale, "en">, DeepPartial<typeof en>> = {
  ...overlays,
  bn,
  pt,
};

export const dictionaries: Record<Locale, Messages> = {
  en,
  es: deepMerge(en, extra.es),
  zh: deepMerge(en, extra.zh),
  hi: deepMerge(en, extra.hi),
  ar: deepMerge(en, extra.ar),
  fr: deepMerge(en, extra.fr),
  ru: deepMerge(en, extra.ru),
  pt: deepMerge(en, extra.pt),
  de: deepMerge(en, extra.de),
  ja: deepMerge(en, extra.ja),
  ko: deepMerge(en, extra.ko),
  it: deepMerge(en, extra.it),
  nl: deepMerge(en, extra.nl),
  tr: deepMerge(en, extra.tr),
  pl: deepMerge(en, extra.pl),
  id: deepMerge(en, extra.id),
  vi: deepMerge(en, extra.vi),
  th: deepMerge(en, extra.th),
  bn: deepMerge(en, extra.bn),
  ur: deepMerge(en, extra.ur),
  uk: deepMerge(en, extra.uk),
  ms: deepMerge(en, extra.ms),
  fa: deepMerge(en, extra.fa),
  sv: deepMerge(en, extra.sv),
};

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function interpolate(template: string, vars?: Record<string, string>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

export function readMessage(
  messages: Messages,
  path: string,
  vars?: Record<string, string>,
): string {
  const parts = path.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  if (typeof current !== "string") return path;
  return interpolate(current, vars);
}
