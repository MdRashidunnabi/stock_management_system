# ShopOS — License meeting demo & test plan

**Purpose:** Step-by-step script for a **12-hour technical review** with the testing team.  
**Rule:** Complete **one block at a time**. Do **not** mix roles in the same block.  
**Product:** ShopOS v0.1.0 — Retail Operating System for Irish shops (EUR, en-IE, Europe/Dublin, Irish VAT).

---

## Important: “Supplier” is not a login role

| Term                                               | Meaning in ShopOS                                                                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Owner, Manager, Cashier, Warehouse, Accountant** | Real **user roles** — someone signs in with one of these.                                                                                                |
| **Super Admin, Support Admin**                     | **ShopOS platform staff** roles (not a shop employee).                                                                                                   |
| **Supplier**                                       | A **business record** (who you buy stock from). You manage suppliers while signed in as Owner, Manager, or Warehouse — there is **no** “supplier login”. |

This plan keeps **supplier master data** and **purchasing** inside the **Owner** and **Warehouse** tracks only, never as its own login.

---

## Roles you will test (in order)

| Order | Block                                  | Who signs in                                                    | Approx. time |
| ----- | -------------------------------------- | --------------------------------------------------------------- | ------------ |
| 0     | Environment & landing page             | Nobody / browser only                                           | 45 min       |
| 1     | Account & email (no shop yet)          | New test emails                                                 | 60 min       |
| 2     | New shop onboarding                    | Fresh owner (from signup)                                       | 45 min       |
| 3     | **Owner only** — full shop back office | `owner@demo.shopos.local`                                       | 3 h          |
| 4     | **Cashier only** — till & POS          | `cashier@demo.shopos.local`                                     | 2 h          |
| 5     | **Manager only**                       | `manager@demo.shopos.local` _(create once — see Appendix B)_    | 1.5 h        |
| 6     | **Warehouse only**                     | `warehouse@demo.shopos.local` _(create once — see Appendix B)_  | 1.5 h        |
| 7     | **Accountant only**                    | `accountant@demo.shopos.local` _(create once — see Appendix B)_ | 45 min       |
| 8     | **Platform staff** (optional)          | `support_admin` / `super_admin` _(if provisioned)_              | 30 min       |
| 9     | End-to-end “one trading day”           | Owner → Cashier → Owner                                         | 1 h          |
| —     | Sign-off & automated tests             | Lead tester                                                     | 30 min       |

**Total:** ~12 hours with short breaks between blocks.

---

## Before the meeting (facilitator — do not skip)

### A. Start services

```bash
cd "/home/md-rashidunnabi/Desktop/Software Development Projects/Stock Management System"
npm run supabase:status    # must say "running"
npm run dev                # http://localhost:3000
```

### B. Reset demo data (recommended for a clean license run)

```bash
npx supabase db reset
npm run db:seed:auth
```

### C. Confirm health

- Open http://localhost:3000 — landing page (see Block 0).
- Open http://localhost:3000/api/health — should show `"status":"ok"`.
- Mailpit (local emails): http://127.0.0.1:54324
- Supabase Studio (optional): http://127.0.0.1:54323

### D. Demo credentials (after `db:seed:auth`)

| Email                       | Password       | Role    | Shop                 |
| --------------------------- | -------------- | ------- | -------------------- |
| `owner@demo.shopos.local`   | `DemoPass123!` | Owner   | Greenway Mini Market |
| `cashier@demo.shopos.local` | `DemoPass123!` | Cashier | Greenway Mini Market |

### E. Prepare two browsers

- **Browser A** — Owner / back office
- **Browser B** — Cashier (or use private/incognito when switching roles)

Always **sign out** before the next role block.

---

## How to use each step

Every step has:

- **Goal** — what you are proving
- **Steps** — do in order
- **Pass** — tick when OK
- **Fail** — note URL, role, and screenshot for the dev team

At the end of each block, fill in the **Block sign-off** table.

---

# Block 0 — Public site (no login)

**Screenshot reference:** Landing page at http://localhost:3000 (ShopOS Ireland v0.1.0, four feature cards, Sign in / Create account).

