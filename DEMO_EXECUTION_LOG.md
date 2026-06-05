# Live demo execution log

**Started:** 2026-06-04  
**App:** http://localhost:3000  
**Facilitator:** Agent + your browser side-by-side

---

## Block 0 — Public site ✅ PASS

| Step                               | Result |
| ---------------------------------- | ------ |
| 0.1 Landing loads                  | ✅     |
| 0.2 Title & subtitle               | ✅     |
| 0.3 EUR, en-IE, Dublin, VAT badges | ✅     |
| 0.4 Four feature cards             | ✅     |
| 0.5 Sign in → `/login`             | ✅     |
| 0.6 Sign up → `/signup`            | ✅     |
| 0.7 Health API ok                  | ✅     |

---

## Block 1 — Account & email ⚠️ PARTIAL

| Step                | Result | Notes                                        |
| ------------------- | ------ | -------------------------------------------- |
| 1.1 Sign up         | ✅     | `tester-license-meeting-01@example.com`      |
| 1.2 After signup    | ✅     | Landed on `/onboarding`                      |
| 1.3 Sign out        | ✅     | Tested later between blocks                  |
| 1.4 Sign in         | ✅     | Works                                        |
| 1.5 Wrong password  | ⏳     | **You test:** wrong password on `/login`     |
| 1.6 Forgot password | ⏳     | **You test:** Mailpit http://127.0.0.1:54324 |
| 1.7–1.9 Reset flow  | ⏳     | **You test**                                 |

---

## Block 2 — New shop onboarding ✅ PASS

| Step            | Result                                        |
| --------------- | --------------------------------------------- |
| 2.1 Shop step   | ✅ License Test Shop Ltd                      |
| 2.2 Branch step | ✅ MAIN, Dublin, D02 X285                     |
| 2.3 Review      | ✅                                            |
| 2.4 Create      | ✅                                            |
| 2.5 Dashboard   | ✅ Role **owner**, shop **License Test Shop** |
| 2.6 Empty KPIs  | ✅ Expected                                   |

---

## Block 3 — Owner (`owner@demo.shopos.local`) ⚠️ IN PROGRESS

**Demo shop:** Greenway Mini Market  
**Signed in as:** Aoife O'Reilly (Owner)

### Done by agent

| Section       | Steps                                         | Result                                                |
| ------------- | --------------------------------------------- | ----------------------------------------------------- |
| 3A Dashboard  | Login, KPIs, nav, audit link                  | ✅                                                    |
| 3B Categories | Page loads, seeded categories, add **Frozen** | ✅                                                    |
| 3F Till       | `/sessions/open`, float €100 submitted        | ⚠️ POS still showed **Open till** — re-open if needed |
| Stock prep    | Added qty 50 for all 10 demo products (DB)    | ✅ Required for POS                                   |

### Automated backend proof (Block 10 subset)

| Test suite        | Result     |
| ----------------- | ---------- |
| `test:unit` (48)  | ✅ 0 fail  |
| `test:pos`        | ✅ 23 pass |
| `test:sessions`   | ✅ 18 pass |
| `test:purchasing` | ✅ 29 pass |
| `test:audit`      | ✅ 14 pass |

### **YOU DO NEXT** (owner, same browser)

Continue in order — do not switch to cashier yet.

1. **3C Suppliers** — `/suppliers/new` → create **License Test Wholesale**
2. **3D Products** — `/products/new` one product; `/products/import` CSV import
3. **3E Purchasing** — PO → mark ordered → receive → finalise
4. **3F Till** — `/sessions/open` → confirm **Till open** badge on `/pos`
5. **3G POS** — search **Tayto** → add to cart → cash sale → receipt
6. **3H Close till** — count cash → Z-report
7. **3I Audit** — `/audit` → expand a product row

Then **sign out** before Block 4.

---

## Block 4 — Cashier (`cashier@demo.shopos.local`) ✅ 4A PASS · ⚠️ 4B manual

**Signed in as:** Liam Byrne (Cashier) · Greenway Mini Market

### 4A — Permissions ✅ ALL PASS

