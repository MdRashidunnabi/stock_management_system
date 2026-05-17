# Developer Setup Guide (Local)

This guide tells you exactly what to do on your machine to run ShopOS
locally. It is written for a single developer / founder on Linux (Ubuntu),
macOS, or Windows (WSL2 recommended).

We split tasks into:

- **AUTOMATIC** - the agent does these in code.
- **MANUAL (YOU)** - you do these on your machine, in your browser, or in
  your terminal. Each one is numbered. Do them in order.

---

## 0. Prerequisites (one-time, MANUAL)

### MANUAL-0.1 - Required tools

Make sure these are installed:

| Tool    | Min version                   | Check              |
| ------- | ----------------------------- | ------------------ |
| Node.js | 20.x or 22.x                  | `node --version`   |
| npm     | 9.x or 10.x                   | `npm --version`    |
| Git     | 2.30+                         | `git --version`    |
| Docker  | 24+ (only for local Supabase) | `docker --version` |

If anything is missing:

- Node.js: install via [nvm](https://github.com/nvm-sh/nvm) (recommended) or
  the official installer.
- Docker: install Docker Desktop (Windows/macOS) or Docker Engine (Linux).
  Make sure your user is in the `docker` group on Linux:
  `sudo usermod -aG docker $USER` then log out and back in.

### MANUAL-0.2 - Create a Supabase account

1. Go to <https://supabase.com> and sign up (GitHub login is fine).
2. Don't create a project yet - we will do that in Step 2.

### MANUAL-0.3 - Create a GitHub account (if you don't have one)

1. Go to <https://github.com> and sign up.
2. Don't create a repository yet - we will do that in Step 5.

### MANUAL-0.4 - (Later) Create a Vercel account

Skip this for now. We will set it up only when local everything is green.

---

## 1. Install dependencies (MANUAL)

Open a terminal at the project root:

```bash
cd "/home/md-rashidunnabi/Desktop/Software Development Projects/Stock Management System"
npm install
```

Expected: `node_modules/` appears, `package-lock.json` is created, no errors.

If you see deprecation warnings, that's fine. If you see actual errors
(red `npm ERR!`), copy them and tell the agent.

After install, verify TypeScript and lint configs are happy:

```bash
npm run typecheck
npm run lint
```

Both should exit with no errors. (Warnings are OK.)

---

## 2. Create a Supabase project (MANUAL)

You have **two options**. For the very first run, start with **Option A
(local Supabase via Docker)** because it is fastest and 100% free.
We'll switch to a cloud Supabase project later.

### Option A - Local Supabase (recommended for first dev cycle)

The `supabase` CLI is already added as a dev dependency. Initialise the
local Supabase stack:

```bash
npx supabase init
```

If asked to generate VS Code or IntelliJ settings, say no.

Then start the local stack (this pulls Docker images the first time, ~2-3 min):

```bash
npx supabase start
```

When it finishes, you will see something like:

```
        API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: <secret>
        anon key: <anon-key>
service_role key: <service-role-key>
```

Copy:

- `API URL` -> `NEXT_PUBLIC_SUPABASE_URL`
- `anon key` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role key`-> `SUPABASE_SERVICE_ROLE_KEY`
- `DB URL` -> `DATABASE_URL` and `DIRECT_URL`

### Option B - Cloud Supabase project

1. Go to <https://supabase.com/dashboard>.
2. Click **New project**:
   - **Name**: `shopos-dev`
   - **Region**: `West EU (Ireland)`
   - **Database password**: generate strong; save it in your password manager.
3. Wait ~2 minutes for it to provision.
4. In the project, go to **Settings -> API**:
   - **Project URL** -> `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** -> `SUPABASE_SERVICE_ROLE_KEY`
5. Go to **Settings -> Database -> Connection string**:
   - **Session pooler** -> `DATABASE_URL`
   - **Direct connection** -> `DIRECT_URL`
   - Replace `[YOUR-PASSWORD]` with the DB password from step 2.

---

## 3. Configure environment variables (MANUAL)

```bash
cp .env.example .env.local
```

Open `.env.local` and paste the values you copied in step 2. The keys you
must fill for local dev are:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
DIRECT_URL
```

The other variables can stay empty until later phases.

Optional but recommended: generate an `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste the output into `AUTH_SECRET=` in `.env.local`.

---

## 4. Start the dev server (MANUAL)

```bash
npm run dev
```

Open <http://localhost:3000>. You should see the ShopOS landing page with the
"Step 1 complete" banner.

If it crashes with "Invalid client environment variables", you missed a
required var in `.env.local`. The error message tells you which.

---

## 5. (Later) Initialise a Git repository (MANUAL)

Do this once Step 4 works.

```bash
git init
git add .
git commit -m "chore: initial bootstrap (Next.js 16 + Tailwind + Supabase scaffolding)"
```

Then create a private GitHub repo:

1. <https://github.com/new>
   - **Repository name**: `shopos`
   - **Visibility**: Private
   - Do NOT initialize with README, .gitignore, or license (we already have them).
2. Push:

   ```bash
   git remote add origin git@github.com:<your-user>/shopos.git
   git branch -M main
   git push -u origin main
   ```

---

## 6. (Later) Deploy to Vercel (MANUAL)

We will only do this AFTER local everything works end-to-end and the user
("you") confirms.

Steps when we get there:

1. Go to <https://vercel.com/new>.
2. Import the `shopos` GitHub repo.
3. Framework: Next.js (auto-detected).
4. Add environment variables (copy from `.env.local`, but keep
   `NEXT_PUBLIC_APP_URL` empty for now and let Vercel set it).
5. Deploy.

For production we will switch from a local Supabase to a cloud Supabase
project in the **eu-west-1 (Ireland)** region.

---

---

## 7. Apply database migrations (MANUAL, after Step 4 of the agent)

Once the agent has shipped the schema (`supabase/migrations/*.sql`), run:

```bash
# 1. Make sure local Supabase is running
npm run supabase:status
# If not running:
npm run supabase:start

# 2. Apply all migrations and seed (dev only)
npx supabase db reset
```

`db reset` recreates the local database from scratch and applies every
migration plus `supabase/seed.sql`. It is safe to run repeatedly during dev.

If you only want to apply NEW migrations (without wiping data), use:

```bash
npx supabase migration up
```

### Verify

```bash
npm run db:studio   # opens Drizzle Studio on http://localhost:4983
```

You should see ~25 tables including `tenants`, `branches`, `products`,
`stock_ledger`, `stock_balances`, `sales`, `payments`, `pos_sessions`,
`audit_logs`, and the rest.

If any migration fails, paste the error to the agent and we will fix it.

### Create the demo auth users (one command)

The seed file creates a demo tenant + 1 branch + 1 POS terminal + 5
categories + 3 brands + 10 products + 2 suppliers, but **only links
to two demo users IF those users exist in `auth.users`.**

Just run:

```bash
npm run db:seed:auth
```

That script (`src/db/seed-auth.ts`) is idempotent. It uses the service-role
key from `.env.local` to create or update two confirmed users:

| Email                     | Password     | Role    |
| ------------------------- | ------------ | ------- |
| owner@demo.shopos.local   | DemoPass123! | owner   |
| cashier@demo.shopos.local | DemoPass123! | cashier |

It then re-applies `supabase/seed.sql` so the `user_tenants` rows get
attached to the freshly-created auth users.

You can also create users by hand via Studio at <http://127.0.0.1:54323>
(Authentication -> Users -> Add user) and then run `npx supabase db reset`
to re-link them - but the script above is faster.

---

## 8. Step 5 - Auth flow (already shipped)

When this step lands you have a real auth flow:

| Path               | Who                          | What                                     |
| ------------------ | ---------------------------- | ---------------------------------------- |
| `/login`           | signed-out                   | Email + password sign in                 |
| `/signup`          | signed-out                   | Email + password + name sign up          |
| `/forgot-password` | signed-out                   | Request a password reset email           |
| `/reset-password`  | signed-in (recovery session) | Set a new password                       |
| `/verify-email`    | anyone                       | "Check your inbox" landing after sign-up |
| `/auth/callback`   | Supabase redirects here      | Exchanges PKCE code for a session        |
| `/dashboard`       | signed-in + has a tenant     | Tenant-scoped landing                    |
| `/onboarding`      | signed-in + no tenant        | Stub - real wizard ships in Step 6       |

### Test it locally

1. Start the dev server: `npm run dev`
2. Visit <http://localhost:3000/login>
3. Sign in as `owner@demo.shopos.local` / `DemoPass123!`
4. You'll land at `/dashboard` with a "Greenway Mini Market" tenant switcher in
   the header and your role shown as `owner`.

### Test the email flows

Local Supabase ships with a built-in email server (Mailpit) on
<http://127.0.0.1:54324>. Every email sent during local dev (password reset,
sign-up confirmation when enabled) is captured there - no real emails leave
your machine.