| Step | Goal             | Steps                                                                                                           | Pass |
| ---- | ---------------- | --------------------------------------------------------------------------------------------------------------- | ---- |
| 0.1  | App is reachable | Open http://localhost:3000                                                                                      | ☐    |
| 0.2  | Branding & scope | Confirm title: “The Retail Operating System for Irish Shops”; subtitle mentions POS, stock, suppliers, branches | ☐    |
| 0.3  | Ireland settings | Confirm badges: EUR, en-IE, Europe/Dublin, VAT rates 23% / 13.5% / 9% / 4.8% / 0%                               | ☐    |
| 0.4  | Feature cards    | Read four cards: POS, Stock Ledger, Multi-branch, Owner Reports                                                 | ☐    |
| 0.5  | Sign in entry    | Click **Sign in** → must reach `/login`                                                                         | ☐    |
| 0.6  | Sign up entry    | Go back; click **Create an account** → must reach `/signup`                                                     | ☐    |
| 0.7  | Health API       | Open http://localhost:3000/api/health → JSON with `"status":"ok"`                                               | ☐    |

**Block 0 sign-off**

| Tester | Date | Pass / Fail | Notes |
| ------ | ---- | ----------- | ----- |
|        |      |             |       |

---

# Block 1 — Account & email (signed out)

Use a **new email** not used before, e.g. `tester-licensing-01@example.com` / `DemoPass123!`

Do **not** use demo owner/cashier in this block.

| Step | Goal                      | Steps                                                                        | Pass |
| ---- | ------------------------- | ---------------------------------------------------------------------------- | ---- |
| 1.1  | Sign up                   | `/signup` → name, email, password → submit                                   | ☐    |
| 1.2  | Post-signup route         | Land on `/onboarding` or `/dashboard` (local config may skip email confirm)  | ☐    |
| 1.3  | Sign out                  | Use sign out in header (if visible) or clear session; confirm `/login` works | ☐    |
| 1.4  | Sign in                   | `/login` with same email/password → success                                  | ☐    |
| 1.5  | Wrong password            | Wrong password → clear error, no access to dashboard                         | ☐    |
| 1.6  | Forgot password           | `/forgot-password` → enter email → submit                                    | ☐    |
| 1.7  | Email captured            | Open Mailpit http://127.0.0.1:54324 → reset email present                    | ☐    |
| 1.8  | Reset password            | Open link from email → set new password on `/reset-password`                 | ☐    |
| 1.9  | Sign in with new password | Login with new password works                                                | ☐    |

**Block 1 sign-off**

| Tester | Date | Pass / Fail | Notes |
| ------ | ---- | ----------- | ----- |
|        |      |             |       |

---

# Block 2 — New shop onboarding (fresh owner)

**Who:** The user you created in Block 1 (still **not** demo owner).

**Precondition:** Signed in, **no** shop yet → must see `/onboarding`.

| Step | Goal          | Steps                                                             | Pass |
| ---- | ------------- | ----------------------------------------------------------------- | ---- |
| 2.1  | Wizard step 1 | Legal name, display name, slug (auto), optional VAT → **Next**    | ☐    |
| 2.2  | Wizard step 2 | Branch code (e.g. MAIN), branch name, address, Eircode → **Next** | ☐    |
| 2.3  | Wizard step 3 | Review all fields                                                 | ☐    |
| 2.4  | Create shop   | **Create my shop** → redirect to `/dashboard`                     | ☐    |
| 2.5  | Header        | Shop name in header; role shows **owner**                         | ☐    |
| 2.6  | Empty state   | Dashboard may show zeros / empty lists (no sales yet) — OK        | ☐    |

**Sign out** before Block 3.

**Block 2 sign-off**

| Tester | Date | Pass / Fail | Notes |
| ------ | ---- | ----------- | ----- |
|        |      |             |       |

---

# Block 3 — Owner only (`owner@demo.shopos.local`)

**Sign in:** `owner@demo.shopos.local` / `DemoPass123!`  
**Shop:** Greenway Mini Market  
**Do not** sign in as cashier, manager, or warehouse during this block.

---

## 3A — Owner dashboard

