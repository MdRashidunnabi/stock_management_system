import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { STOCK_POOL_VALUE, stockLinkValue } from "./stock-link";
import {
  applyPooledStock,
  borrowForCuts,
  loadStockLinks,
  poolTotals,
  returnToSource,
  settlePools,
  syncCutCosts,
} from "./stock-pools";

type Row = Record<string, unknown>;

/** Just enough of the Supabase query builder for the stock pool helpers. */
function fakeDb(tables: Record<string, Row[]>) {
  let nextId = 1;
  class Query {
    private filters: ((r: Row) => boolean)[] = [];
    private mode: "select" | "insert" | "update" = "select";
    private payload: Row = {};
    private returning = false;
    private one: "single" | "maybe" | null = null;
    private max: number | null = null;
    constructor(private table: string) {}
    select() {
      if (this.mode !== "select") this.returning = true;
      return this;
    }
    insert(row: Row) {
      this.mode = "insert";
      this.payload = row;
      return this;
    }
    update(row: Row) {
      this.mode = "update";
      this.payload = row;
      return this;
    }
    eq(col: string, value: unknown) {
      this.filters.push((r) => r[col] === value);
      return this;
    }
    in(col: string, values: unknown[]) {
      this.filters.push((r) => values.includes(r[col]));
      return this;
    }
    is(col: string, value: null) {
      this.filters.push((r) => (r[col] ?? null) === value);
      return this;
    }
    contains(col: string, wanted: Row[]) {
      this.filters.push((r) => {
        const list = Array.isArray(r[col]) ? (r[col] as Row[]) : [];
        return wanted.every((w) =>
          list.some((item) => Object.entries(w).every(([k, v]) => item[k] === v)),
        );
      });
      return this;
    }
    order() {
      return this;
    }
    limit(n: number) {
      this.max = n;
      return this;
    }
    single() {
      this.one = "single";
      return this;
    }
    maybeSingle() {
      this.one = "maybe";
      return this;
    }
    private run() {
      const rows = (tables[this.table] ??= []);
      if (this.mode === "insert") {
        if (
          this.table === "stock_balances" &&
          rows.some(
            (r) =>
              r.product_id === this.payload.product_id &&
              r.branch_id === this.payload.branch_id &&
              r.state === this.payload.state,
          )
        ) {
          return { data: null, error: { message: "duplicate key" } };
        }
        const row = { id: nextId++, variant_id: null, ...this.payload };
        rows.push(row);
        return { data: this.returning ? (this.one ? row : [row]) : null, error: null };
      }
      const matched = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.mode === "update") {
        for (const r of matched) Object.assign(r, this.payload);
        return { data: this.returning ? matched : null, error: null };
      }
      const limited = this.max == null ? matched : matched.slice(0, this.max);
      if (this.one) return { data: limited[0] ?? null, error: null };
      return { data: limited, error: null };
    }
    then<T>(resolve: (value: ReturnType<Query["run"]>) => T) {
      return Promise.resolve(this.run()).then(resolve);
    }
  }
  return { from: (table: string) => new Query(table) } as unknown as SupabaseClient<Database>;
}

const T = "tenant";
const B = "branch";
const place = { tenantId: T, branchId: B };
const opts = { referenceType: "sale", note: "test" };

function shop() {
  const tables: Record<string, Row[]> = {
    products: [
      {
        id: "beef",
        tenant_id: T,
        name: "Beef Whole",
        purchase_price: 20,
        unit_conversions: STOCK_POOL_VALUE,
      },
      {
        id: "mf001",
        tenant_id: T,
        name: "Beef with Bone",
        purchase_price: 7.5,
        unit_conversions: stockLinkValue("beef"),
      },
      {
        id: "mf003",
        tenant_id: T,
        name: "Boneless Beef",
        purchase_price: 8.5,
        unit_conversions: stockLinkValue("beef"),
      },
      {
        id: "mf004",
        tenant_id: T,
        name: "Beef Mince",
        purchase_price: 8.5,
        unit_conversions: stockLinkValue("beef"),
      },
      { id: "rice", tenant_id: T, name: "Rice", purchase_price: 2, unit_conversions: [] },
    ],
    stock_balances: [
      {
        id: "b1",
        tenant_id: T,
        branch_id: B,
        product_id: "beef",
        variant_id: null,
        state: "available",
        quantity: 10,
      },
    ],
    stock_ledger: [],
  };
  return { tables, db: fakeDb(tables) };
}

function balance(tables: Record<string, Row[]>, productId: string) {
  const row = tables.stock_balances!.find((r) => r.product_id === productId);
  return Math.round(Number(row?.quantity ?? 0) * 10000) / 10000;
}

