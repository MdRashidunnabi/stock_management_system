export const LOCALES = [
  "en",
  "es",
  "zh",
  "hi",
  "ar",
  "fr",
  "ru",
  "pt",
  "de",
  "ja",
  "ko",
  "it",
  "nl",
  "tr",
  "pl",
  "id",
  "vi",
  "th",
  "bn",
  "ur",
  "uk",
  "ms",
  "fa",
  "sv",
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "shopos_locale";

export const RTL_LOCALES = new Set<Locale>(["ar", "ur", "fa"]);

export const LOCALE_META: Record<
  Locale,
  {
    nativeLabel: string;
    htmlLang: string;
    englishLabel: string;
    speechLang: string;
    dir: "ltr" | "rtl";
  }
> = {
  en: {
    nativeLabel: "English",
    htmlLang: "en",
    englishLabel: "English",
    speechLang: "en-US",
    dir: "ltr",
  },
  es: {
    nativeLabel: "Español",
    htmlLang: "es",
    englishLabel: "Spanish",
    speechLang: "es-ES",
    dir: "ltr",
  },
  zh: {
    nativeLabel: "中文",
    htmlLang: "zh-CN",
    englishLabel: "Chinese",
    speechLang: "zh-CN",
    dir: "ltr",
  },
  hi: {
    nativeLabel: "हिन्दी",
    htmlLang: "hi",
    englishLabel: "Hindi",
    speechLang: "hi-IN",
    dir: "ltr",
  },
  ar: {
    nativeLabel: "العربية",
    htmlLang: "ar",
    englishLabel: "Arabic",
    speechLang: "ar-SA",
    dir: "rtl",
  },
  fr: {
    nativeLabel: "Français",
    htmlLang: "fr",
    englishLabel: "French",
    speechLang: "fr-FR",
    dir: "ltr",
  },
  ru: {
    nativeLabel: "Русский",
    htmlLang: "ru",
    englishLabel: "Russian",
    speechLang: "ru-RU",
    dir: "ltr",
  },
  pt: {
    nativeLabel: "Português",
    htmlLang: "pt",
    englishLabel: "Portuguese",
    speechLang: "pt-PT",
    dir: "ltr",
  },
  de: {
    nativeLabel: "Deutsch",
    htmlLang: "de",
    englishLabel: "German",
    speechLang: "de-DE",
    dir: "ltr",
  },
  ja: {
    nativeLabel: "日本語",
    htmlLang: "ja",
    englishLabel: "Japanese",
    speechLang: "ja-JP",
    dir: "ltr",
  },
  ko: {
    nativeLabel: "한국어",
    htmlLang: "ko",
    englishLabel: "Korean",
    speechLang: "ko-KR",
    dir: "ltr",
  },
  it: {
    nativeLabel: "Italiano",
    htmlLang: "it",
    englishLabel: "Italian",
    speechLang: "it-IT",
    dir: "ltr",
  },
  nl: {
    nativeLabel: "Nederlands",
    htmlLang: "nl",
    englishLabel: "Dutch",
    speechLang: "nl-NL",
    dir: "ltr",
  },
  tr: {
    nativeLabel: "Türkçe",
    htmlLang: "tr",
    englishLabel: "Turkish",
    speechLang: "tr-TR",
    dir: "ltr",
  },
  pl: {
    nativeLabel: "Polski",
    htmlLang: "pl",
    englishLabel: "Polish",
    speechLang: "pl-PL",
    dir: "ltr",
  },
  id: {
    nativeLabel: "Bahasa Indonesia",
    htmlLang: "id",
    englishLabel: "Indonesian",
    speechLang: "id-ID",
    dir: "ltr",
  },
  vi: {
    nativeLabel: "Tiếng Việt",
    htmlLang: "vi",
    englishLabel: "Vietnamese",
    speechLang: "vi-VN",
    dir: "ltr",
  },
  th: { nativeLabel: "ไทย", htmlLang: "th", englishLabel: "Thai", speechLang: "th-TH", dir: "ltr" },
  bn: {
    nativeLabel: "বাংলা",
    htmlLang: "bn",
    englishLabel: "Bangla",
    speechLang: "bn-BD",
    dir: "ltr",
  },
  ur: {
    nativeLabel: "اردو",
    htmlLang: "ur",
    englishLabel: "Urdu",
    speechLang: "ur-PK",
    dir: "rtl",
  },
  uk: {
    nativeLabel: "Українська",
    htmlLang: "uk",
    englishLabel: "Ukrainian",
    speechLang: "uk-UA",
    dir: "ltr",
  },
  ms: {
    nativeLabel: "Bahasa Melayu",
    htmlLang: "ms",
    englishLabel: "Malay",
    speechLang: "ms-MY",
    dir: "ltr",
  },
  fa: {
    nativeLabel: "فارسی",
    htmlLang: "fa",
    englishLabel: "Persian",
    speechLang: "fa-IR",
    dir: "rtl",
  },
  sv: {
    nativeLabel: "Svenska",
    htmlLang: "sv",
    englishLabel: "Swedish",
    speechLang: "sv-SE",
    dir: "ltr",
  },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return Boolean(value && (LOCALES as readonly string[]).includes(value));
}

export function isRtlLocale(locale: Locale): boolean {
  return RTL_LOCALES.has(locale);
}
