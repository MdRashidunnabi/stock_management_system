"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UnavailablePolicy } from "@/lib/storefront/fulfillment";

export interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  imageUrl: string | null;
  qty: number;
  maxQty: number;
  ifUnavailable: UnavailablePolicy;
}

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  /** True after cart is loaded from localStorage (avoids SSR/client badge mismatch). */
  ready: boolean;
  wantedForDate: string | null;
  isAdvance: boolean;
  addLine: (
    line: Omit<CartLine, "qty" | "ifUnavailable"> & {
      qty?: number;
      ifUnavailable?: UnavailablePolicy;
    },
  ) => void;
  setQty: (productId: string, qty: number) => void;
  setLinePolicy: (productId: string, policy: UnavailablePolicy) => void;
  setWantedForDate: (ymd: string | null) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(slug: string) {
  return `shopos-cart-${slug}`;
}
function advanceKey(slug: string) {
  return `shopos-advance-${slug}`;
}

function normalizeLine(raw: Partial<CartLine> & { productId: string }): CartLine | null {
  if (!raw.productId || !raw.name) return null;
  const qty = Number(raw.qty ?? 1);
  const maxQty = Number(raw.maxQty ?? qty);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  return {
    productId: raw.productId,
    name: raw.name,
    unitPrice: Number(raw.unitPrice ?? 0),
    imageUrl: raw.imageUrl ?? null,
    qty,
    maxQty: Number.isFinite(maxQty) ? maxQty : qty,
    ifUnavailable: raw.ifUnavailable === "substitute" ? "substitute" : "omit",
  };
}

export function CartProvider({ shopSlug, children }: { shopSlug: string; children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wantedForDate, setWantedState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(storageKey(shopSlug));
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            setLines(parsed.map(normalizeLine).filter(Boolean) as CartLine[]);
          }
        }
        const adv = localStorage.getItem(advanceKey(shopSlug));
        if (adv && /^\d{4}-\d{2}-\d{2}$/.test(adv)) setWantedState(adv);
      } catch {
        /* ignore */
      }
      setHydrated(true);
    });
  }, [shopSlug]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey(shopSlug), JSON.stringify(lines));
  }, [lines, shopSlug, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (wantedForDate) localStorage.setItem(advanceKey(shopSlug), wantedForDate);
    else localStorage.removeItem(advanceKey(shopSlug));
  }, [wantedForDate, shopSlug, hydrated]);

  const addLine = useCallback(
    (
      line: Omit<CartLine, "qty" | "ifUnavailable"> & {
        qty?: number;
        ifUnavailable?: UnavailablePolicy;
      },
    ) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.productId === line.productId);
        const add = line.qty ?? 1;
        if (existing) {
          const nextQty = Math.min(existing.maxQty, existing.qty + add);
          return prev.map((l) =>
            l.productId === line.productId
              ? {
                  ...l,
                  qty: nextQty,
                  maxQty: line.maxQty,
                  ifUnavailable: line.ifUnavailable ?? l.ifUnavailable,
                }
              : l,
          );
        }
        const qty = Math.min(line.maxQty, add);
        return [
          ...prev,
          {
            ...line,
            qty,
            ifUnavailable: line.ifUnavailable ?? "omit",
          },
        ];
      });
    },
    [],
  );

  const setQty = useCallback((productId: string, qty: number) => {
    setLines(
      (prev) =>
        prev
          .map((l) => {
            if (l.productId !== productId) return l;
            if (qty <= 0) return null;
            return { ...l, qty: Math.min(l.maxQty, qty) };
          })
          .filter(Boolean) as CartLine[],
    );
  }, []);

  const setLinePolicy = useCallback((productId: string, policy: UnavailablePolicy) => {
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, ifUnavailable: policy } : l)),
    );
  }, []);

  const setWantedForDate = useCallback((ymd: string | null) => {
    setWantedState(ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null);
  }, []);

  const removeLine = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setWantedState(null);
  }, []);

  const itemCount = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0), [lines]);

  const value = useMemo(
    () => ({
      lines,
      itemCount,
      subtotal,
      ready: hydrated,
      wantedForDate,
      isAdvance: Boolean(wantedForDate),
      addLine,
      setQty,
      setLinePolicy,
      setWantedForDate,
      removeLine,
      clear,
    }),
    [
      lines,
      itemCount,
      subtotal,
      hydrated,
      wantedForDate,
      addLine,
      setQty,
      setLinePolicy,
      setWantedForDate,
      removeLine,
      clear,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