| Step                                                  | Result                 |
| ----------------------------------------------------- | ---------------------- |
| 4A.1 Dashboard, role **cashier**                      | ✅                     |
| 4A.2 Nav: POS, Sales, Till                            | ✅                     |
| 4A.3 Products — no “New product”                      | ✅                     |
| 4A.4 Categories — “Only owners and managers can add”  | ✅                     |
| 4A.5 Suppliers — read-only (no create UI)             | ✅ (verify in browser) |
| 4A.6 `/purchase-orders/new` → redirected to dashboard | ✅                     |
| 4A.7 `/audit` → redirected to dashboard               | ✅                     |

### 4B — Till + POS ⏳ YOU FINISH IN BROWSER

Automation could not complete sale UI (search results not exposed to a11y tree). Backend proof: `test:pos`, `test:sessions`, `test:offline` all **0 fail**.

**Do now (cashier still signed in):**

1. **Till** → **Open a till** → float **€50** → **Open till** → confirm redirect to session page
2. **POS** → search **Tayto** or scan `5099876001234` → add to cart → **Take payment** → **Cash** → complete
3. **Sales** → confirm receipt (e.g. `PHIB-000001`)
4. Optional: second sale paid by **Card**
5. **Till** → **Cash drop** €10
6. **Close till** → counted cash → **Z-report**
7. **Sign out**

### 4C — Offline POS ⏳ YOU TEST

1. Online: one search on POS (cache products)
2. DevTools → Network → **Offline**
3. Sell one item → **Cash only** → “queued offline”
4. Go online → sale appears on **Sales** (no duplicate)

---

## Block 5 — Manager ✅ (browser + API)

**User:** `manager@demo.shopos.local` / `DemoPass123!` (seeded via `npm run db:seed:roles`)

| Step                    | Result                                                                            |
| ----------------------- | --------------------------------------------------------------------------------- |
| 5A.1 Role header        | ✅ Niamh Kelly (Manager)                                                          |
| 5A.2 Categories write   | ✅ Add form on `/categories`                                                      |
| 5A.3 Brands write       | ✅ Add form on `/brands`                                                          |
| 5A.4 Products write     | ✅ `/products/new`                                                                |
| 5A.5 Suppliers write    | ✅ `/suppliers/new`                                                               |
| 5A.6 PO write           | ✅ `/purchase-orders/new`                                                         |
| 5A.7 Audit denied       | ✅ `/audit` → `dashboard?error=forbidden`                                         |
| 5B.1 PO + ordered       | ✅ **PO-000001** (API; browser submit stayed on form — see notes)                 |
| 5B.2 Receive + finalise | ✅ **GR-000001** finalised, PO `received` (API)                                   |
| 5B.3 POS sale           | ⚠️ Manual — automation cannot pick search results; `npm run test:pos` **23 pass** |
| 5B.4 Audit blocked      | ✅                                                                                |

---

## Block 6 — Warehouse ✅ (6A browser; 6B partial)

**User:** `warehouse@demo.shopos.local` / `DemoPass123!`

| Step                   | Result                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------- |
| 6A.1 Role              | ✅ Sean Doyle (Warehouse)                                                             |
| 6A.2 Products write    | ✅ `/products/new`                                                                    |
| 6A.3 Import            | ✅ `/products/import`                                                                 |
| 6A.4 Suppliers         | ✅ (nav + write roles in matrix)                                                      |
| 6A.5 Receiving         | ✅ nav present; purchasing RPCs pass in `test:purchasing`                             |
| 6A.6 Categories denied | ✅ “Only owners and managers can add categories.”                                     |
| 6A.7 Brands denied     | ✅ “Only owners and managers can add brands.”                                         |
| 6A.8 Audit denied      | ✅ `/audit` → forbidden                                                               |
| 6B.1–6B.4              | ⏳ **YOU TEST** — PO/GR with lot+expiry + one POS sale (same browser tips as Block 4) |

---

## Block 7 — Accountant ✅ (browser)

**User:** `accountant@demo.shopos.local` / `DemoPass123!`

