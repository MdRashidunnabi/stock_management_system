# Needscarlow demo shop

Local seed loads all product images from `needscarlow_images/` into ShopOS.

## Seed command

```bash
npm run db:seed:needscarlow
```

Creates:

- Tenant **Needscarlow** (slug `needscarlow`)
- One branch: **Needscarlow - Carlow** (`NCAR`)
- **1,261** products with `primary_image_url` (served from `/shops/needscarlow/...`)
- Opening stock: **30** units per product
- Demo users (password **`DemoPass123!`** for all):

| Email                                 | Role       |
| ------------------------------------- | ---------- |
| `owner@needscarlow.shopos.local`      | owner      |
| `manager@needscarlow.shopos.local`    | manager    |
| `cashier@needscarlow.shopos.local`    | cashier    |
| `accountant@needscarlow.shopos.local` | accountant |

Sign in at http://localhost:3000/login and switch to **Needscarlow** if you belong to multiple shops.

## Fresh vegetables (Irish staples)

Adds **22** fresh veg products (potatoes, onions, carrots, broccoli, etc.) without re-importing the full image catalogue:

```bash
npm run db:seed:needscarlow:vegetables
```

- Category: **Fresh Vegetables** → `/shop/needscarlow/category/fresh-vegetables`
- SKUs: `NC-VEGE-0001` … `NC-VEGE-0022`
- VAT: **0%** (ZER) on unprocessed produce
- Stock is set per item (e.g. 48 bags of Rooster potatoes, low stock on spinach/tomatoes)

To add more later: copy a row in `src/db/seed-needscarlow-vegetables.ts` and re-run the command, or use **Products → New product** in the app (same stock pool as POS and online shop).
