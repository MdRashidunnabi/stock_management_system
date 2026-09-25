# ShopOS

POS, stock, suppliers, and online sales for shops.

## Public demo

These accounts are for testers. They are not production admin accounts.

| Role    | Email                       | Password       |
| ------- | --------------------------- | -------------- |
| Owner   | `owner@demo.shopos.local`   | `DemoPass123!` |
| Cashier | `cashier@demo.shopos.local` | `DemoPass123!` |

Sign in at `/login`. Use **Owner** or **Cashier** on that page to fill the form.

The demo only works on a live ShopOS instance (Vercel, or a Hostinger **VPS** with Docker). It will not log in on Hostinger **shared** hosting.

## Hosting

- **Shared Hostinger (PHP):** brochure only. Upload `hostinger-shared/index.html`. No login, no till, no database.
- **Hostinger VPS:** real app. Docker + Postgres/Supabase.
- **Vercel + Supabase:** real app (simplest public demo).

## Local

See [DEVELOPER_SETUP.md](./DEVELOPER_SETUP.md).

```bash
npm install
cp .env.example .env.local
npx supabase start
npm run db:seed:auth
npm run dev
```

Then open http://localhost:3000/login with the demo accounts above.

## Scripts

| Script                      | What it does                                      |
| --------------------------- | ------------------------------------------------- |
| `npm run dev`               | Dev server                                        |
| `npm run build`             | Production build                                  |
| `npm start`                 | Run production build                              |
| `npm run test`              | Unit tests                                        |
| `npm run desktop:build:win` | Windows till installer (`apps/desktop/README.md`) |

## License

Proprietary. All rights reserved.
