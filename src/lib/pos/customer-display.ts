export const CUSTOMER_DISPLAY_CHANNEL = "shopos-customer-display-v1";

export type CustomerDisplayPhase =
  | "idle"
  | "cart"
  | "choose"
  | "pay-cash"
  | "pay-card"
  | "change"
  | "thanks";

export type CustomerDisplayLine = {
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type CustomerDisplayState = {
  v: 1;
  tenantId: string;
  shopName: string;
  currency: string;
  locale: string;
  lines: CustomerDisplayLine[];
  subtotal: number;
  vat: number;
  total: number;
  phase: CustomerDisplayPhase;
  given?: number;
  change?: number;
  updatedAt: number;
};

export function emptyCustomerDisplay(partial: {
  tenantId: string;
  shopName: string;
  currency: string;
  locale: string;
}): CustomerDisplayState {
  return {
    v: 1,
    ...partial,
    lines: [],
    subtotal: 0,
    vat: 0,
    total: 0,
    phase: "idle",
    updatedAt: Date.now(),
  };
}

let snapshotRaw: string | null | undefined;
let snapshotValue: CustomerDisplayState | null = null;

export function publishCustomerDisplay(state: CustomerDisplayState): void {
  if (typeof window === "undefined") return;
  const packed = JSON.stringify(state);
  try {
    window.localStorage.setItem(CUSTOMER_DISPLAY_CHANNEL, packed);
    snapshotRaw = packed;
    snapshotValue = state;
  } catch {
    // private mode
  }
  try {
    const ch = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
    ch.postMessage(state);
    ch.close();
  } catch {
    // no BroadcastChannel
  }
}

export function readCustomerDisplay(): CustomerDisplayState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CUSTOMER_DISPLAY_CHANNEL);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomerDisplayState;
    if (parsed?.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Stable snapshot for useSyncExternalStore (same reference if storage is unchanged). */
export function getCustomerDisplaySnapshot(): CustomerDisplayState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CUSTOMER_DISPLAY_CHANNEL);
    if (raw === snapshotRaw) return snapshotValue;
    snapshotRaw = raw;
    snapshotValue = readCustomerDisplay();
    return snapshotValue;
  } catch {
    snapshotRaw = undefined;
    snapshotValue = null;
    return null;
  }
}

export function getCustomerDisplayServerSnapshot(): CustomerDisplayState | null {
  return null;
}

export function subscribeCustomerDisplay(onStoreChange: () => void): () => void {
  let ch: BroadcastChannel | null = null;
  try {
    ch = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
    ch.onmessage = () => onStoreChange();
  } catch {
    ch = null;
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === CUSTOMER_DISPLAY_CHANNEL) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    ch?.close();
    window.removeEventListener("storage", onStorage);
  };
}

export const CUSTOMER_DISPLAY_PATH = "/pos/display";

export function openCustomerDisplayWindow(): Window | null {
  if (typeof window === "undefined") return null;
  return window.open(
    `${CUSTOMER_DISPLAY_PATH}?kiosk=1`,
    "shopos-customer-display",
    "popup=yes,width=1024,height=768",
  );
}
