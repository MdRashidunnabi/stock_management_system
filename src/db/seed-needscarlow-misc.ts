/**
 * Adds the Needscarlow "Miscellaneous sale" POS product without re-seeding the full catalogue.
 *
 * Run: npm run db:seed:needscarlow:misc
 */
import "dotenv/config";
import postgres from "postgres";
import { ensureNeedscarlowMiscProduct, MISC_PRODUCT } from "./needscarlow-misc-product";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("Missing DATABASE_URL in .env.local");

  const sql = postgres(dbUrl, { onnotice: () => {} });
  try {
    await ensureNeedscarlowMiscProduct(sql);
    console.info("[needscarlow:misc] added/updated", MISC_PRODUCT.sku, MISC_PRODUCT.name);
    console.info("  POS: use One-off sale and enter any amount (VAT-inclusive).");
  } finally {
    await sql.end({ timeout: 10 });
  }
}

main().catch((e) => {
  console.error("[needscarlow:misc] failed:", e);
  process.exit(1);
});