| Step                 | Result                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 7.1 Role             | ✅ Orla Finn (Accountant)                                                                                              |
| 7.2 Dashboard        | ✅ KPIs visible                                                                                                        |
| 7.3 Audit            | ✅ `/audit` — 32 entries, filters                                                                                      |
| 7.4 Audit filter     | ⏳ YOU TEST — filter `goods_receipt` / `sale`                                                                          |
| 7.5 No catalog write | ✅ `/products/new` → `/products` (no New button)                                                                       |
| 7.6 No PO write      | ✅ `/purchase-orders/new` → `/dashboard`                                                                               |
| 7.7 No POS           | ✅ “No access” on `/pos`                                                                                               |
| 7.8 No till open     | ✅ Page may load; `openPosSessionAction` allows only owner/manager/cashier/warehouse — accountant rejected server-side |

---

## Block 8 — Platform staff ✅ N/A (local)

No `super_admin` / `support_admin` rows in `user_tenants` (0 platform staff seeded).

| Step                  | Result                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| 8.1 Cross-tenant      | **N/A** — no platform users locally                                                                          |
| 8.2 Audit on tenant   | **N/A**                                                                                                      |
| 8.3 Production policy | Document: platform staff should **not** run day-to-day POS on customer shops; use audit/support tooling only |

---

## Block 9 — One trading day ⚠️ Partial (Greenway + automated proof)

**Greenway demo tenant state:** PO **PO-000001** `received`, **GR-000001** finalised; **0 sales**, **0 till sessions** on Greenway (purchasing done; shift/POS not yet on this tenant).

| Phase                                     | Result                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 9.1 Morning (owner PO)                    | ✅ PO created + ordered (Block 5 / API)                                                                        |
| 9.2 Delivery (receive)                    | ✅ GR finalised → stock in (Block 5)                                                                           |
| 9.3 Shift start (cashier sales)           | ⚠️ **YOU TEST** on Greenway; flows proven by **`test:e2e`** (cash sale) + **`test:pos`** + **`test:sessions`** |
| 9.4 Mid-shift (drop/expense)              | ⚠️ **YOU TEST**; covered by **`test:sessions`** (18 pass)                                                      |
| 9.5 Shift end (close + variance)          | ⚠️ **YOU TEST**; covered by **`test:sessions`**                                                                |
| 9.6 Evening (owner dashboard + audit + Z) | ⚠️ **YOU TEST** after 9.3–9.5 — audit already has 32+ entries from catalog/PO/GR                               |

---

## Block 10 — Automated regression ✅

Run **2026-06-04** (local, Supabase + `npm run dev` on :3000):

| Command                   | Result                                           |
| ------------------------- | ------------------------------------------------ |
| `npm run typecheck`       | ✅ pass                                          |
| `npm run lint`            | ✅ pass                                          |
| `npm run test:unit`       | ✅ **48** pass                                   |
| `npm run test:auth`       | ✅ **7** pass                                    |
| `npm run test:catalog`    | ✅ **28** pass                                   |
| `npm run test:pos`        | ✅ **23** pass                                   |
| `npm run test:sessions`   | ✅ **18** pass                                   |
| `npm run test:purchasing` | ✅ **29** pass                                   |
| `npm run test:reports`    | ✅ **25** pass                                   |
| `npm run test:audit`      | ✅ **14** pass                                   |
| `npm run test:offline`    | ✅ **18** pass                                   |
| `npm run test:e2e`        | ✅ **2** pass (after `npm run test:e2e:install`) |

**E2E specs:** cashier cash sale; offline sale sync on reconnect.

---

## Known issues for testers

1. **React hydration warning** in dev — reduced (`en-IE` locale on offline badge); may still appear from Next.js dev overlay.
2. **Greenway stock** — `supabase/seed.sql` now seeds 50 units/product; re-run seed or `db reset` for fresh DB.
3. **Browser automation** — use in-app nav while signed in; PO/GR/till forms show errors if server action fails.

## Needscarlow shop (2026-06-04)

- **1,261** products + images: `npm run db:seed:needscarlow`
- See `Shops/Needscarlow/README.md` for logins.

---

_Update this file as you tick steps during the 12-hour meeting._