### Enabling email confirmation locally

By default `supabase/config.toml` has `[auth.email] enable_confirmations =
false`, which is fast for local dev (sign-ups skip the email step). To test
the full email-confirmation path:

1. Open `supabase/config.toml`.
2. Find `[auth.email]` and set `enable_confirmations = true`.
3. Restart the stack: `npx supabase stop && npm run supabase:start`.
4. Sign up at `/signup` with a fresh email; you'll be redirected to
   `/verify-email`. Open Mailpit (<http://127.0.0.1:54324>), copy the link
   from the latest message, and open it - you'll be sent through
   `/auth/callback` and land on `/dashboard`.

Production will have `enable_confirmations = true` permanently.

---

## 9. Step 6 - Tenant onboarding wizard (already shipped)

A fresh user that signs up but has no tenant memberships now lands on a real
3-step wizard at `/onboarding` instead of the placeholder:

1. **Your shop** - legal name, display name, URL handle (auto-derived,
   editable; server auto-suffixes if taken), optional VAT number.
2. **First branch** - branch code (default `MAIN`), branch name, optional
   address + Eircode.
3. **Review** - confirm everything, click "Create my shop".

When the user submits, a server action calls a SECURITY DEFINER Postgres
function (`public.create_tenant_with_owner`) that atomically:

- inserts the tenant,
- inserts the first branch,
- inserts the calling user into `user_tenants` with role `owner`,
- and returns `(tenant_id, branch_id, slug)`.

The action then writes the active-tenant cookie and pushes the user to
`/dashboard`. The whole flow is covered by three live smoke tests:

```bash
npm run test:auth            # /api/health, sign-in, RLS, password reset
npm run test:onboarding      # RPC contract, 42501 on second call, slug auto-suffixing
npm run test:onboarding:app  # full path through the running dev server
```

### Try it manually

1. `npm run dev` and open <http://localhost:3000/signup>.
2. Sign up with a brand-new email (anything, e.g. `me@example.com` /
   `MyPass123!`). With the local default of `enable_confirmations = false`,
   you'll be signed in straight away.
3. You'll be redirected to `/onboarding`. Walk through the 3 steps.
4. Click **Create my shop** - you land on `/dashboard` with your shop name in
   the tenant switcher and your role as `owner`.

---

## Step 7 - Product / category / brand / supplier CRUD + bulk import

Step 7 is now live. Once you're signed in and have completed onboarding, the
top navigation gives you four new routes:

- `/products` - searchable, filterable, paginated list (active / archived / all)
- `/categories` - flat list with inline add + edit dialog
- `/brands` - same shape as categories
- `/suppliers` - list with all the IE-specific fields (Eircode, VAT number,
  payment terms, lead time...)

Plus `/products/import` for the CSV bulk import.

### What the agent built

Each entity is split into:

- `src/lib/<entity>/schemas.ts` - Zod schemas + types (importable from the
  client, no `"use server"`)
- `src/lib/<entity>/actions.ts` - server actions and queries
  (`"use server"`, all exports are async)

The shared `staffActionClient(roles)` in `src/lib/safe-action.ts` checks the
caller's role before any mutation - this matches the RLS write policy for
each table and gives users a friendly error if they don't have permission
(without leaking the raw RLS denial).

The product table uses three `LEFT JOIN`s so each row shows category, brand,
and supplier names without an N+1.

The bulk CSV importer:

1. Validates row-by-row via `parseProductsCsvAction(csvText)`. Returns each
   row tagged `ok: true` with a payload, or `ok: false` with an error string.
2. After review, the client calls `commitProductsImportAction(rows)` which
   inserts the valid rows in a single batch.
3. References (`category`, `brand`, `supplier`) are looked up by slug or name
   and resolved to UUIDs server-side. Unknown references surface as readable
   errors before any insert.

### One small DB fix in this step

The product price-history audit trigger used to run as the calling user, so
its `INSERT` was blocked by RLS the first time anyone updated a product's
price. Fixed in `supabase/migrations/20260517120000_fix_price_history_trigger.sql`
by switching the trigger function to `SECURITY DEFINER`.

### Validate Step 7

```bash
# fast checks
npm run typecheck
npm run lint
npm run build

# smoke test - DB-level CRUD + RLS for all four entities
npm run test:catalog
```

`test:catalog` boots two fresh tenants, exercises CRUD on every catalog
table, verifies the price-history trigger works, runs a 5-row bulk insert,
and asserts that one tenant cannot read or update the other's data.

### Try it manually

1. Sign in to `/dashboard` (any owner account; `owner@demo.shopos.local`
   / `Owner123!` if you ran `npm run db:seed:auth`).
2. Visit `/categories` and add **Beverages** and **Snacks**.
3. Visit `/brands` and add **Tayto**.
4. Visit `/suppliers` and click **New supplier** - fill in code `WS`, name
   "Demo Wholesale", VAT `IE1234567T`, Eircode `D07 XY12`, payment terms
   `Net 30`. Save.
5. Visit `/products/new` and add a product. Pick the category, brand, and
   supplier you just created. Set selling price `1.20`, VAT `STD`. Save.
6. Visit `/products/import`, click **Load example**, **Validate CSV**, then
   **Import** - you'll see the rows added to your catalog.
7. Switch to the `cashier@demo.shopos.local` user (different password) and
   confirm you can read but not write the catalog (the **New product** /
   **Add** buttons disappear).

---

## Step 8 - POS sale flow (cart, scan, payment, receipt, stock writes)

Step 8 turns the catalog into a working point-of-sale terminal. Every sale
flows through one atomic Postgres function (`public.commit_pos_sale`), so the
sale header, line items, payments, stock ledger writes, balance updates, and
cash-drawer movements either ALL commit together or none of them do.

### What's new

- `/pos` - full-screen POS terminal with scan/search, cart, and payment dialog
  (cash, card, contactless, and arbitrary split tenders).
- `/sales` - last 100 receipts across every branch (clickable receipt links).
- `/sales/[id]` - printable receipt: items, totals, VAT breakdown, and
  payments. The print stylesheet hides the back link and print button so
  thermal printers and A5 sheets get a clean output.
- `commit_pos_sale` RPC - SECURITY DEFINER, signed in to `authenticated`. The
  caller passes `[{product_id, qty, discount?}]` and `[{method, amount, ...}]`;
  the function reloads each product's price + VAT from the catalog (so the
  client cannot tamper with prices), computes line totals, generates a
  per-branch sequential receipt number, and writes everything in one
  transaction.
