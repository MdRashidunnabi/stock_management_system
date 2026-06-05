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

export interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  imageUrl: string | null;
  qty: number;
  maxQty: number;
}

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  /** True after cart is loaded from localStorage (avoids SSR/client badge mismatch). */
  ready: boolean;
  addLine: (line: Omit<CartLine, "qty"> & { qty?: number }) => void;
  setQty: (productId: string, qty: number) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(slug: string) {
  return `shopos-cart-${slug}`;
}

export function CartProvider({ shopSlug, children }: { shopSlug: string; children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(storageKey(shopSlug));
        if (raw) setLines(JSON.parse(raw) as CartLine[]);
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

  const addLine = useCallback((line: Omit<CartLine, "qty"> & { qty?: number }) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === line.productId);
      const add = line.qty ?? 1;
      if (existing) {
        const nextQty = Math.min(existing.maxQty, existing.qty + add);
        return prev.map((l) =>
          l.productId === line.productId ? { ...l, qty: nextQty, maxQty: line.maxQty } : l,
        );
      }
      const qty = Math.min(line.maxQty, add);
      return [...prev, { ...line, qty }];
    });
  }, []);

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

  const removeLine = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const itemCount = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0), [lines]);

  const value = useMemo(
    () => ({ lines, itemCount, subtotal, ready: hydrated, addLine, setQty, removeLine, clear }),
    [lines, itemCount, subtotal, hydrated, addLine, setQty, removeLine, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