| Step  | Goal            | Steps                                                                 | Pass |
| ----- | --------------- | --------------------------------------------------------------------- | ---- |
| 3A.1  | Dashboard loads | Open `/dashboard`                                                     | ☐    |
| 3A.2  | Period tabs     | Switch **Today** → **Last 7 days** → **Last 30 days**; numbers update | ☐    |
| 3A.3  | KPI row 1       | See Revenue, Gross profit, Avg basket, Cash variance                  | ☐    |
| 3A.4  | KPI row 2       | See Sales count, Open tills, Open POs, Draft receipts                 | ☐    |
| 3A.5  | Chart           | “Daily revenue (last 14 days)” chart visible                          | ☐    |
| 3A.6  | Top movers      | Table lists products (may be empty on fresh DB)                       | ☐    |
| 3A.7  | Low stock       | Section visible (may say none)                                        | ☐    |
| 3A.8  | Recent shifts   | Till shifts list visible                                              | ☐    |
| 3A.9  | Quick actions   | Buttons: Take payment, New purchase order, Open till, Recent sales    | ☐    |
| 3A.10 | Audit shortcut  | **View audit log** visible for owner                                  | ☐    |

---

## 3B — Owner: categories & brands

| Step | Goal            | Steps                                                     | Pass |
| ---- | --------------- | --------------------------------------------------------- | ---- |
| 3B.1 | Categories list | `/categories` → see seeded categories (Drinks, Snacks, …) | ☐    |
| 3B.2 | Add category    | Add e.g. **Frozen** → appears in list                     | ☐    |
| 3B.3 | Edit category   | Rename or edit **Frozen** → saves                         | ☐    |
| 3B.4 | Brands list     | `/brands` → see Tayto, Brennans, Kerrygold                | ☐    |
| 3B.5 | Add brand       | Add e.g. **Barry's Tea** → appears                        | ☐    |

---

## 3C — Owner: supplier records (data, not a login)

| Step | Goal            | Steps                                                                                                     | Pass |
| ---- | --------------- | --------------------------------------------------------------------------------------------------------- | ---- |
| 3C.1 | Supplier list   | `/suppliers` → see demo suppliers                                                                         | ☐    |
| 3C.2 | New supplier    | `/suppliers/new` → code `TEST`, name `License Test Wholesale`, VAT `IE1234567T`, Eircode `D02 X285`, save | ☐    |
| 3C.3 | Supplier detail | Open supplier → details correct                                                                           | ☐    |
| 3C.4 | Edit supplier   | Change phone or contact → save                                                                            | ☐    |

---

## 3D — Owner: products & import

| Step | Goal           | Steps                                                                                                        | Pass |
| ---- | -------------- | ------------------------------------------------------------------------------------------------------------ | ---- |
| 3D.1 | Product list   | `/products` → see seeded products                                                                            | ☐    |
| 3D.2 | Filters        | Try active / archived / all if available                                                                     | ☐    |
| 3D.3 | New product    | `/products/new` → name, SKU, barcode, category, brand, supplier, purchase & selling price, VAT **STD**, save | ☐    |
| 3D.4 | Product detail | Open product → all fields shown                                                                              | ☐    |
| 3D.5 | Edit product   | Change selling price → save                                                                                  | ☐    |
| 3D.6 | CSV import     | `/products/import` → **Load example** → **Validate CSV** → review rows → **Import**                          | ☐    |
| 3D.7 | Import visible | New rows appear on `/products`                                                                               | ☐    |

---

## 3E — Owner: purchase orders & receiving

| Step  | Goal                 | Steps                                                                                                  | Pass |
| ----- | -------------------- | ------------------------------------------------------------------------------------------------------ | ---- |
| 3E.1  | PO list              | `/purchase-orders`                                                                                     | ☐    |
| 3E.2  | Create PO            | `/purchase-orders/new` → branch, supplier **License Test Wholesale**, 2 lines with qty & cost → create | ☐    |
| 3E.3  | PO detail            | Status **draft**; lines show outstanding                                                               | ☐    |
| 3E.4  | Mark ordered         | **Mark as ordered** → status becomes ordered/submitted                                                 | ☐    |
| 3E.5  | Start receiving      | **Receive goods** → goods receipt form pre-filled                                                      | ☐    |
| 3E.6  | Save draft GR        | Adjust qty (e.g. partial delivery) → save draft                                                        | ☐    |
| 3E.7  | Finalise GR          | On GR detail → **Finalise & update stock** (confirm twice)                                             | ☐    |
| 3E.8  | Stock effect         | PO shows partial/complete received; product purchase price updated if applicable                       | ☐    |
| 3E.9  | GR list              | `/goods-receipts` → finalised receipt listed                                                           | ☐    |
| 3E.10 | Cancel PO (optional) | Create second PO → **Cancel** while draft — does not change stock                                      | ☐    |