- `app.next_receipt_number` - locked + atomic counter per (tenant, branch)
  with format `<BRANCHCODE>-NNNNNN` (e.g. `MAIN-000017`).
- `app.ensure_open_pos_session` - returns or auto-opens a till session for the
  cashier. When Step 9 ships, that step's UI will open the session ahead of
  time and this helper becomes a fallback. For now you can sell without
  thinking about sessions.
- `receipt_counters` table - per-branch counter, RLS read-only for tenant
  members, written only by the SECURITY DEFINER RPC.
- Stock writes go through the existing `app.apply_stock_movement` helper
  with `from_state='available'` and `to_state=NULL` (i.e. inventory is
  decremented; the sales table is the source of truth for what was sold).
- Bug fix: `stock_balances` now uses `UNIQUE NULLS NOT DISTINCT`, so products
  without variants no longer end up with duplicate balance rows on each sale.

### MANUAL-8.1 - Apply the new migrations to your local database

If your local Supabase is already running (Step 4) just keep it running. Two
new migrations were added in `supabase/migrations/`:

- `20260517130000_init_pos_sale_rpc.sql`
- `20260517130100_fix_stock_balances_nulls.sql`

A clean `npm run supabase:start` (or `npx supabase db reset`) will pick them
up. If you want to apply them to a database that is already running without
resetting the data, run them once with psql:

