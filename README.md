# ShopOS

The Retail Operating System for Irish independent shops.
POS, stock, suppliers, branches, and online sales in one platform.

- Currency: EUR
- Locale: en-IE
- Timezone: Europe/Dublin
- VAT-ready for Ireland (23% / 13.5% / 9% / 4.8% / 0%)
- Hosting target: Vercel + Supabase

See [BUSINESS_AND_PRODUCT_PLAN.md](./BUSINESS_AND_PRODUCT_PLAN.md) for the full
strategic and technical plan.

---

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres + Auth + Storage + Realtime)
- Drizzle ORM
- TanStack Query + Zustand + React Hook Form + Zod
- Vitest + Playwright
- ESLint + Prettier + Husky + lint-staged

---

## Project structure

```
.
├── BUSINESS_AND_PRODUCT_PLAN.md   # master strategic plan
├── DEVELOPER_SETUP.md             # step-by-step local setup
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── components.json                # shadcn/ui config
├── .env.example
├── public/
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (admin)/               # owner / manager / accountant UI (later)
│   │   ├── (auth)/                # login / signup (later)
│   │   ├── (pos)/                 # cashier POS PWA (later)
│   │   ├── (storefront)/          # online store (later)
│   │   ├── api/                   # Route Handlers (later)
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/                # shared UI components
│   ├── db/                        # Drizzle schema + migrations
│   ├── features/                  # feature modules (products, sales, ...)
│   ├── hooks/
│   ├── lib/                       # env, utils, supabase clients
│   └── server/                    # server actions / services
└── supabase/                      # local Supabase config + migrations
```

---

## Getting started (local dev)

See **[DEVELOPER_SETUP.md](./DEVELOPER_SETUP.md)** for the exact step-by-step.

Quick view:

```bash
# install deps
npm install

# copy env and fill in Supabase keys
cp .env.example .env.local

# run dev
npm run dev
```

---

## Scripts

| Script                   | What it does                                                  |
| ------------------------ | ------------------------------------------------------------- |
| `npm run dev`            | Start Next.js dev server (Turbopack) on http://localhost:3000 |
| `npm run build`          | Production build                                              |
| `npm start`              | Run the production build                                      |
| `npm run lint`           | ESLint                                                        |
| `npm run lint:fix`       | ESLint with auto-fix                                          |
| `npm run format`         | Prettier write                                                |
| `npm run format:check`   | Prettier check                                                |
| `npm run typecheck`      | TypeScript check (no emit)                                    |
| `npm run test`           | Vitest unit tests                                             |
| `npm run test:e2e`       | Playwright end-to-end tests                                   |
| `npm run db:generate`    | Drizzle - generate migrations from schema                     |
| `npm run db:migrate`     | Drizzle - apply migrations                                    |
| `npm run db:push`        | Drizzle - push schema (dev only)                              |
| `npm run db:studio`      | Drizzle Studio (visual DB explorer)                           |
| `npm run db:seed`        | Run seed script                                               |
| `npm run supabase:start` | Start local Supabase stack                                    |
| `npm run supabase:stop`  | Stop local Supabase stack                                     |

---

## Compliance disclaimer

ShopOS produces VAT-compliant receipts/invoices for Ireland. Specific tax rules
(VAT rates by category, e-invoicing obligations, data retention periods)
must be verified with a Revenue.ie-registered accountant. This repository
contains no legal, tax, or accounting advice.

---

## License

Proprietary. All rights reserved.
