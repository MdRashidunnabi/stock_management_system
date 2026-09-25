export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};

export function deepMerge<T extends Record<string, unknown>>(base: T, overlay: DeepPartial<T>): T {
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(overlay) as (keyof T)[]) {
    const next = overlay[key];
    const prev = base[key];
    if (
      next &&
      typeof next === "object" &&
      !Array.isArray(next) &&
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[key as string] = deepMerge(
        prev as Record<string, unknown>,
        next as DeepPartial<Record<string, unknown>>,
      );
    } else if (next !== undefined) {
      out[key as string] = next;
    }
  }
  return out as T;
}
