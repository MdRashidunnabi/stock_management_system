"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { listProductsForPurchasing } from "@/lib/purchasing/orders/actions";
import type { ProductLite } from "@/lib/purchasing/schemas";

export function ProductSearchField({
  product,
  onPick,
}: {
  product: ProductLite | null;
  onPick: (product: ProductLite) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ q: string; hits: ProductLite[] }>({ q: "", hits: [] });
  const hits = result.q === query.trim() ? result.hits : [];

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void listProductsForPurchasing(q, 15)
        .then((rows) => {
          if (!cancelled) setResult({ q, hits: rows });
        })
        .catch(() => {
          if (!cancelled) setResult({ q, hits: [] });
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-1">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, SKU, or barcode"
        aria-label="Search product"
      />
      {product ? (
        <p className="text-xs font-medium">
          {product.sku ? `${product.sku} · ` : ""}
          {product.name}
          {product.barcode ? ` · ${product.barcode}` : ""}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">Type a name or code to find a product.</p>
      )}
      {hits.length > 0 ? (
        <ul className="border-border max-h-40 overflow-auto rounded-md border">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="hover:bg-muted w-full px-2 py-1.5 text-left text-sm"
                onClick={() => {
                  onPick(hit);
                  setQuery("");
                  setResult({ q: "", hits: [] });
                }}
              >
                {hit.sku ? `${hit.sku} · ` : ""}
                {hit.name}
                {hit.barcode ? ` · ${hit.barcode}` : ""}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