```bash
psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
  -f supabase/migrations/20260517130000_init_pos_sale_rpc.sql
psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
  -f supabase/migrations/20260517130100_fix_stock_balances_nulls.sql
```

### Validate Step 8

```bash
npm run typecheck
npm run lint
npm run build
npm run test:catalog
npm run test:pos
```

`test:pos` boots two fresh tenants, seeds two products with starting stock,
commits a multi-line sale paid by cash + card, and asserts:

- the receipt + items + payments + cash-drawer movement all land,
- the stock ledger gets one outbound row per item,
- the stock balances are correctly decremented,
- a follow-up sale reuses the same open POS session,
- receipt numbers are sequential per branch,
- a different tenant cannot see or write any of the new rows,
- empty carts and under-payments are rejected with clear messages.

### Manual walkthrough for Step 8

1. Sign in to your demo tenant. Make sure you have at least one product in the
   catalog (Step 7). New shops with no products will see an empty search.
2. Visit `/products/new` and create a couple of products with sensible
   selling prices and VAT codes (e.g. one `STD` 23 % and one `ZER`).
3. Because we don't yet have a goods-receipt UI (that's Step 10), the easiest
   way to give the products some starting stock is via Supabase Studio:
   - Open `http://127.0.0.1:54323`, table `stock_balances`.
   - Insert one row per product: pick your tenant, branch, product, leave
     `variant_id` null, set `state = available`, `quantity = 50`.
