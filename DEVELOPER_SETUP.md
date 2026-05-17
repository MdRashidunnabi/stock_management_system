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

## What the agent will do automatically next

- Step 8 - POS sale flow (cart + scan + payment + receipt + stock writes)
- Step 9 - Till open/close
- Step 10 - Supplier receiving
- Step 11 - Owner dashboard
- Step 12 - Audit log + backups
- Step 13 - PWA shell + offline POS
- Step 14 - Tests

Each module will tell you any new MANUAL step you need (e.g. running a
migration, granting a permission, configuring a webhook).
