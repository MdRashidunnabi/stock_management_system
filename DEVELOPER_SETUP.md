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

### Create the demo auth users (one-off)

The seed file creates a demo tenant + 1 branch + 1 POS terminal + 5
categories + 3 brands + 10 products + 2 suppliers, but **only links
to two demo users IF those users exist in `auth.users`.** Create them
via Supabase Studio:

1. Open <http://127.0.0.1:54323> (the Studio URL printed by `supabase start`).
2. Go to **Authentication -> Users -> Add user -> Create new user**.
3. Create:
   - Email: `owner@demo.shopos.local` Password: `DemoPass123!`
   - Email: `cashier@demo.shopos.local` Password: `DemoPass123!`
4. Re-apply seed to link the users:

   ```bash
   npx supabase db reset    # easiest; wipes and reapplies seed
   ```

We will replace this manual step with a real signup flow in Step 5.

---

## What the agent will do automatically

After you finish steps 1-7 above, the agent will continue with:

- Step 5 - Auth flow (login, signup, password reset, tenant context)
- Step 6 - Tenant onboarding wizard (replaces the manual demo user creation)
- Step 7 - Product CRUD
- Step 8 - POS sale flow
- Step 9 - Till open/close
- Step 10 - Supplier receiving
- Step 11 - Owner dashboard
- Step 12 - Audit log + backups
- Step 13 - PWA shell + offline POS
- Step 14 - Tests

Each module will tell you any new MANUAL step you need (e.g. running a
migration, granting a permission, configuring a webhook).