4. Visit `/pos`. The branch picker should show your branch. The scan box is
   focused by default - type part of a product name and click a result to add
   it to the cart, or paste a barcode and hit Enter for a one-tap add.
5. Use **+** / **-** to adjust quantity, type a discount in EUR if you want a
   per-line discount.
6. Click **Take payment**. The dialog opens with one cash tender prefilled at
   the total. Try the **Exact card** shortcut, or click **Add another
   tender** to split between cash and card. Click **Complete sale**.
7. The receipt opens in a new tab at `/sales/<id>`. Click **Print** in the
   top-right to use the browser print dialog (the back link and Print button
   are hidden in the print stylesheet).
8. Visit `/sales` to see the receipt in the recent-sales list. Open it again,
   refresh the dashboard, and you'll see today's sales count + revenue.
9. Sign in as a cashier-only user from a different tenant and confirm you
   cannot see any of those sales (RLS is doing its job).

---

## Step 9 - Till sessions (open / close), cash drawer movements, Z-report

Step 8 sold things; Step 9 makes the till accountable. Every shift has a
proper open and close, every cash movement is journalled, and the books
balance at the end with a printable Z-report.

### What's new

- `/sessions` - list of every till session (open right now and closed
  historical), with branch, cashier, opening cash, expected, counted, and
  variance.
- `/sessions/open` - one-screen form to open a till. Pick the branch, count
  the cash already in the drawer, type a note, and click **Open till**.
- `/sessions/[id]` - **live X-report** while the session is open (refresh
  after each sale to see updated totals) plus two side-panels for the
  cashier:
  - **Record a cash movement** - cash drop to the safe, petty expense,
    pay-out, or pay-in.
  - **End the shift** - dialog to count the drawer, see expected vs counted,
    surplus/shortage, and close the till.
    When the session is closed the page becomes a **printable Z-report** with
    receipts count, items sold, gross / net / VAT / discount, payment-method
    breakdown, VAT breakdown by code, the full drawer ledger and the closing
    variance.
- New SECURITY DEFINER RPCs:
  - `public.open_pos_session(branch_id, opening_cash, terminal_id?, note?)` -
    rejects opening a second open till for the same cashier on the same
    branch; writes an `opening` row to `cash_drawer_movements` with the
    float amount.
  - `public.record_cash_movement(session_id, type, amount, reason?)` -
    writes a `pay_in`, `pay_out`, `cash_drop`, or `expense` movement on an
    open session. Refuses `sale`, `refund_out`, `opening`, and `closing`
    types (those are written by the sale / open / close flows).
  - `public.close_pos_session(session_id, counted_cash, closing_note?)` -
    computes the expected drawer balance from movements, stamps
    `expected_cash`, `counted_cash`, `closed_at`, `closed_by`, and flips
    status to `closed`. The generated column `cash_difference` then equals
    `counted_cash - expected_cash` (positive = surplus, negative = shortage).
- `commit_pos_sale` was tightened: when the caller passes an explicit
  `session_id` we now require the session to be `open`. Sales on closed
  tills are rejected (error code `22023`).
- POS page (`/pos`) now shows a small badge in the top-right: "Till open"
  with the opening time and float, or an **Open till** button if none is
  open. Auto-open is still the safety net so legacy flows keep working.
