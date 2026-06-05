/**
 * Adds Fresh Vegetables (Irish grocery staples) to Needscarlow without touching
 * the existing ~1260 imported products.
 *
 * Run: npm run db:seed:needscarlow:vegetables
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import {
  NEEDSCARLOW_BRANCH_ID,
  NEEDSCARLOW_SUPPLIER_ID,
  NEEDSCARLOW_TENANT_ID,
} from "./needscarlow-misc-product";

const CATEGORY_FOLDER = "Fresh_Vegetables";
const CATEGORY_SLUG = "fresh-vegetables";
const CATEGORY_NAME = "Fresh Vegetables";
const CATEGORY_POSITION = 2;

const IMAGES_DIR = path.join(
  process.cwd(),
  "Shops",
  "Needscarlow",
  "needscarlow_images",
  CATEGORY_FOLDER,
);

/** Fresh fruit & veg is typically 0% VAT in Ireland when unprocessed. */
const VAT = "ZER" as const;

type VegItem = {
  seq: number;
  name: string;
  skuSuffix: string;
  barcode: string;
  purchasePrice: number;
  sellingPrice: number;
  baseUnit: string;
  stockQty: number;
  imageFile: string;
  /** Short label on generated placeholder image */
  imageLabel: string;
};

const VEGETABLES: VegItem[] = [
  {
    seq: 1,
    name: "Rooster Potatoes 2.5kg",
    skuSuffix: "POTA",
    barcode: "5099008000001",
    purchasePrice: 2.1,
    sellingPrice: 3.49,
    baseUnit: "un",
    stockQty: 48,
    imageFile: "01_rooster_potatoes.svg",
    imageLabel: "Rooster Potatoes",
  },
  {
    seq: 2,
    name: "White Potatoes 2kg",
    skuSuffix: "POTW",
    barcode: "5099008000002",
    purchasePrice: 1.6,
    sellingPrice: 2.79,
    baseUnit: "un",
    stockQty: 36,
    imageFile: "02_white_potatoes.svg",
    imageLabel: "White Potatoes",
  },
  {
    seq: 3,
    name: "Baby Potatoes 1kg",
    skuSuffix: "POTB",
    barcode: "5099008000003",
    purchasePrice: 1.35,
    sellingPrice: 2.29,
    baseUnit: "un",
    stockQty: 24,
    imageFile: "03_baby_potatoes.svg",
    imageLabel: "Baby Potatoes",
  },
  {
    seq: 4,
    name: "Sweet Potato 500g",
    skuSuffix: "SWPO",
    barcode: "5099008000004",
    purchasePrice: 1.1,
    sellingPrice: 1.99,
    baseUnit: "un",
    stockQty: 20,
    imageFile: "04_sweet_potato.svg",
    imageLabel: "Sweet Potato",
  },
  {
    seq: 5,
    name: "Brown Onions 1kg",
    skuSuffix: "ONBR",
    barcode: "5099008000005",
    purchasePrice: 0.85,
    sellingPrice: 1.49,
    baseUnit: "un",
    stockQty: 40,
    imageFile: "05_brown_onions.svg",
    imageLabel: "Brown Onions",
  },
  {
    seq: 6,
    name: "Red Onions 500g",
    skuSuffix: "ONRD",
    barcode: "5099008000006",
    purchasePrice: 0.75,
    sellingPrice: 1.29,
    baseUnit: "un",
    stockQty: 18,
    imageFile: "06_red_onions.svg",
    imageLabel: "Red Onions",
  },
  {
    seq: 7,
    name: "Carrots 1kg",
    skuSuffix: "CARR",
    barcode: "5099008000007",
    purchasePrice: 0.7,
    sellingPrice: 1.19,
    baseUnit: "un",
    stockQty: 35,
    imageFile: "07_carrots.svg",
    imageLabel: "Carrots",
  },
  {
    seq: 8,
    name: "Parsnips 500g",
    skuSuffix: "PARS",
    barcode: "5099008000008",
    purchasePrice: 0.9,
    sellingPrice: 1.49,
    baseUnit: "un",
    stockQty: 14,
    imageFile: "08_parsnips.svg",
    imageLabel: "Parsnips",
  },
  {
    seq: 9,
    name: "Broccoli",
    skuSuffix: "BROC",
    barcode: "5099008000009",
    purchasePrice: 1.05,
    sellingPrice: 1.79,
    baseUnit: "un",
    stockQty: 22,
    imageFile: "09_broccoli.svg",
    imageLabel: "Broccoli",
  },
  {
    seq: 10,
    name: "Cauliflower",
    skuSuffix: "CAUL",
    barcode: "5099008000010",
    purchasePrice: 1.45,
    sellingPrice: 2.49,
    baseUnit: "un",
    stockQty: 12,
    imageFile: "10_cauliflower.svg",
    imageLabel: "Cauliflower",
  },
  {
    seq: 11,
    name: "White Cabbage",
    skuSuffix: "CABW",
    barcode: "5099008000011",
    purchasePrice: 0.75,
    sellingPrice: 1.29,
    baseUnit: "un",
    stockQty: 16,
    imageFile: "11_white_cabbage.svg",
    imageLabel: "White Cabbage",
  },
  {
    seq: 12,
    name: "Vine Tomatoes 500g",
    skuSuffix: "TOMV",
    barcode: "5099008000012",
    purchasePrice: 1.35,
    sellingPrice: 2.29,
    baseUnit: "un",
    stockQty: 5,
    imageFile: "12_vine_tomatoes.svg",
    imageLabel: "Vine Tomatoes",
  },
  {
    seq: 13,
    name: "Cherry Tomatoes 250g",
    skuSuffix: "TOMC",
    barcode: "5099008000013",
    purchasePrice: 1.15,
    sellingPrice: 1.99,
    baseUnit: "un",
    stockQty: 4,
    imageFile: "13_cherry_tomatoes.svg",
    imageLabel: "Cherry Tomatoes",
  },
  {
    seq: 14,
    name: "Cucumber",
    skuSuffix: "CUCU",
    barcode: "5099008000014",
    purchasePrice: 0.45,
    sellingPrice: 0.89,
    baseUnit: "un",
    stockQty: 28,
    imageFile: "14_cucumber.svg",
    imageLabel: "Cucumber",
  },
  {
    seq: 15,
    name: "Mixed Peppers 3 Pack",
    skuSuffix: "PEPP",
    barcode: "5099008000015",
    purchasePrice: 1.75,
    sellingPrice: 2.99,
    baseUnit: "un",
    stockQty: 19,
    imageFile: "15_mixed_peppers.svg",
    imageLabel: "Mixed Peppers",
  },
  {
    seq: 16,
    name: "White Mushrooms 250g",
    skuSuffix: "MUSH",
    barcode: "5099008000016",
    purchasePrice: 0.85,
    sellingPrice: 1.49,
    baseUnit: "un",
    stockQty: 3,
    imageFile: "16_mushrooms.svg",
    imageLabel: "Mushrooms",
  },
  {
    seq: 17,
    name: "Iceberg Lettuce",
    skuSuffix: "LETT",
    barcode: "5099008000017",
    purchasePrice: 0.65,
    sellingPrice: 1.19,
    baseUnit: "un",
    stockQty: 15,
    imageFile: "17_iceberg_lettuce.svg",
    imageLabel: "Iceberg Lettuce",
  },
  {
    seq: 18,
    name: "Baby Spinach 200g",
    skuSuffix: "SPIN",
    barcode: "5099008000018",
    purchasePrice: 1.05,
    sellingPrice: 1.79,
    baseUnit: "un",
    stockQty: 2,
    imageFile: "18_baby_spinach.svg",
    imageLabel: "Baby Spinach",
  },
  {
    seq: 19,
    name: "Garlic Bulb",
    skuSuffix: "GARL",
    barcode: "5099008000019",
    purchasePrice: 0.4,
    sellingPrice: 0.79,
    baseUnit: "un",
    stockQty: 30,
    imageFile: "19_garlic.svg",
    imageLabel: "Garlic",
  },
  {
    seq: 20,
    name: "Fresh Ginger 150g",
    skuSuffix: "GING",
    barcode: "5099008000020",
    purchasePrice: 0.85,
    sellingPrice: 1.49,
    baseUnit: "un",
    stockQty: 11,
    imageFile: "20_ginger.svg",
    imageLabel: "Fresh Ginger",
  },
  {
    seq: 21,
    name: "Courgette",
    skuSuffix: "COUR",
    barcode: "5099008000021",
    purchasePrice: 0.55,
    sellingPrice: 0.99,
    baseUnit: "un",
    stockQty: 25,
    imageFile: "21_courgette.svg",
    imageLabel: "Courgette",
  },
  {
    seq: 22,
    name: "Butternut Squash",
    skuSuffix: "SQSH",
    barcode: "5099008000022",
    purchasePrice: 1.2,
    sellingPrice: 1.99,
    baseUnit: "un",
    stockQty: 10,
    imageFile: "22_butternut_squash.svg",
    imageLabel: "Butternut Squash",
  },
];

