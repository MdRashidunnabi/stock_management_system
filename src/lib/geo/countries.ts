/**
 * Shop country catalogue: currency, timezone, and VAT / GST bands.
 *
 * Rates are the common published standard + reduced bands mapped onto ShopOS
 * codes (STD / RED / SEC / LIV / ZER / EXE). They are a starting point for the
 * till — shops must confirm current law with a local accountant.
 */

export const VAT_CODES = ["STD", "RED", "SEC", "LIV", "ZER", "EXE"] as const;
export type VatCode = (typeof VAT_CODES)[number];

export type VatRates = Record<VatCode, number>;

export interface CountryProfile {
  code: string;
  name: string;
  currency: string;
  timezone: string;
  locale: string;
  vatIdLabel: string;
  postalLabel: string;
  regionLabel: string;
  vatRates: VatRates;
}

function rates(std: number, red = 0, sec = 0, liv = 0): VatRates {
  return { STD: std, RED: red, SEC: sec, LIV: liv, ZER: 0, EXE: 0 };
}

/** Static English labels so SSR and the browser never disagree (ICU names differ). */
const ENGLISH_NAMES: Record<string, string> = {
  AE: "United Arab Emirates",
  AR: "Argentina",
  AT: "Austria",
  AU: "Australia",
  BD: "Bangladesh",
  BE: "Belgium",
  BG: "Bulgaria",
  BH: "Bahrain",
  BO: "Bolivia",
  BR: "Brazil",
  CA: "Canada",
  CH: "Switzerland",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  CR: "Costa Rica",
  CY: "Cyprus",
  CZ: "Czechia",
  DE: "Germany",
  DK: "Denmark",
  DO: "Dominican Republic",
  DZ: "Algeria",
  EC: "Ecuador",
  EE: "Estonia",
  EG: "Egypt",
  ES: "Spain",
  ET: "Ethiopia",
  FI: "Finland",
  FR: "France",
  GB: "United Kingdom",
  GE: "Georgia",
  GH: "Ghana",
  GR: "Greece",
  GT: "Guatemala",
  HK: "Hong Kong",
  HR: "Croatia",
  HU: "Hungary",
  ID: "Indonesia",
  IE: "Ireland",
  IL: "Israel",
  IN: "India",
  IQ: "Iraq",
  IT: "Italy",
  JO: "Jordan",
  JP: "Japan",
  KE: "Kenya",
  KR: "South Korea",
  KW: "Kuwait",
  KZ: "Kazakhstan",
  LB: "Lebanon",
  LK: "Sri Lanka",
  LT: "Lithuania",
  LU: "Luxembourg",
  LV: "Latvia",
  MA: "Morocco",
  MX: "Mexico",
  MY: "Malaysia",
  NG: "Nigeria",
  NL: "Netherlands",
  NO: "Norway",
  NP: "Nepal",
  NZ: "New Zealand",
  OM: "Oman",
  PA: "Panama",
  PE: "Peru",
  PH: "Philippines",
  PK: "Pakistan",
  PL: "Poland",
  PT: "Portugal",
  PY: "Paraguay",
  QA: "Qatar",
  RO: "Romania",
  RS: "Serbia",
  RU: "Russia",
  SA: "Saudi Arabia",
  SE: "Sweden",
  SG: "Singapore",
  SI: "Slovenia",
  SK: "Slovakia",
  TH: "Thailand",
  TN: "Tunisia",
  TR: "Turkey",
  TW: "Taiwan",
  TZ: "Tanzania",
  UA: "Ukraine",
  UG: "Uganda",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VE: "Venezuela",
  VN: "Vietnam",
  ZA: "South Africa",
};

type Row = [
  code: string,
  currency: string,
  timezone: string,
  locale: string,
  std: number,
  red: number,
  sec: number,
  liv: number,
  vatIdLabel?: string,
  postalLabel?: string,
  regionLabel?: string,
];

