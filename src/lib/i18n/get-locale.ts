import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";

function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const tags = header.split(",").map((part) => part.split(";")[0]?.trim().toLowerCase() ?? "");
  for (const tag of tags) {
    const base = tag.split("-")[0] ?? "";
    if (tag.startsWith("zh")) return "zh";
    if (isLocale(base)) return base;
  }
  return null;
}

export async function getRequestLocale(): Promise<Locale> {
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieValue)) return cookieValue;
  return localeFromAcceptLanguage((await headers()).get("accept-language")) ?? DEFAULT_LOCALE;
}