function svgPlaceholder(_label: string, hue: number): string {
  const bg = `hsl(${hue} 42% 42%)`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
  <rect width="480" height="480" fill="${bg}"/>
  <circle cx="240" cy="200" r="80" fill="rgba(255,255,255,0.12)"/>
  <circle cx="200" cy="260" r="24" fill="rgba(255,255,255,0.08)"/>
  <circle cx="280" cy="250" r="18" fill="rgba(255,255,255,0.08)"/>
</svg>`;
}

function imageUrl(filename: string): string {
  return (
    "/shops/needscarlow/" + [CATEGORY_FOLDER, filename].map((s) => encodeURIComponent(s)).join("/")
  );
}

function writePlaceholderImages() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  for (const item of VEGETABLES) {
    const out = path.join(IMAGES_DIR, item.imageFile);
    fs.writeFileSync(out, svgPlaceholder(item.imageLabel, 95 + (item.seq % 40)), "utf8");
  }
  console.info(`[needscarlow-veg] images in ${path.relative(process.cwd(), IMAGES_DIR)}`);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("Missing DATABASE_URL in .env.local");

  writePlaceholderImages();

  const sql = postgres(dbUrl, { max: 1 });

  try {
    const tenantRows = await sql<{ id: string }[]>`
      select id from public.tenants where id = ${NEEDSCARLOW_TENANT_ID} limit 1
    `;
    if (tenantRows.length === 0) {
      throw new Error("Needscarlow tenant missing — run npm run db:seed:needscarlow first");
    }

    await sql`
      insert into public.categories (tenant_id, name, slug, position, is_active)
      values (${NEEDSCARLOW_TENANT_ID}, ${CATEGORY_NAME}, ${CATEGORY_SLUG}, ${CATEGORY_POSITION}, true)
      on conflict (tenant_id, slug) do update set
        name = excluded.name,
        position = excluded.position,
        is_active = true
    `;

    let inserted = 0;
    for (const v of VEGETABLES) {
      const sku = `NC-VEGE-${String(v.seq).padStart(4, "0")}`;
      const url = imageUrl(v.imageFile);

      await sql`
        insert into public.products (
          tenant_id, name, sku, barcode, category_id, default_supplier_id,
          purchase_price, selling_price, vat_code, vat_included, base_unit,
          primary_image_url, is_active, weighable, decimal_qty_allowed
        )
        select
          ${NEEDSCARLOW_TENANT_ID},
          ${v.name},
          ${sku},
          ${v.barcode},
          (select id from public.categories where tenant_id = ${NEEDSCARLOW_TENANT_ID} and slug = ${CATEGORY_SLUG} limit 1),
          ${NEEDSCARLOW_SUPPLIER_ID},
          ${v.purchasePrice},
          ${v.sellingPrice},
          ${VAT}::public.vat_code,
          true,
          ${v.baseUnit},
          ${url},
          true,
          false,
          false
        on conflict (tenant_id, sku) do update set
          name = excluded.name,
          barcode = excluded.barcode,
          category_id = excluded.category_id,
          purchase_price = excluded.purchase_price,
          selling_price = excluded.selling_price,
          vat_code = excluded.vat_code,
          primary_image_url = excluded.primary_image_url,
          is_active = true,
          archived_at = null
      `;

      await sql`
        insert into public.stock_balances (tenant_id, branch_id, product_id, state, quantity)
        select ${NEEDSCARLOW_TENANT_ID}, ${NEEDSCARLOW_BRANCH_ID}, id, 'available', ${v.stockQty}
        from public.products
        where tenant_id = ${NEEDSCARLOW_TENANT_ID} and sku = ${sku}
        on conflict (tenant_id, branch_id, product_id, variant_id, state) do update
          set quantity = excluded.quantity
      `;

      inserted += 1;
    }

    console.info(`[needscarlow-veg] upserted ${inserted} products in "${CATEGORY_NAME}"`);
    console.info(
      `[needscarlow-veg] online shop: http://localhost:3000/shop/needscarlow/category/${CATEGORY_SLUG}`,
    );
    console.info(`[needscarlow-veg] admin products: filter category "${CATEGORY_NAME}"`);
  } finally {
    await sql.end({ timeout: 10 });
  }
}

main().catch((e) => {
  console.error("[needscarlow-veg] failed:", e);
  process.exit(1);
});