---

## 3F — Owner: till (sessions)

| Step | Goal             | Steps                                                                         | Pass |
| ---- | ---------------- | ----------------------------------------------------------------------------- | ---- |
| 3F.1 | Session list     | `/sessions`                                                                   | ☐    |
| 3F.2 | Open till        | `/sessions/open` → branch, opening cash e.g. **100.00**, note → **Open till** | ☐    |
| 3F.3 | Live session     | Redirect to `/sessions/[id]` — X-report, opening float in ledger              | ☐    |
| 3F.4 | Cash drop        | Record **Cash drop** e.g. 20.00 with reason                                   | ☐    |
| 3F.5 | Pay-in / expense | Record one **Pay-in** and one **Petty expense**                               | ☐    |

---

## 3G — Owner: POS & sales

| Step  | Goal          | Steps                                                  | Pass |
| ----- | ------------- | ------------------------------------------------------ | ---- |
| 3G.1  | POS access    | `/pos` — terminal loads, branch picker, search focused | ☐    |
| 3G.2  | Till badge    | Header shows **Till open** linked to session           | ☐    |
| 3G.3  | Add to cart   | Search product → add → adjust qty                      | ☐    |
| 3G.4  | Line discount | Apply line discount if UI allows                       | ☐    |
| 3G.5  | VAT on cart   | Cart shows VAT breakdown                               | ☐    |
| 3G.6  | Cash sale     | **Take payment** → cash for full amount → complete     | ☐    |
| 3G.7  | Receipt       | Receipt opens; **Print** works (print preview OK)      | ☐    |
| 3G.8  | Split payment | Second sale: cash + card split → completes             | ☐    |
| 3G.9  | Sales list    | `/sales` — both sales listed                           | ☐    |
| 3G.10 | Sale detail   | Open sale — lines, VAT, payments correct               | ☐    |
| 3G.11 | Stock down    | (Optional) Dashboard revenue / sales count increased   | ☐    |

---

## 3H — Owner: close till & Z-report

| Step | Goal              | Steps                                             | Pass |
| ---- | ----------------- | ------------------------------------------------- | ---- |
| 3H.1 | Return to session | `/sessions/[id]` for open till                    | ☐    |
| 3H.2 | X-report updated  | Sales appear in live totals after 3G              | ☐    |
| 3H.3 | Close till        | **Close till** → enter counted cash → confirm     | ☐    |
| 3H.4 | Variance          | Surplus/shortage shown (green/amber/red)          | ☐    |
| 3H.5 | Z-report          | Printable Z-report: payments, VAT, cash movements | ☐    |
| 3H.6 | Print Z           | **Print** on Z-report — layout clean              | ☐    |

---

## 3I — Owner: audit log

| Step | Goal            | Steps                                                                 | Pass |
| ---- | --------------- | --------------------------------------------------------------------- | ---- |
| 3I.1 | Audit page      | `/audit` — loads (not forbidden)                                      | ☐    |
| 3I.2 | Entries present | Rows for tenant, branch, products, suppliers, PO, GR, sessions, sales | ☐    |
| 3I.3 | Filter entity   | Filter **product** — only product events                              | ☐    |
| 3I.4 | Expand row      | Click row → Field / Before / After diff                               | ☐    |
| 3I.5 | Search          | Free-text search finds a known product name or id                     | ☐    |

**Sign out** before Block 4.

**Block 3 sign-off**

| Tester | Date | Pass / Fail | Notes |
| ------ | ---- | ----------- | ----- |
|        |      |             |       |