const ROWS: Row[] = [
  ["AE", "AED", "Asia/Dubai", "ar-AE", 0.05, 0, 0, 0, "TRN"],
  ["AR", "ARS", "America/Argentina/Buenos_Aires", "es-AR", 0.21, 0.105, 0, 0, "CUIT"],
  ["AT", "EUR", "Europe/Vienna", "de-AT", 0.2, 0.13, 0.1, 0],
  ["AU", "AUD", "Australia/Sydney", "en-AU", 0.1, 0, 0, 0, "ABN", "Postcode", "State"],
  ["BD", "BDT", "Asia/Dhaka", "bn-BD", 0.15, 0.075, 0.05, 0, "BIN", "Postcode", "District"],
  ["BE", "EUR", "Europe/Brussels", "nl-BE", 0.21, 0.12, 0.06, 0],
  ["BG", "BGN", "Europe/Sofia", "bg-BG", 0.2, 0.09, 0, 0],
  ["BH", "BHD", "Asia/Bahrain", "ar-BH", 0.1, 0, 0, 0, "VAT number"],
  ["BO", "BOB", "America/La_Paz", "es-BO", 0.13, 0, 0, 0, "NIT"],
  ["BR", "BRL", "America/Sao_Paulo", "pt-BR", 0.17, 0.12, 0.07, 0, "CNPJ", "CEP", "State"],
  ["CA", "CAD", "America/Toronto", "en-CA", 0.05, 0, 0, 0, "BN", "Postal code", "Province"],
  ["CH", "CHF", "Europe/Zurich", "de-CH", 0.081, 0.026, 0.038, 0, "UID"],
  ["CL", "CLP", "America/Santiago", "es-CL", 0.19, 0, 0, 0, "RUT"],
  ["CN", "CNY", "Asia/Shanghai", "zh-CN", 0.13, 0.09, 0.06, 0, "Tax ID"],
  ["CO", "COP", "America/Bogota", "es-CO", 0.19, 0.05, 0, 0, "NIT"],
  ["CR", "CRC", "America/Costa_Rica", "es-CR", 0.13, 0.04, 0.02, 0],
  ["CY", "EUR", "Asia/Nicosia", "el-CY", 0.19, 0.09, 0.05, 0],
  ["CZ", "CZK", "Europe/Prague", "cs-CZ", 0.21, 0.12, 0, 0],
  ["DE", "EUR", "Europe/Berlin", "de-DE", 0.19, 0.07, 0, 0],
  ["DK", "DKK", "Europe/Copenhagen", "da-DK", 0.25, 0, 0, 0],
  ["DO", "DOP", "America/Santo_Domingo", "es-DO", 0.18, 0, 0, 0, "RNC"],
  ["DZ", "DZD", "Africa/Algiers", "ar-DZ", 0.19, 0.09, 0, 0],
  ["EC", "USD", "America/Guayaquil", "es-EC", 0.15, 0.05, 0, 0, "RUC"],
  ["EE", "EUR", "Europe/Tallinn", "et-EE", 0.22, 0.09, 0, 0],
  ["EG", "EGP", "Africa/Cairo", "ar-EG", 0.14, 0.05, 0, 0],
  ["ES", "EUR", "Europe/Madrid", "es-ES", 0.21, 0.1, 0.04, 0],
  ["ET", "ETB", "Africa/Addis_Ababa", "am-ET", 0.15, 0, 0, 0],
  ["FI", "EUR", "Europe/Helsinki", "fi-FI", 0.255, 0.14, 0.1, 0],
  ["FR", "EUR", "Europe/Paris", "fr-FR", 0.2, 0.1, 0.055, 0.021],
  ["GB", "GBP", "Europe/London", "en-GB", 0.2, 0.05, 0, 0, "VAT number", "Postcode"],
  ["GE", "GEL", "Asia/Tbilisi", "ka-GE", 0.18, 0, 0, 0],
  ["GH", "GHS", "Africa/Accra", "en-GH", 0.15, 0, 0, 0],
  ["GR", "EUR", "Europe/Athens", "el-GR", 0.24, 0.13, 0.06, 0],
  ["GT", "GTQ", "America/Guatemala", "es-GT", 0.12, 0, 0, 0, "NIT"],
  ["HK", "HKD", "Asia/Hong_Kong", "zh-HK", 0, 0, 0, 0, "BR number"],
  ["HR", "EUR", "Europe/Zagreb", "hr-HR", 0.25, 0.13, 0.05, 0],
  ["HU", "HUF", "Europe/Budapest", "hu-HU", 0.27, 0.18, 0.05, 0],
  ["ID", "IDR", "Asia/Jakarta", "id-ID", 0.11, 0, 0, 0, "NPWP"],
  [
    "IE",
    "EUR",
    "Europe/Dublin",
    "en-IE",
    0.23,
    0.135,
    0.09,
    0.048,
    "VAT number",
    "Eircode",
    "County",
  ],
  ["IL", "ILS", "Asia/Jerusalem", "he-IL", 0.18, 0, 0, 0],
  ["IN", "INR", "Asia/Kolkata", "hi-IN", 0.18, 0.12, 0.05, 0, "GSTIN", "PIN code", "State"],
  ["IQ", "IQD", "Asia/Baghdad", "ar-IQ", 0, 0, 0, 0],
  ["IT", "EUR", "Europe/Rome", "it-IT", 0.22, 0.1, 0.05, 0.04],
  ["JO", "JOD", "Asia/Amman", "ar-JO", 0.16, 0, 0, 0],
  ["JP", "JPY", "Asia/Tokyo", "ja-JP", 0.1, 0.08, 0, 0, "Corporate number"],
  ["KE", "KES", "Africa/Nairobi", "en-KE", 0.16, 0, 0, 0, "PIN"],
  ["KR", "KRW", "Asia/Seoul", "ko-KR", 0.1, 0, 0, 0, "Business number"],
  ["KW", "KWD", "Asia/Kuwait", "ar-KW", 0, 0, 0, 0],
  ["KZ", "KZT", "Asia/Almaty", "kk-KZ", 0.12, 0, 0, 0],
  ["LB", "LBP", "Asia/Beirut", "ar-LB", 0.11, 0, 0, 0],
  ["LK", "LKR", "Asia/Colombo", "si-LK", 0.18, 0, 0, 0],
  ["LT", "EUR", "Europe/Vilnius", "lt-LT", 0.21, 0.09, 0.05, 0],
  ["LU", "EUR", "Europe/Luxembourg", "fr-LU", 0.17, 0.14, 0.08, 0.03],
  ["LV", "EUR", "Europe/Riga", "lv-LV", 0.21, 0.12, 0.05, 0],
  ["MA", "MAD", "Africa/Casablanca", "ar-MA", 0.2, 0.14, 0.1, 0.07],
  ["MX", "MXN", "America/Mexico_City", "es-MX", 0.16, 0.08, 0, 0, "RFC"],
  ["MY", "MYR", "Asia/Kuala_Lumpur", "ms-MY", 0.1, 0.06, 0, 0, "SST number"],
  ["NG", "NGN", "Africa/Lagos", "en-NG", 0.075, 0, 0, 0, "TIN"],
  ["NL", "EUR", "Europe/Amsterdam", "nl-NL", 0.21, 0.09, 0, 0],
  ["NO", "NOK", "Europe/Oslo", "nb-NO", 0.25, 0.15, 0.12, 0],
  ["NP", "NPR", "Asia/Kathmandu", "ne-NP", 0.13, 0, 0, 0],
  ["NZ", "NZD", "Pacific/Auckland", "en-NZ", 0.15, 0, 0, 0, "GST number"],
  ["OM", "OMR", "Asia/Muscat", "ar-OM", 0.05, 0, 0, 0],
  ["PA", "PAB", "America/Panama", "es-PA", 0.07, 0, 0, 0, "RUC"],
  ["PE", "PEN", "America/Lima", "es-PE", 0.18, 0, 0, 0, "RUC"],
  ["PH", "PHP", "Asia/Manila", "fil-PH", 0.12, 0, 0, 0, "TIN"],
  ["PK", "PKR", "Asia/Karachi", "ur-PK", 0.18, 0, 0, 0, "NTN", "Postcode", "Province"],
  ["PL", "PLN", "Europe/Warsaw", "pl-PL", 0.23, 0.08, 0.05, 0],
  ["PT", "EUR", "Europe/Lisbon", "pt-PT", 0.23, 0.13, 0.06, 0],
  ["PY", "PYG", "America/Asuncion", "es-PY", 0.1, 0.05, 0, 0, "RUC"],
  ["QA", "QAR", "Asia/Qatar", "ar-QA", 0, 0, 0, 0],
  ["RO", "RON", "Europe/Bucharest", "ro-RO", 0.19, 0.09, 0.05, 0],
  ["RS", "RSD", "Europe/Belgrade", "sr-RS", 0.2, 0.1, 0, 0],
  ["RU", "RUB", "Europe/Moscow", "ru-RU", 0.2, 0.1, 0, 0, "INN"],
  ["SA", "SAR", "Asia/Riyadh", "ar-SA", 0.15, 0, 0, 0, "VAT number"],
  ["SE", "SEK", "Europe/Stockholm", "sv-SE", 0.25, 0.12, 0.06, 0],
  ["SG", "SGD", "Asia/Singapore", "en-SG", 0.09, 0, 0, 0, "GST number"],
  ["SI", "EUR", "Europe/Ljubljana", "sl-SI", 0.22, 0.095, 0.05, 0],
  ["SK", "EUR", "Europe/Bratislava", "sk-SK", 0.23, 0.19, 0.05, 0],
  ["TH", "THB", "Asia/Bangkok", "th-TH", 0.07, 0, 0, 0, "Tax ID"],
  ["TN", "TND", "Africa/Tunis", "ar-TN", 0.19, 0.13, 0.07, 0],
  ["TR", "TRY", "Europe/Istanbul", "tr-TR", 0.2, 0.1, 0.01, 0],
  ["TW", "TWD", "Asia/Taipei", "zh-TW", 0.05, 0, 0, 0],
  ["TZ", "TZS", "Africa/Dar_es_Salaam", "sw-TZ", 0.18, 0, 0, 0],
  ["UA", "UAH", "Europe/Kyiv", "uk-UA", 0.2, 0.07, 0, 0],
  ["UG", "UGX", "Africa/Kampala", "en-UG", 0.18, 0, 0, 0],
  ["US", "USD", "America/New_York", "en-US", 0, 0, 0, 0, "EIN", "ZIP", "State"],
  ["UY", "UYU", "America/Montevideo", "es-UY", 0.22, 0.1, 0, 0, "RUT"],
  ["UZ", "UZS", "Asia/Tashkent", "uz-UZ", 0.12, 0, 0, 0],
  ["VE", "VES", "America/Caracas", "es-VE", 0.16, 0.08, 0, 0, "RIF"],
  ["VN", "VND", "Asia/Ho_Chi_Minh", "vi-VN", 0.1, 0.08, 0.05, 0, "Tax code"],
  ["ZA", "ZAR", "Africa/Johannesburg", "en-ZA", 0.15, 0, 0, 0, "VAT number"],
];