- Dashboard now shows the "Open tills" tile next to "Sales today".

### Cash math (how the variance is computed)

Expected drawer balance is the running sum of `cash_drawer_movements`:

```
expected = sum(amount where type in (opening, sale, pay_in))
         - sum(amount where type in (refund_out, cash_drop, expense, pay_out, closing))
```

`opening` is stamped by `open_pos_session`. `sale` is stamped by every
`commit_pos_sale` payment whose method is cash. `pay_in`, `pay_out`,
`cash_drop`, and `expense` come from `record_cash_movement`. The X-report
recomputes the same total live so you can spot discrepancies before closing.

### MANUAL-9.1 - Apply the new migration

A new migration was added in `supabase/migrations/`:

- `20260517140000_init_pos_session_rpcs.sql`

Either reset (`npm run supabase:start` or `npx supabase db reset`), or apply
without resetting:

```bash
psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
  -f supabase/migrations/20260517140000_init_pos_session_rpcs.sql
```

### Validate Step 9

```bash
npm run typecheck
npm run lint
npm run build
npm run test:catalog
npm run test:pos
npm run test:sessions
```

`test:sessions` boots two tenants, opens a till with a EUR 100 float, runs a
EUR 25 sale paid EUR 20 cash + EUR 5 card, records a EUR 5 pay-out, closes
with EUR 115 counted, and asserts that variance is exactly zero. It also
proves that:

- a second open on the same branch is rejected,
- `record_cash_movement` refuses `opening`/`closing` types,
- a closed session cannot accept new sales,
- closing twice is rejected,
- another tenant cannot see or mutate the session.

### Manual walkthrough for Step 9

1. Sign in. Make sure you have at least one product with stock (Step 8
   walkthrough covers seeding stock).
2. Visit `/sessions/open`. Pick your branch, enter the cash you have in the
   drawer right now (e.g. `100`), add a note like "Morning shift", and
   click **Open till**.
3. You're redirected to `/sessions/<id>` - the live X-report. The drawer
   ledger shows one row: "Opening float +EUR 100".
4. Click **Open POS** in the top-right and ring a sale paid by cash.
   Refresh the X-report - the new sale appears in the drawer ledger and the
   "Cash in" total goes up.
5. Back on the X-report, in the right-hand panel, record a **Cash drop**
   for some amount (e.g. `EUR 50` to the safe). Refresh again - you'll see
   "Cash out" go up and the expected drawer go down.
6. Click **Close till**. Type the cash you'd actually count in the drawer.
   Watch the variance hint update in real time. Click **Close till**.
7. The page becomes the printable Z-report. Click **Print** to send it to
   the browser print dialog. The variance is highlighted (green = matched,
   amber = surplus, red = shortage).
8. Try opening a second sale on the same closed session via `/pos` - the
   POS still works because it auto-opens a new till on the next sale, but
   if you copy a closed session id and POST against it directly, the RPC
   will reject the request with code `22023`.
9. Sign in as another tenant and confirm `/sessions` and the session detail
   page do not leak any of your data.

---

## Step 10 - Supplier receiving (purchase orders + goods receipts) with weighted-average cost

The agent has shipped Step 10. The shop now has a complete supplier-receiving
loop: a manager can write a purchase order, a warehouse user can record a
goods receipt against that PO (or stand-alone), and **finalising** the
receipt atomically:

1. Pushes the goods into the right branch's stock (state: `available`).
2. Updates each product's `purchase_price` using a **weighted-average cost**
   (WAC) formula:

   ```
   new_cost = (current_qty * current_cost + received_qty * receipt_unit_cost)
              / (current_qty + received_qty)
   ```

   so margin reports stay accurate when supplier prices move.

3. Increments `qty_received` on the matching PO lines and rolls the PO
   header status to `partially_received` or `received`.
4. Locks the receipt - it cannot be edited or finalised again.

### What got added

- **DB**: `purchasing_counters` (per-tenant `PO-NNNNNN` and `GR-NNNNNN`
  sequences) and three `SECURITY DEFINER` RPCs in
  `supabase/migrations/20260517150000_init_purchasing_rpcs.sql`:
  - `public.create_purchase_order(branch, supplier, items, ...)`
  - `public.create_goods_receipt(branch, supplier, items, ?po, ?invoice, ...)`
  - `public.finalise_goods_receipt(gr_id)` - the heavy one (WAC + stock +
    PO sync).