---

# Block 4 — Cashier only (`cashier@demo.shopos.local`)

**Sign in:** `cashier@demo.shopos.local` / `DemoPass123!`  
**Do not** use owner account in this block.

---

## 4A — Cashier: what they should see

| Step | Goal                 | Steps                                                | Pass |
| ---- | -------------------- | ---------------------------------------------------- | ---- |
| 4A.1 | Dashboard            | `/dashboard` loads; role shows **cashier**           | ☐    |
| 4A.2 | Nav                  | Can reach POS, Sales, Till                           | ☐    |
| 4A.3 | Products read-only   | `/products` — **no** New product / Import buttons    | ☐    |
| 4A.4 | Categories read-only | `/categories` — cannot add category                  | ☐    |
| 4A.5 | Suppliers read-only  | `/suppliers` — cannot create supplier                | ☐    |
| 4A.6 | Orders forbidden     | `/purchase-orders/new` — blocked or no permission    | ☐    |
| 4A.7 | Audit forbidden      | `/audit` → redirect or forbidden (not full audit UI) | ☐    |

---

## 4B — Cashier: till + POS (full shift)

| Step | Goal          | Steps                                        | Pass |
| ---- | ------------- | -------------------------------------------- | ---- |
| 4B.1 | Open till     | `/sessions/open` → open with float **50.00** | ☐    |
| 4B.2 | POS           | `/pos` → sell 1 item, **cash** payment       | ☐    |
| 4B.3 | Receipt       | Receipt number format e.g. `PHIB-0000xx`     | ☐    |
| 4B.4 | Card sale     | Sell 1 item, **card** (or contactless)       | ☐    |
| 4B.5 | Cash movement | Cash drop **10.00** on open session          | ☐    |
| 4B.6 | Close till    | Count cash → close → Z-report                | ☐    |

---

## 4C — Cashier: offline POS (critical for license)

| Step | Goal            | Steps                                                                 | Pass |
| ---- | --------------- | --------------------------------------------------------------------- | ---- |
| 4C.1 | Seed cache      | Online: `/pos` → search & view products (populates offline cache)     | ☐    |
| 4C.2 | Go offline      | Chrome DevTools → Network → **Offline** (or Application → SW offline) | ☐    |
| 4C.3 | POS still loads | Refresh `/pos` — page works                                           | ☐    |
| 4C.4 | Offline search  | Search cached product — results appear                                | ☐    |
| 4C.5 | Offline sale    | Add to cart → pay — **only Cash** → “queued offline” toast            | ☐    |
| 4C.6 | Go online       | Disable offline mode                                                  | ☐    |
| 4C.7 | Auto sync       | Within ~30s, sale appears on `/sales`; queue count returns to 0       | ☐    |
| 4C.8 | No duplicate    | Same receipt id — not duplicated on `/sales`                          | ☐    |

**Sign out** before Block 5.

**Block 4 sign-off**

| Tester | Date | Pass / Fail | Notes |
| ------ | ---- | ----------- | ----- |
|        |      |             |       |

---

# Block 5 — Manager only (`manager@demo.shopos.local`)

**Precondition:** Create user and membership — **Appendix B.1** (one-time).

**Sign in:** `manager@demo.shopos.local` / `DemoPass123!`

---

## 5A — Manager: permissions matrix

| Step | Goal             | Steps                                                 | Pass |
| ---- | ---------------- | ----------------------------------------------------- | ---- |
| 5A.1 | Role in header   | Shows **manager**                                     | ☐    |
| 5A.2 | Categories write | `/categories` — **can** add category                  | ☐    |
| 5A.3 | Brands write     | `/brands` — **can** add brand                         | ☐    |
| 5A.4 | Products write   | `/products/new` — **can** create product              | ☐    |
| 5A.5 | Suppliers write  | `/suppliers/new` — **can** create supplier            | ☐    |
| 5A.6 | Purchasing write | `/purchase-orders/new` — **can** create PO            | ☐    |
| 5A.7 | Audit denied     | `/audit` — **forbidden** (manager must not see audit) | ☐    |

---

## 5B — Manager: do one complete mini-flow

