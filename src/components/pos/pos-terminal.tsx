"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  Loader2,
  Minus,
  Plus,
  Receipt,
  Search,
  Tag,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSafeActionData, getSafeActionError } from "@/lib/parse-safe-action-result";
import { cn, formatEuro } from "@/lib/utils";
import { commitPosSaleAction, searchProductsForPos } from "@/lib/pos/actions";
import type { CartLine, ProductSearchResult } from "@/lib/pos/schemas";
import { OneOffSaleDialog } from "@/components/pos/one-off-sale-dialog";
import { PosPaymentDialog } from "@/components/pos/pos-payment-dialog";
import { PosOfflineStatus } from "@/components/pos/offline-status";
import { useOfflinePos } from "@/lib/pos/offline/use-offline-pos";
import type { OfflineCatalogRow } from "@/lib/pos/offline/storage";
import { entityIdSchema } from "@/lib/entity-id";
import {
  clearPosCart as clearPersistedPosCart,
  loadPosCart,
  savePosCart,
} from "@/lib/pos/cart-session-storage";
import { cartLineToCommitItem, isPosMiscLine, POS_MISC_SKU } from "@/lib/pos/misc-product";
import { computeCartTotals, VAT_RATES } from "@/lib/pos/totals";

function isValidBranchId(id: string): boolean {
  return entityIdSchema.safeParse(id).success;
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface Props {
  tenantId: string;
  branches: BranchOption[];
  defaultBranchId: string | null;
}

export function PosTerminal({ tenantId, branches, defaultBranchId }: Props) {
  const fallbackBranchId = defaultBranchId ?? branches[0]?.id ?? "";
  const [branchId, setBranchId] = useState<string>(fallbackBranchId);

  const activeBranchId = (() => {
    if (isValidBranchId(branchId)) return branchId;
    if (defaultBranchId && isValidBranchId(defaultBranchId)) return defaultBranchId;
    const fromList = branches.find((b) => isValidBranchId(b.id))?.id;
    return fromList ?? "";
  })();

  // Keep React state aligned with the branch dropdown after hydration / fast refresh.
  useEffect(() => {
    if (isValidBranchId(branchId)) return;
    if (!fallbackBranchId) return;
    queueMicrotask(() => setBranchId(fallbackBranchId));
  }, [branchId, fallbackBranchId]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const skipCartPersistRef = useRef(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [searchPending, startSearch] = useTransition();
  const [showPayment, setShowPayment] = useState(false);
  const [showOneOff, setShowOneOff] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [committing, startCommit] = useTransition();
  const [flushing, setFlushing] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const offline = useOfflinePos({ tenantId, branchId: activeBranchId });
  const { online, pendingCount, cachedCount, upsertCatalog, offlineSearch, enqueueSale, flushNow } =
    offline;

  /* ---------------------------- Totals math ---------------------------- */

  const totals = useMemo(() => computeCartTotals(cart), [cart]);

  /* Restore cart when returning from Products / other pages (same tab). */
  useEffect(() => {
    if (!isValidBranchId(activeBranchId)) {
      queueMicrotask(() => setCart([]));
      return;
    }
    skipCartPersistRef.current = true;
    queueMicrotask(() => {
      setCart(loadPosCart(tenantId, activeBranchId));
      skipCartPersistRef.current = false;
    });
  }, [tenantId, activeBranchId]);

  useEffect(() => {
    if (skipCartPersistRef.current) return;
    if (!isValidBranchId(activeBranchId)) return;
    savePosCart(tenantId, activeBranchId, cart);
  }, [cart, tenantId, activeBranchId]);

  /* ------------------------------ Search ------------------------------ */

  const runSearch = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      startSearch(async () => {
        if (trimmed.length < 1) {
          setResults([]);
          setSearchHint(null);
          return;
        }

        if (!isValidBranchId(activeBranchId)) {
          setResults([]);
          setSearchHint("Pick a branch before searching.");
          return;
        }

        setSearchHint(null);

        // Always try the live catalog first — server actions work even when
        // navigator.onLine is false (headless browsers, flaky Wi‑Fi).
        const res = await searchProductsForPos({ branchId: activeBranchId, query: trimmed });
        const err = getSafeActionError(res);
        const data = getSafeActionData<{ ok: true; rows: ProductSearchResult[] }>(res);

        if (data?.rows.length) {
          setResults(data.rows);
          setSearchHint(null);
          const rows: OfflineCatalogRow[] = data.rows.map((p) => ({
            id: p.id,
            tenantId,
            branchId: activeBranchId,
            name: p.name,
            primaryImageUrl: p.primary_image_url ?? null,
            sku: p.sku,
            barcode: p.barcode,
            baseUnit: p.base_unit,
            sellingPrice: p.selling_price,
            vatCode: p.vat_code,
            vatIncluded: p.vat_included,
            availableAtSnapshot: p.available,
            cachedAt: new Date().toISOString(),
          }));
          void upsertCatalog(rows);
          return;
        }

        if (err) {
          setResults([]);
          setSearchHint(err);
          toast.error(err);
          return;
        }

        // Offline snapshot or empty server response
        const cached = await offlineSearch(trimmed);
        setResults(cached);
        setSearchHint(cached.length === 0 ? `No products found for "${trimmed}".` : null);
      });
    },
    [activeBranchId, tenantId, upsertCatalog, offlineSearch],
  );

  useEffect(() => {
    const handle = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(handle);
  }, [query, activeBranchId, runSearch]);

  function handleScannerKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const text = query.trim();
      if (text.length === 0) return;

      // exact-barcode shortcut: if the search returned a row whose barcode
      // matches exactly, add it straight to the cart and clear the box.
      const exact = results.find((r) => r.barcode === text);
      if (exact) {
        addToCart(exact);
        setQuery("");
        return;
      }
      // otherwise, if a single result is left, add that
      if (results.length === 1 && results[0]) {
        addToCart(results[0]);
        setQuery("");
      }
    }
  }

  /* --------------------------- Cart helpers --------------------------- */

  function addMiscWithAmount(amount: number) {
    if (!isValidBranchId(activeBranchId)) {
      toast.error("Pick a branch first.");
      return;
    }
    startSearch(async () => {
      const res = await searchProductsForPos({
        branchId: activeBranchId,
        query: POS_MISC_SKU,
      });
      const err = getSafeActionError(res);
      const data = getSafeActionData<{ ok: true; rows: ProductSearchResult[] }>(res);
      const misc = data?.rows.find((r) => r.sku === POS_MISC_SKU) ?? data?.rows[0] ?? null;
      if (misc) {
        addMiscLineToCart(misc, amount);
        setQuery("");
        setResults([]);
        setSearchHint(null);
        searchRef.current?.focus();
        toast.success(`One-off sale — ${formatEuro(amount)} added to cart.`);
        return;
      }
      if (err) toast.error(err);
      else
        toast.error(
          "Miscellaneous product missing. Ask the manager to run: npm run db:seed:needscarlow:misc",
        );
    });
  }

  function addMiscLineToCart(p: ProductSearchResult, amount: number) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      const line: CartLine = {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        baseUnit: p.base_unit,
        unitPrice: amount,
        vatCode: p.vat_code,
        vatIncluded: p.vat_included,
        qty: 1,
        discount: 0,
        available: p.available,
      };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = line;
        return next;
      }
      return [...prev, line];
    });
  }

  function addToCart(p: ProductSearchResult) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx]!, qty: next[idx]!.qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          baseUnit: p.base_unit,
          unitPrice: p.selling_price,
          vatCode: p.vat_code,
          vatIncluded: p.vat_included,
          qty: 1,
          discount: 0,
          available: p.available,
        },
      ];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev.flatMap((line) => {
        if (line.productId !== productId) return [line];
        const next = line.qty + delta;
        if (next <= 0) return [];
        return [{ ...line, qty: next }];
      }),
    );
  }

  function setQty(productId: string, qty: number) {
    if (!Number.isFinite(qty) || qty <= 0) return;
    setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, qty } : line)));
  }

  function setDiscount(productId: string, discount: number) {
    if (!Number.isFinite(discount) || discount < 0) return;
    setCart((prev) =>
      prev.map((line) => (line.productId === productId ? { ...line, discount } : line)),
    );
  }

  function setUnitPrice(productId: string, unitPrice: number) {
    if (!Number.isFinite(unitPrice) || unitPrice < 0.01) return;
    setCart((prev) =>
      prev.map((line) =>
        line.productId === productId && isPosMiscLine(line)
          ? { ...line, unitPrice: Math.round(unitPrice * 100) / 100, qty: 1 }
          : line,
      ),
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((line) => line.productId !== productId));
  }

  function clearCart() {
    setCart([]);
    setServerError(null);
    if (isValidBranchId(activeBranchId)) {
      clearPersistedPosCart(tenantId, activeBranchId);
    }
  }

  /* ---------------------------- Commit sale ---------------------------- */

  function commit(payments: { method: string; amount: number }[]) {
    if (!isValidBranchId(activeBranchId)) {
      setServerError("Pick a branch first.");
      return;
    }
    const bid = activeBranchId;
    if (cart.length === 0) {
      setServerError("Cart is empty.");
      return;
    }
    setServerError(null);

    // Offline path: queue the sale and let the auto-sync handle it later.
    if (!online) {
      const cashOnly = payments.every((p) => p.method === "cash");
      if (!cashOnly) {
        setServerError("Only cash is accepted while offline. Take a cash payment to queue it.");
        return;
      }
      startCommit(async () => {
        try {
          await enqueueSale(cart, totals.total);
          toast.success(
            "Sale queued offline. It will sync automatically when the connection is back.",
          );
          clearCart();
          setShowPayment(false);
          searchRef.current?.focus();
        } catch (err) {
          setServerError(err instanceof Error ? err.message : "Failed to queue sale");
        }
      });
      return;
    }

    startCommit(async () => {
      const res = await commitPosSaleAction({
        branchId: bid,
        items: cart.map((l) => cartLineToCommitItem(l)),
        payments: payments.map((p) => ({
          method: p.method as "cash" | "card" | "contactless",
          amount: p.amount,
        })),
      });
      const err = getSafeActionError(res);
      if (err) {
        setServerError(err);
        return;
      }
      const data = getSafeActionData<{
        ok: true;
        saleId: string;
        receiptNumber: string;
      }>(res);
      if (data) {
        toast.success(`Receipt ${data.receiptNumber}`);
        window.open(`/sales/${data.saleId}`, "_blank", "noopener,noreferrer");
        clearCart();
        setShowPayment(false);
        searchRef.current?.focus();
      }
    });
  }

  async function handleManualSync() {
    setFlushing(true);
    try {
      const { synced, failed } = await flushNow();
      if (synced > 0) toast.success(`Synced ${synced} queued sale${synced === 1 ? "" : "s"}.`);
      if (failed > 0) toast.error(`${failed} sale(s) still pending - will retry.`);
    } finally {
      setFlushing(false);
    }
  }

  const cartEmpty = cart.length === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* LEFT: scan + cart */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="branch">Branch</Label>
            <select
              id="branch"
              value={activeBranchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} - {b.name}
                </option>
              ))}
            </select>
          </div>

          <PosOfflineStatus
            online={online}
            pendingCount={pendingCount}
            cachedCount={cachedCount}
            flushing={flushing}
            onFlush={handleManualSync}
          />

          <div className="flex-1 space-y-1">
            <Label htmlFor="scan">Scan or search</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2" />
              <Input
                id="scan"
                ref={searchRef}
                autoFocus
                placeholder="Scan a barcode, or type SKU / name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleScannerKeyDown}
                className="pl-8"
                autoComplete="off"
              />
              {searchPending ? (
                <Loader2 className="text-muted-foreground absolute top-1/2 right-2 size-4 -translate-y-1/2 animate-spin" />
              ) : null}
            </div>
            {searchHint && !searchPending ? (
              <p className="text-muted-foreground text-xs">{searchHint}</p>
            ) : null}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="border-primary/40 bg-primary/5 hover:bg-primary/10 h-auto w-full justify-start gap-3 px-4 py-3 text-left"
          disabled={searchPending || !isValidBranchId(activeBranchId)}
          onClick={() => setShowOneOff(true)}
        >
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
            <Tag className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold">One-off sale</span>
            <span className="text-muted-foreground text-xs">
              Item not in the list — enter the amount you want to charge
            </span>
          </span>
        </Button>

        <OneOffSaleDialog
          open={showOneOff}
          onOpenChange={setShowOneOff}
          pending={searchPending}
          onConfirm={addMiscWithAmount}
        />

        {results.length > 0 ? (
          <Card className="overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Tap a product to add</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    addToCart(p);
                    setQuery("");
                    setResults([]);
                    searchRef.current?.focus();
                  }}
                  className="hover:border-primary border-border bg-card flex items-start gap-3 rounded-lg border p-3 text-left transition-colors"
                >
                  {p.primary_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.primary_image_url}
                      alt=""
                      className="size-12 shrink-0 rounded-md border object-cover"
                    />
                  ) : null}
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {p.sku ?? "-"} · {p.barcode ?? "no barcode"}
                    </span>
                    <span className="text-foreground font-semibold">
                      {formatEuro(p.selling_price)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {p.available} {p.base_unit} in stock
                    </span>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm font-medium">
              Cart ({cart.length} {cart.length === 1 ? "line" : "lines"})
            </CardTitle>
            {!cartEmpty ? (
              <Button size="sm" variant="ghost" onClick={clearCart}>
                <X className="size-3.5" />
                Clear
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            {cartEmpty ? (
              <p className="text-muted-foreground p-6 text-center text-sm">
                Scan a barcode or pick from the search to start a sale.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {cart.map((line) => (
                  <CartLineRow
                    key={line.productId}
                    line={line}
                    onQtyDelta={(d) => changeQty(line.productId, d)}
                    onQtySet={(q) => setQty(line.productId, q)}
                    onUnitPriceSet={(p) => setUnitPrice(line.productId, p)}
                    onDiscount={(d) => setDiscount(line.productId, d)}
                    onRemove={() => removeLine(line.productId)}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RIGHT: totals + pay */}
      <aside className="space-y-3">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Sale summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Subtotal (net)" value={formatEuro(totals.subtotal)} />
            <Row label="Discount" value={formatEuro(totals.discount)} />
            <Row label="VAT" value={formatEuro(totals.vat)} />
            <div className="border-border mt-2 flex items-center justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{formatEuro(totals.total)}</span>
            </div>
          </CardContent>
        </Card>

        {!online ? (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs">
              You are offline. Cash sales can still be taken and will sync automatically when the
              connection is back.
            </AlertDescription>
          </Alert>
        ) : null}

        {serverError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          size="lg"
          className="h-14 w-full text-base"
          disabled={cartEmpty || committing}
          onClick={() => setShowPayment(true)}
        >
          {committing ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <WalletCards className="size-5" />
              Take payment
            </>
          )}
        </Button>

        <p className="text-muted-foreground text-center text-xs">
          <Receipt className="mr-1 inline size-3" />
          Once paid, the receipt opens in a new tab. Stock is updated in the same transaction.
        </p>

        {cart.some((l) => l.available !== null && l.qty > (l.available ?? 0)) ? (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs">
              Some lines exceed current stock. The sale will still complete but you should review
              stock counts.
            </AlertDescription>
          </Alert>
        ) : null}
      </aside>

      <PosPaymentDialog
        open={showPayment}
        total={totals.total}
        pending={committing}
        cashOnly={!online}
        onClose={() => setShowPayment(false)}
        onConfirm={(payments) => commit(payments)}
      />
    </div>
  );
}

/* ----------------------------- Helpers ----------------------------- */

function CartLineRow({
  line,
  onQtyDelta,
  onQtySet,
  onUnitPriceSet,
  onDiscount,
  onRemove,
}: {
  line: CartLine;
  onQtyDelta: (d: number) => void;
  onQtySet: (q: number) => void;
  onUnitPriceSet: (price: number) => void;
  onDiscount: (d: number) => void;
  onRemove: () => void;
}) {
  const misc = isPosMiscLine(line);
  const lineGross = line.vatIncluded
    ? line.unitPrice * line.qty - line.discount
    : line.unitPrice * line.qty * (1 + (VAT_RATES[line.vatCode] ?? 0)) - line.discount;

  return (
    <li className="flex items-start gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{line.name}</p>
        <p className="text-muted-foreground font-mono text-[11px]">
          {misc ? (
            <>
              {line.sku ?? "-"} · one-off
              <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">
                {line.vatCode}
              </Badge>
            </>
          ) : (
            <>
              {line.sku ?? "-"} · {formatEuro(line.unitPrice)} / {line.baseUnit}{" "}
              <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">
                {line.vatCode}
              </Badge>
            </>
          )}
        </p>
        {line.discount > 0 ? (
          <p className="text-success dark:text-success text-xs">
            - {formatEuro(line.discount)} off
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-1">
        {misc ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-muted-foreground text-[10px]">Amount (€)</span>
            <Input
              type="number"
              min={0.01}
              max={99999}
              step={0.01}
              value={line.unitPrice}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 0.01) onUnitPriceSet(v);
              }}
              aria-label="One-off sale amount"
              className="h-8 w-24 text-right text-sm font-semibold"
            />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-7"
                onClick={() => onQtyDelta(-1)}
              >
                <Minus className="size-3" />
              </Button>
              <Input
                type="number"
                min={0.0001}
                step={1}
                value={line.qty}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) onQtySet(v);
                }}
                className="h-7 w-16 text-center text-xs"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-7"
                onClick={() => onQtyDelta(1)}
              >
                <Plus className="size-3" />
              </Button>
            </div>

            <Input
              type="number"
              min={0}
              step="0.01"
              value={line.discount}
              onChange={(e) => onDiscount(Number(e.target.value) || 0)}
              placeholder="0.00"
              aria-label="Line discount"
              className={cn("h-7 w-20 text-right text-xs", line.discount > 0 && "text-success")}
            />
          </>
        )}
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold">{formatEuro(lineGross)}</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive size-7"
          onClick={onRemove}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
