/**
 * USB and wireless barcode scanners almost always act as a keyboard (HID wedge).
 * They type the barcode in a burst, then send Enter. This buffer tells a burst
 * apart from a person typing on the till.
 */

export type HidScanState = {
  buffer: string;
  lastAt: number;
};

export type HidScanOptions = {
  minLength?: number;
  maxIntervalMs?: number;
};

export const HID_SCAN_MIN_LENGTH = 4;
export const HID_SCAN_MAX_INTERVAL_MS = 45;

export function emptyHidScanState(): HidScanState {
  return { buffer: "", lastAt: 0 };
}

export function isHidScanChar(key: string): boolean {
  return key.length === 1 && /[0-9A-Za-z\-._/]/.test(key);
}

export function feedHidScan(
  state: HidScanState,
  key: string,
  now: number,
  options: HidScanOptions = {},
): { state: HidScanState; complete: string | null } {
  const minLength = options.minLength ?? HID_SCAN_MIN_LENGTH;
  const maxIntervalMs = options.maxIntervalMs ?? HID_SCAN_MAX_INTERVAL_MS;

  if (key === "Shift" || key === "Control" || key === "Alt" || key === "Meta") {
    return { state, complete: null };
  }

  if (key === "Enter" || key === "Tab") {
    const code = state.buffer.trim();
    const next = emptyHidScanState();
    next.lastAt = now;
    if (code.length >= minLength) return { state: next, complete: code };
    return { state: next, complete: null };
  }

  if (!isHidScanChar(key)) {
    return { state: { buffer: "", lastAt: now }, complete: null };
  }

  const gap = state.lastAt === 0 ? 0 : now - state.lastAt;
  const buffer = gap > maxIntervalMs ? key : `${state.buffer}${key}`;
  return { state: { buffer, lastAt: now }, complete: null };
}

export function looksLikeBarcode(value: string): boolean {
  const v = value.trim();
  if (v.length < HID_SCAN_MIN_LENGTH || v.length > 64) return false;
  return /^[0-9A-Za-z\-._/]+$/.test(v);
}