| Step | Goal                          | Steps                                      | Pass |
| ---- | ----------------------------- | ------------------------------------------ | ---- |
| 5B.1 | Create PO                     | One PO, mark ordered                       | ☐    |
| 5B.2 | Receive                       | Goods receipt → finalise                   | ☐    |
| 5B.3 | Sell on POS                   | `/pos` — one cash sale                     | ☐    |
| 5B.4 | Cannot close owner-only items | Confirm no Audit nav or audit page blocked | ☐    |

**Sign out** before Block 6.

**Block 5 sign-off**

| Tester | Date | Pass / Fail | Notes |
| ------ | ---- | ----------- | ----- |
|        |      |             |       |

---

# Block 6 — Warehouse only (`warehouse@demo.shopos.local`)

**Precondition:** Appendix B.2.

**Sign in:** `warehouse@demo.shopos.local` / `DemoPass123!`

---

## 6A — Warehouse: allowed vs denied

| Step | Goal              | Steps                                   | Pass |
| ---- | ----------------- | --------------------------------------- | ---- |
| 6A.1 | Role              | Header shows **warehouse**              | ☐    |
| 6A.2 | Products write    | **Can** add/edit product                | ☐    |
| 6A.3 | Import            | **Can** use `/products/import`          | ☐    |
| 6A.4 | Suppliers write   | **Can** edit supplier                   | ☐    |
| 6A.5 | Receiving         | **Can** create & finalise goods receipt | ☐    |
| 6A.6 | Categories denied | `/categories` — **cannot** add category | ☐    |
| 6A.7 | Brands denied     | `/brands` — **cannot** add brand        | ☐    |
| 6A.8 | Audit denied      | `/audit` — forbidden                    | ☐    |

---

## 6B — Warehouse: receiving-focused flow

| Step | Goal               | Steps                                                                          | Pass |
| ---- | ------------------ | ------------------------------------------------------------------------------ | ---- |
| 6B.1 | PO                 | Create PO as warehouse user                                                    | ☐    |
| 6B.2 | GR with lot/expiry | On receipt line, set **expiry date** and **lot number** if fields shown        | ☐    |
| 6B.3 | Finalise           | Finalise → stock increases                                                     | ☐    |
| 6B.4 | POS allowed        | `/pos` — can complete one sale (warehouse may sell if shop uses them on floor) | ☐    |

**Sign out** before Block 7.

**Block 6 sign-off**

| Tester | Date | Pass / Fail | Notes |
| ------ | ---- | ----------- | ----- |
|        |      |             |       |

---

# Block 7 — Accountant only (`accountant@demo.shopos.local`)

**Precondition:** Appendix B.3.

**Sign in:** `accountant@demo.shopos.local` / `DemoPass123!`

| Step | Goal             | Steps                                             | Pass |
| ---- | ---------------- | ------------------------------------------------- | ---- |
| 7.1  | Role             | Header shows **accountant**                       | ☐    |
| 7.2  | Dashboard read   | `/dashboard` — KPIs visible (read-only oversight) | ☐    |
| 7.3  | Audit access     | `/audit` — **full access**                        | ☐    |
| 7.4  | Audit filter     | Filter by **sale** or **goods_receipt**           | ☐    |
| 7.5  | No catalog write | `/products/new` — blocked or no button            | ☐    |
| 7.6  | No PO write      | `/purchase-orders/new` — blocked                  | ☐    |
| 7.7  | No POS           | `/pos` — “No access” or permission error          | ☐    |
| 7.8  | No till open     | `/sessions/open` — blocked or fails on submit     | ☐    |

**Sign out** before Block 8.

**Block 7 sign-off**

| Tester | Date | Pass / Fail | Notes |
| ------ | ---- | ----------- | ----- |
|        |      |             |       |

---

# Block 8 — Platform staff (Super Admin / Support Admin)

**Note:** These are **ShopOS company** roles, not shop staff. Local demo may not include them unless you seed manually (Appendix B.4).

If not available, mark block **N/A** and document for production.

