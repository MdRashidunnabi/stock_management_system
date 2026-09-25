/**
 * Prefix formula-like cells so spreadsheet apps treat them as text
 * (CSV / Excel formula injection).
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvSafeCell(value: string): string {
  if (FORMULA_PREFIX.test(value)) return `'${value}`;
  return value;
}

export function csvSafeRow(values: Array<string | number | null | undefined>): string {
  return values
    .map((v) => {
      const raw = v == null ? "" : String(v);
      const safe = csvSafeCell(raw);
      if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
      return safe;
    })
    .join(",");
}