export const COUNTRIES: CountryProfile[] = ROWS.map(
  ([
    code,
    currency,
    timezone,
    locale,
    std,
    red,
    sec,
    liv,
    vatIdLabel,
    postalLabel,
    regionLabel,
  ]) => ({
    code,
    name: ENGLISH_NAMES[code] ?? code,
    currency,
    timezone,
    locale,
    vatIdLabel: vatIdLabel ?? "VAT / tax ID",
    postalLabel: postalLabel ?? "Postcode",
    regionLabel: regionLabel ?? "Region / state",
    vatRates: rates(std, red, sec, liv),
  }),
).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

export const COUNTRY_BY_CODE: Record<string, CountryProfile> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
);

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code);

export function isCountryCode(value: string | undefined | null): value is string {
  return Boolean(value && COUNTRY_BY_CODE[value]);
}

export function getCountry(code: string | undefined | null): CountryProfile | null {
  if (!code) return null;
  return COUNTRY_BY_CODE[code] ?? null;
}

export const DEFAULT_VAT_RATES: VatRates = rates(0.23, 0.135, 0.09, 0.048);

export function normalizeVatRates(raw: unknown): VatRates {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const num = (key: VatCode, fallback: number) => {
    const v = src[key];
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  return {
    STD: num("STD", DEFAULT_VAT_RATES.STD),
    RED: num("RED", DEFAULT_VAT_RATES.RED),
    SEC: num("SEC", DEFAULT_VAT_RATES.SEC),
    LIV: num("LIV", DEFAULT_VAT_RATES.LIV),
    ZER: num("ZER", 0),
    EXE: num("EXE", 0),
  };
}

export function vatRateMap(ratesIn: VatRates = DEFAULT_VAT_RATES): Record<string, number> {
  return { ...ratesIn };
}

function pct(rate: number): string {
  const n = rate * 100;
  return Number.isInteger(n) ? `${n}%` : `${parseFloat(n.toFixed(2))}%`;
}

export function vatPickerOptions(ratesIn: VatRates = DEFAULT_VAT_RATES) {
  return [
    { code: "STD" as const, label: `Standard (${pct(ratesIn.STD)})`, rate: ratesIn.STD },
    { code: "RED" as const, label: `Reduced (${pct(ratesIn.RED)})`, rate: ratesIn.RED },
    { code: "SEC" as const, label: `Second reduced (${pct(ratesIn.SEC)})`, rate: ratesIn.SEC },
    { code: "LIV" as const, label: `Super-reduced (${pct(ratesIn.LIV)})`, rate: ratesIn.LIV },
    { code: "ZER" as const, label: "Zero (0%)", rate: 0 },
    { code: "EXE" as const, label: "Exempt", rate: 0 },
  ];
}

export function formatVatPercent(rate: number): string {
  return pct(rate);
}