| Step | Goal                   | Steps                                                                 | Pass |
| ---- | ---------------------- | --------------------------------------------------------------------- | ---- |
| 8.1  | Cross-tenant           | Support admin can switch tenants if multi-tenant user                 | ☐    |
| 8.2  | Audit                  | Can open `/audit` on a tenant                                         | ☐    |
| 8.3  | No accidental shop ops | Document whether platform staff should use POS in production (policy) | ☐    |

**Block 8 sign-off**

| Tester | Date | Pass / Fail | N/A |
| ------ | ---- | ----------- | --- |
|        |      |             |     |

---

# Block 9 — End-to-end “one trading day” (roles in sequence)

Run **once** with clear handoffs. Use demo shop only.

| Phase           | Role               | Actions                                                                        | Pass |
| --------------- | ------------------ | ------------------------------------------------------------------------------ | ---- |
| 9.1 Morning     | Owner              | Check dashboard → create PO → mark ordered                                     | ☐    |
| 9.2 Delivery    | Owner or Warehouse | Receive goods → finalise → stock in                                            | ☐    |
| 9.3 Shift start | Cashier            | Open till → 3 sales (cash, card, split)                                        | ☐    |
| 9.4 Mid-shift   | Cashier            | Cash drop + petty expense                                                      | ☐    |
| 9.5 Shift end   | Cashier            | Close till — note variance                                                     | ☐    |
| 9.6 Evening     | Owner              | Dashboard reflects sales → audit log shows full trail → Z-report matches sales | ☐    |

**Block 9 sign-off**

| Tester | Date | Pass / Fail | Notes |
| ------ | ---- | ----------- | ----- |
|        |      |             |       |

---

# Block 10 — Automated regression (facilitator)

Run while testers break or at end:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:auth
npm run test:catalog
npm run test:pos
npm run test:sessions
npm run test:purchasing
npm run test:reports
npm run test:audit
npm run test:offline
npm run test:e2e
```

| Command   | Expected                               | Pass |
| --------- | -------------------------------------- | ---- |
| All above | Exit code 0; smoke tests report 0 fail | ☐    |

---

# License meeting — final sign-off

| Area                       | Owner tested                     | Cashier tested | Manager tested | Warehouse tested | Accountant tested | Automated tests |
| -------------------------- | -------------------------------- | -------------- | -------------- | ---------------- | ----------------- | --------------- |
| Auth & onboarding          | ☐                                | —              | —              | —                | —                 | ☐               |
| Dashboard & reports        | ☐                                | ☐ read         | ☐              | ☐                | ☐ read            | ☐               |
| Catalog                    | ☐                                | ☐ read         | ☐              | ☐ partial        | ☐ deny            | ☐               |
| Supplier **records**       | ☐                                | ☐ read         | ☐              | ☐                | ☐ deny            | ☐               |
| Purchasing & receiving     | ☐                                | ☐ deny         | ☐              | ☐                | ☐ deny            | ☐               |
| Till & Z-report            | ☐                                | ☐              | ☐              | ☐                | ☐ deny            | ☐               |
| POS & receipts             | ☐                                | ☐              | ☐              | ☐                | ☐ deny            | ☐               |
| Offline POS                | —                                | ☐              | —              | —                | —                 | ☐               |
| Audit log                  | ☐                                | ☐ deny         | ☐ deny         | ☐ deny           | ☐                 | ☐               |
| **License recommendation** | ☐ Approve ☐ Conditional ☐ Reject |                |                |                  |                   |                 |

**Lead tester name:** ****\*\*****\_\_\_****\*\*****  
**Date:** ****\*\*****\_\_\_****\*\*****  
**Signature:** ****\*\*****\_\_\_****\*\*****

---

# Appendix A — URL quick reference

| Page            | URL                                   |
| --------------- | ------------------------------------- |
| Landing         | http://localhost:3000                 |
| Login           | http://localhost:3000/login           |
| Sign up         | http://localhost:3000/signup          |
| Onboarding      | http://localhost:3000/onboarding      |
| Dashboard       | http://localhost:3000/dashboard       |
| POS             | http://localhost:3000/pos             |
| Sales           | http://localhost:3000/sales           |
| Till list       | http://localhost:3000/sessions        |
| Open till       | http://localhost:3000/sessions/open   |
| Products        | http://localhost:3000/products        |
| Import          | http://localhost:3000/products/import |
| Categories      | http://localhost:3000/categories      |
| Brands          | http://localhost:3000/brands          |
| Suppliers       | http://localhost:3000/suppliers       |
| Purchase orders | http://localhost:3000/purchase-orders |
| Goods receipts  | http://localhost:3000/goods-receipts  |
| Audit           | http://localhost:3000/audit           |
| Mailpit         | http://127.0.0.1:54324                |
| Supabase Studio | http://127.0.0.1:54323                |

---

# Appendix B — Create extra demo users (Manager, Warehouse, Accountant)

Do **once** before Blocks 5–7.

**Recommended (local):**

```bash
npm run db:seed:roles
```

Creates `manager@demo.shopos.local`, `warehouse@demo.shopos.local`, and `accountant@demo.shopos.local` (password `DemoPass123!`) and links them to the Greenway tenant.

**Alternative:** Supabase Studio → Authentication → Users → Add user (email confirmed).

**Tenant id (Greenway):** `00000000-0000-0000-0000-000000000001`  
**Branch id (Phibsborough):** `00000000-0000-0000-0000-000000000010`

After creating each auth user, run in SQL editor (Studio → SQL):

```sql
-- Replace <USER_UUID> with the new user's id from Authentication → Users