/** What `commit_pos_sale` does to each line: take it off the product's own stock. */
function tillRpc(tables: Record<string, Row[]>, lines: { productId: string; qty: number }[]) {
  for (const line of lines) {
    const row = tables.stock_balances!.find((r) => r.product_id === line.productId);
    if (row) row.quantity = Number(row.quantity) - line.qty;
    else
      tables.stock_balances!.push({
        id: `b-${line.productId}`,
        tenant_id: T,
        branch_id: B,
        product_id: line.productId,
        variant_id: null,
        state: "available",
        quantity: -line.qty,
      });
  }
}

describe("beef sold by the cut, bought whole", () => {
  const sale = [
    { productId: "mf003", qty: 0.8 },
    { productId: "mf004", qty: 3 },
    { productId: "mf001", qty: 2 },
  ];

  it("takes 5.8 kg of cuts off 10 kg of whole beef, leaving 4.2 kg", async () => {
    const { tables, db } = shop();
    const links = await loadStockLinks(
      db,
      T,
      sale.map((l) => l.productId),
    );
    expect(links.size).toBe(3);

    tillRpc(tables, sale);
    await borrowForCuts(db, place, sale, links, opts);

    expect(balance(tables, "beef")).toBe(4.2);
    expect(balance(tables, "mf003")).toBe(0);
    expect(balance(tables, "mf004")).toBe(0);
    expect(balance(tables, "mf001")).toBe(0);
    expect((await poolTotals(db, place, ["beef"])).get("beef")).toBe(4.2);
  });

  it("shows 4.2 kg on the whole beef and on every cut", async () => {
    const { tables, db } = shop();
    const links = await loadStockLinks(
      db,
      T,
      sale.map((l) => l.productId),
    );
    tillRpc(tables, sale);
    await borrowForCuts(db, place, sale, links, opts);

    const stock = new Map<string, number>();
    await applyPooledStock(
      db,
      place,
      tables.products as { id: string; unit_conversions: Json }[],
      stock,
    );
    expect(stock.get("beef")).toBe(4.2);
    expect(stock.get("mf001")).toBe(4.2);
    expect(stock.get("mf004")).toBe(4.2);
    expect(stock.has("rice")).toBe(false);
  });

  it("costs every cut at the whole beef's price, so profit is sales minus 5.8 kg × €20", async () => {
    const { tables, db } = shop();
    await syncCutCosts(db, T, ["beef"]);
    const cost = (id: string) => Number(tables.products!.find((p) => p.id === id)!.purchase_price);
    expect([cost("mf001"), cost("mf003"), cost("mf004")]).toEqual([20, 20, 20]);
    const cogs = sale.reduce((sum, l) => sum + l.qty * cost(l.productId), 0);
    expect(Math.round(cogs * 100) / 100).toBe(116);
    expect(Math.round((140 - cogs) * 100) / 100).toBe(24);
  });

  it("online: refuses more than is left, and puts weight back when an order fails", async () => {
    const { tables, db } = shop();
    const links = await loadStockLinks(db, T, ["mf004"]);

    const tooMuch = await borrowForCuts(db, place, [{ productId: "mf004", qty: 12 }], links, {
      ...opts,
      cover: true,
    });
    expect(tooMuch).toEqual([]);
    expect(balance(tables, "beef")).toBe(10);

    const moved = await borrowForCuts(db, place, [{ productId: "mf004", qty: 1.5 }], links, {
      ...opts,
      cover: true,
    });
    expect(moved).toEqual([{ cutId: "mf004", qty: 1.5 }]);
    expect(balance(tables, "mf004")).toBe(1.5);
    expect((await poolTotals(db, place, ["beef"])).get("beef")).toBe(10);

    await returnToSource(db, place, moved, links, opts);
    expect(balance(tables, "beef")).toBe(10);
    expect(balance(tables, "mf004")).toBe(0);
  });

  it("repairs a cut left below zero when stock could not be moved", async () => {
    const { tables, db } = shop();
    tillRpc(tables, [{ productId: "mf003", qty: 0.5 }]);
    expect((await poolTotals(db, place, ["beef"])).get("beef")).toBe(9.5);

    await settlePools(db, place, ["beef"], opts);
    expect(balance(tables, "beef")).toBe(9.5);
    expect(balance(tables, "mf003")).toBe(0);
  });

  it("writes a matching pair of ledger rows for each move", async () => {
    const { tables, db } = shop();
    const links = await loadStockLinks(db, T, ["mf004"]);
    tillRpc(tables, [{ productId: "mf004", qty: 3 }]);
    await borrowForCuts(db, place, [{ productId: "mf004", qty: 3 }], links, opts);
    const rows = tables.stock_ledger!;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      product_id: "beef",
      movement_type: "transfer_out",
      quantity: 3,
      unit_cost: 20,
    });
    expect(rows[1]).toMatchObject({
      product_id: "mf004",
      movement_type: "transfer_in",
      quantity: 3,
      related_movement_id: rows[0]!.id,
    });
  });
});