- **Library**: `src/lib/purchasing/schemas.ts`,
  `src/lib/purchasing/orders/actions.ts`,
  `src/lib/purchasing/receipts/actions.ts`. All mutations go through the
  `staffActionClient` and are restricted to `owner` / `manager` /
  `warehouse`.
- **UI**:
  - `/purchase-orders` - list with status filtering.
  - `/purchase-orders/new` - dynamic line-item grid, auto-pulled VAT codes
    - last cost, live subtotal/VAT/total preview.
  - `/purchase-orders/[id]` - PO header + lines, status actions (mark
    submitted / cancel), and **Receive goods** button.
  - `/goods-receipts`, `/goods-receipts/new`, `/goods-receipts/[id]`
    (with **Finalise & update stock** confirm-first button).
- **Top nav**: `Orders` and `Receiving` links wired in.
- **Dashboard**: tiles for `Open POs` and `Draft receipts`, status-banner
  copy moved to Step 10.

### MANUAL-10 - Validate locally

Restart the dev server if it is running:

```bash
npm run dev
```

then walk through this end-to-end flow:

1. Sign in as the owner of an existing pilot tenant.
2. **Open** `/suppliers/new` and create at least one supplier
   (e.g. _Acme Wholesale_, code `ACME`).
3. **Open** `/purchase-orders/new`:
   - Pick a branch and the supplier.
   - Add a line for one of your products: qty `10`, unit cost `1.00`, VAT
     `Standard 23%`.
   - Add a second line for another product: qty `5`, unit cost `2.00`.
   - The footer should show subtotal `EUR 20.00`, VAT `EUR 4.60`, total
     `EUR 24.60`.
   - Click **Create purchase order**. You land on the PO detail page with
     status `draft`, all lines `outstanding`.
4. On the detail page click **Mark as ordered**. The badge flips to
   `ordered` (DB enum value `submitted`) and `ordered_at` is stamped.
5. Click **Receive goods**. The new GR form is pre-filled with the
   outstanding quantities. Change the first line to qty `8` (partial
   delivery) and bump its unit cost to `1.10` (price went up). Save the
   draft.
6. On the GR detail page (status `draft`), open `/products` in another
   tab and note your product's current `purchase_price`. Click
   **Finalise & update stock** twice (confirm step).
7. Verify in the UI:
   - GR status flips to `finalised`.
   - PO status flips to `partially_received`.
   - On the PO detail page, line 1 shows `received: 8 / outstanding: 2`,
     line 2 shows `received: 5 / outstanding: 0`.
   - Refresh `/products` - line 1's product purchase price is now
     `1.1000` (we had no prior stock at that branch).
8. Click **Receive goods** again from the same PO. The form is now
   pre-filled with only the remaining 2 of line 1. Bump the unit cost to
   `1.50`, save and finalise.
9. The PO status flips to `received` and the product purchase price is
   now `1.1800` - i.e. `(8 * 1.10 + 2 * 1.50) / 10` (weighted average
   blend).
10. Sanity-check stock: open Supabase Studio (or `supabase db psql`) and
    run

    ```sql
    select product_id, branch_id, state, quantity
      from public.stock_balances
     order by product_id;
    ```

    The line-1 product should be at exactly `10` at that branch.

You can also run the full smoke test against the local stack:

```bash
npm run test:purchasing
```

`test:purchasing` boots two tenants, creates a PO with two lines, marks
it as submitted, files a partial GR, finalises it (asserting WAC + stock
ledger + PO line sync), files a second GR for the rest at a higher
price (asserting the WAC blend formula and that the PO rolls to
`received`), then verifies that another tenant cannot see or modify any
of it via RLS. Expected output: `Done: 29 pass, 0 fail`.

---

## What the agent will do automatically next

- Step 11 - Owner dashboard (daily sales, profit, low-stock, cash
  variance, top movers)
- Step 12 - Audit log + automated daily backup script
- Step 13 - PWA shell + offline POS cache (Serwist)
- Step 14 - Vitest unit tests + Playwright e2e for the POS critical path
- Step 15 - Production deploy: Vercel + Supabase prod + custom domain

Each module will tell you any new MANUAL step you need (e.g. running a
migration, granting a permission, configuring a webhook).