-- Manager
insert into public.user_tenants (user_id, tenant_id, role, is_active, accepted_at)
values ('<USER_UUID>', '00000000-0000-0000-0000-000000000001', 'manager', true, now())
on conflict do nothing;

-- Warehouse (attach to branch)
insert into public.user_tenants (user_id, tenant_id, role, branch_id, is_active, accepted_at)
values ('<USER_UUID>', '00000000-0000-0000-0000-000000000001', 'warehouse',
        '00000000-0000-0000-0000-000000000010', true, now())
on conflict do nothing;

-- Accountant
insert into public.user_tenants (user_id, tenant_id, role, is_active, accepted_at)
values ('<USER_UUID>', '00000000-0000-0000-0000-000000000001', 'accountant', true, now())
on conflict do nothing;
```

Suggested emails (password `DemoPass123!` for all):

| Email                          | Role       |
| ------------------------------ | ---------- |
| `manager@demo.shopos.local`    | manager    |
| `warehouse@demo.shopos.local`  | warehouse  |
| `accountant@demo.shopos.local` | accountant |

---

# Appendix C — Role vs feature matrix (reference for testers)

| Feature                     | Owner | Manager | Cashier | Warehouse | Accountant |
| --------------------------- | :---: | :-----: | :-----: | :-------: | :--------: |
| Dashboard KPIs              |   ✓   |    ✓    |    ✓    |     ✓     |   ✓ read   |
| Categories / brands (write) |   ✓   |    ✓    |    —    |     —     |     —      |
| Products / import (write)   |   ✓   |    ✓    |    —    |     ✓     |     —      |
| Supplier records (write)    |   ✓   |    ✓    |    —    |     ✓     |     —      |
| Purchase orders & receiving |   ✓   |    ✓    |    —    |     ✓     |     —      |
| Open / close till           |   ✓   |    ✓    |    ✓    |     ✓     |     —      |
| POS sell                    |   ✓   |    ✓    |    ✓    |     ✓     |     —      |
| Offline POS                 |   ✓   |    ✓    |    ✓    |     ✓     |     —      |
| Sales history               |   ✓   |    ✓    |    ✓    |     ✓     |   ✓ read   |
| Audit log                   |   ✓   |    —    |    —    |     —     |     ✓      |
| Tenant switcher             |  ✓\*  |   ✓\*   |   ✓\*   |    ✓\*    |    ✓\*     |

\*Only if user belongs to multiple shops.

---

# Appendix D — Defect log (use during meeting)

| ID  | Block | Step | Role | What happened | Expected | Severity |
| --- | ----- | ---- | ---- | ------------- | -------- | -------- |
| 1   |       |      |      |               |          |          |
| 2   |       |      |      |               |          |          |

---

_Document version: 2026-06-04 — aligned with ShopOS Step 14 (local dev). Update after production deploy (Step 15)._
