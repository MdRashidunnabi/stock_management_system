const STORAGE_KEY = "shopos_device_id";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
    if (existing.length >= 8) return existing.slice(0, 80);
    const next = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return "";
  }
}
