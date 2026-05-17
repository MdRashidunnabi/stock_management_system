# Retail POS + Stock + Online + Multi-Branch SaaS for Portugal — Full Business & Software Plan

Document owner: Founder / CEO of the software company
Document type: Master strategic and technical plan (pre-build)
Region: Portugal (mainland + Madeira/Azores noted where relevant)
Status: Draft v1 — approved for team kickoff once signed off

> Important disclaimer: This document is a strategic and technical plan, not legal, tax, or accounting advice. All references to Portuguese fiscal rules (certified invoicing, ATCUD, QR code, SAF-T (PT), IVA/VAT, electronic invoicing, GDPR specifics, PCI DSS) must be verified with a Portuguese certified accountant (TOC/CC), a tax/legal advisor, and where relevant the Autoridade Tributária e Aduaneira (AT) and CNPD before go-live.

---

## 1. Executive Summary

We will build and sell a multi-tenant SaaS platform called (working name) **ShopOS** — a Retail Business Operating System that runs the entire daily operation of a small or medium Portuguese shop: point of sale, inventory, supplier receiving, multi-branch control, online store on the same stock, customer management, expenses, and owner reports.

The product will be sold as a monthly/yearly subscription to:

- Mini mercados, mercearias, grocery shops, halal/ethnic shops, butchers, bakeries
- Clothing shops, phone & accessory shops, small electronics shops
- Local wholesalers and small distributors
- Cafés and small restaurants (later phase)
- Small multi-branch chains (2–10 locations)

Why this can be profitable in Portugal:

- There are tens of thousands of small independent shops in Portugal, the majority still using a mix of pen-and-paper, Excel, and a basic certified invoicing tool that does **not** properly manage stock, suppliers, or branches.
- Owners are losing money daily through unknown stock, cash mismatches, expired products, and lack of profit visibility — a clear, painful, recurring problem.
- Existing Portuguese tools (Vendus, Moloni, Sage, PHC, Primavera, ZsRest, Inovflow, KiTPOS, Faturalo, Invoicexpress, etc.) tend to be either invoicing-first (weak stock), restaurant-first, or enterprise-priced. There is space for an owner-friendly, stock-first, multi-channel SaaS for the under-served independent retailer.
- Portugal is small enough to dominate a niche with focused local sales and large enough (≈10.6M population, 1M+ active companies, very high small-retail density) to support a 7–8 figure ARR business if executed well.
- Recurring SaaS revenue + setup fees + hardware margin + support packages = compounding, defensible business.

12-month commercial target (realistic, see §14): 50–80 paying shops, €4.5k–€9k MRR, ≥1 multi-branch reference customer, certified invoicing path validated, 2 channel partners signed.

---

## 2. Problem Statement

Real, repeated pain points observed in Portuguese small and medium shops:

- **Wrong stock**: system stock and shelf stock disagree; no stock ledger; quantity adjusted manually.
- **Manual calculation**: end-of-day totals computed by hand or in Excel; errors compound monthly.
- **Cash mismatch**: no till opening/closing flow, no Z-report, no audit of cash drops; cash leaks are common and silent.
- **No clear profit report**: owners know revenue, not margin; cannot see profit by product, category, branch, or supplier.
- **Supplier confusion**: deliveries entered late or never; cost prices outdated; no purchase-order trail; no supplier performance.
- **Low-stock problems**: best-sellers go out of stock; reorder is reactive; lost sales are invisible.
- **Expired products**: no batch/expiry tracking; food/halal/butcher/pharmacy-adjacent shops lose money and risk health complaints.
- **No online sales connection**: shops sell on WhatsApp/Instagram or a separate Shopify, with stock counted twice and oversold.
- **Poor reporting**: monthly closing is painful; reports are static PDFs; no drill-down.
- **Poor branch control**: 2–5 branches each run as their own island; no consolidated view; transfers untracked.
- **No automation**: no low-stock alerts, no reorder suggestions, no dynamic pricing, no AI assistance.
- **Compliance fear**: owners use one tool just for certified invoicing because they are afraid of AT (Autoridade Tributária); operational software is whatever they can manage.

Net effect: a typical small Portuguese shop loses 3–8% of revenue per year to stock errors, cash leaks, and pricing mistakes — money that pays for our SaaS many times over.

---

## 3. Target Market in Portugal

Portugal-specific notes:

- Highest shop density in Lisboa, Porto, Setúbal, Braga, Faro (Algarve), Coimbra, Aveiro.
- Strong immigrant retail communities (Bangladeshi, Indian, Pakistani, Nepali, Brazilian, Ukrainian, Cape Verdean, Angolan, Chinese) running mini-markets, halal shops, phone-accessory shops, hairdressers, restaurants — often under-served by Portuguese-only software and very price-sensitive but loyal once trust is built.
- Tourist zones (Algarve, Lisbon centre, Porto, Madeira) have higher willingness to pay and need fast bilingual POS.

For each segment below: **PP** = Pain Profile, **WP** = Why they pay, **HA** = How to approach, **€/m** = Expected monthly price band per branch (one POS), **DS** = Difficulty of selling (1 = easy, 5 = hard).

| Segment                                 | PP (top pains)                                       | WP (key reason to pay)                      | HA (channel)                                                | €/m             | DS  |
| --------------------------------------- | ---------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- | --------------- | --- |
| Mini mercados                           | Stock chaos, expiry, cash leak                       | Owner finally sees daily profit             | Door-to-door, immigrant networks                            | 25–45           | 2   |
| Grocery / mercearia                     | Manual stock, supplier mess                          | Automatic supplier receiving + low-stock    | Door-to-door, accountants                                   | 25–45           | 2   |
| Halal shops                             | Butchery + dry goods + expiry batches                | Batch/expiry, Halal product tagging         | Community networks, mosques' bulletin partners (respectful) | 30–55           | 2   |
| Bengali / Indian / Pakistani shops      | Multilingual staff, mix of food + mobile + cosmetics | Same system for everything, easy UI         | Community word-of-mouth, WhatsApp groups                    | 25–50           | 2   |
| Butchers / talhos                       | Weighing scale, batch, traceability                  | Scale integration + expiry + profit per cut | Direct visit, butcher associations                          | 35–70           | 3   |
| Clothing shops                          | Variants (size/colour), seasonal, returns            | Variant matrix + returns + seasonal reports | Direct visit, shopping streets                              | 30–60           | 3   |
| Small supermarkets (1–3 cashiers)       | Multi-cashier, fast POS, suppliers                   | Speed + supplier control + Z-report         | Direct visit, accountant referrals                          | 60–120          | 3   |
| Phone & accessory shops                 | Serial numbers, IMEI, repair tracking                | Serial tracking + repair tickets            | Direct visit, immigrant networks                            | 25–55           | 2   |
| Local wholesalers                       | Price tiers, customer credit, B2B orders             | Customer credit + price tier + B2B portal   | Direct visit, referrals                                     | 70–180          | 4   |
| Barber/beauty selling products          | Mixed services + product sales                       | Service + product POS in one                | Direct visit, beauty supply distributors                    | 20–40           | 3   |
| Cafés / small restaurants (Phase later) | Tables, KDS, modifiers                               | Table + kitchen + stock                     | Direct visit, hospitality associations                      | 40–100          | 4   |
| Small multi-branch chains (2–10 stores) | Branch silos, no consolidated view                   | Multi-branch + transfers + central reports  | Direct sales, accountants                                   | 200–700 (group) | 4   |

Acquisition priority for first 12 months: **mini mercados, halal/ethnic shops, phone & accessory shops, butchers, small clothing shops** — high pain, low complexity, strong word-of-mouth.

Restaurants and pharmacies are _not_ MVP targets (they have very specific certified and operational rules and strong incumbents).

---

## 4. Competitor and Market Positioning

### 4.1 Categories of competitors

- **Certified invoicing-first tools (Portugal)**: Moloni, InvoiceXpress, Vendus, Faturalo, Cloudware, Sage Start, Primavera Express, PHC CS small. Strong on AT compliance, weak on real stock control, supplier flow, and multi-channel.
- **POS-first (PT/EU)**: Vendus, ZsRest (restaurant), KiTPOS, Lightspeed (intl), Square (limited PT), SumUp POS, Tiller, Storyous. Decent POS, often weak on stock depth, multi-branch consolidation, and online integration with the same stock.
- **E-commerce**: Shopify, WooCommerce, Jumpseller (PT). Great online store, but stock is separate from the physical shop; owners double-count.
- **Excel / manual / paper**: still the de-facto stock manager in many small shops.
- **Local IT providers**: build custom Access/Filemaker/Excel macros or resell foreign POS; rarely SaaS, rarely supported well.

### 4.2 Positioning statement

> ShopOS is the Retail Operating System for Portuguese independent shops: one system that runs the till, the stock, the suppliers, the branches, and the online store — built for the shop owner, not the accountant.

### 4.3 Differentiators

- **Stock-first, not invoice-first**: real stock ledger, not just sales-minus-receipts.
- **Same stock online and offline**: one product, one quantity, reserved correctly.
- **Owner dashboard**: profit, cash difference, stock value, top movers — in plain language, on phone.
- **Portugal-aware**: IVA rates, MB WAY, Multibanco, certified invoicing integration path, SAF-T export, Portuguese + English UI from day one (Spanish + Bengali/Hindi later for immigrant-run shops).
- **Affordable**: starts under €30/month per shop.
- **Local human support**: Lisbon/Porto-based onboarding and a real phone number.
- **Hardware-friendly**: works with the cheap printers/scanners shops already have.
- **Honest contracts**: no 3-year lock-in.

---

## 5. Product Vision

ShopOS is **the Retail Business Operating System** for Portuguese independent shops and small chains.

It is not a POS with stock bolted on. It is a single platform where:

- Every sale (POS, online, B2B, phone order) flows through the same stock ledger.
- Every product has a single source of truth (price, cost, IVA, batch, expiry, supplier, image, online visibility).
- Every euro in or out of the till, the bank, or the supplier is recorded and reconciled.
- Every branch reports to one owner dashboard.
- Every staff action is auditable.
- Every customer is known and can be re-engaged.
- Every decision (reorder, discount, price) gets AI-assisted later.

It combines:

POS · Inventory · Online store · Suppliers & purchasing · Branch & warehouse · Cash control · Customers & loyalty · Staff & roles · Expenses · Reports · AI automation · SaaS billing · Support — in one tenant per shop, fully isolated.

---

## 6. MVP Scope

### 6.1 What the MVP must include (sellable to a real shop on day one)

1. Multi-tenant SaaS setup: one tenant = one shop (or shop group). Tenant onboarding wizard.
2. Authentication: email + password, password reset, optional 2FA for owner; roles: Super Admin (us), Support Admin (us), Shop Owner, Branch Manager, Cashier.
3. One shop, up to 2 branches, up to 3 POS terminals in MVP.
4. Product management: name, SKU, barcode, category, brand, supplier, purchase price, selling price, IVA rate, image, unit, min/max stock, active flag.
5. Category and brand management.
6. Barcode scanning (USB scanner = keyboard input; no special driver).
7. POS sales screen: scan, add, quantity, line discount, cart total, IVA breakdown, payment.
8. Payments recorded: cash, card (manual confirmation from terminal), MB WAY (manual confirmation), mixed payment.
9. Receipt generation (A4 + 80mm thermal). Until certified invoicing is validated, the document is a non-fiscal sale receipt and the fiscal invoice is issued via integration with a certified provider (see §12).
10. Stock ledger: every sale, receipt, adjustment is a row.
11. Automatic stock deduction on POS sale.
12. Supplier management + supplier receiving (goods receipt) with cost, batch, expiry.
13. Low-stock alerts (dashboard + email).
14. Till opening / closing with Z-report, expected vs counted cash, manager note, owner email.
15. Daily sales report, stock report, basic profit report (revenue − COGS).
16. Audit log (who did what, when, from where).
17. Automated daily backup; one-click manual backup.
18. Internal admin panel for our company: tenants, plans, support tickets, impersonate-with-consent.

### 6.2 What MVP must explicitly NOT include

- Full AI forecasting/reorder/discount engine.
- Full e-commerce marketplace, product-aggregator, or marketplace integration (Worten, Continente, Glovo, Uber Eats).
- Complex warehouse automation (bin locations, pick-paths, WMS).
- Full accounting replacement (general ledger, balance sheet, payroll).
- Payment wallet (no bKash-style internal wallet, no holding customer money).
- Enterprise ERP (MRP, manufacturing, multi-currency consolidation).
- Restaurant table/KDS flows.
- Built-in certified invoicing engine (we integrate with a certified provider in MVP; we will only consider building our own certified module in Phase 7+ after legal/AT validation).

### 6.3 MVP success criteria

- 1 pilot shop running real sales for 30 consecutive days with 0 critical bugs.
- POS sale (scan → pay → receipt → stock decrement) under 3 seconds.
- Daily Z-report matches counted cash within €0.50 in 95% of days.
- Stock variance after monthly count under 2%.

---

## 7. Full Feature Roadmap

For each phase: **Goal**, **Features**, **Dependencies**, **Complexity (1–5)**, **Team needed**, **Estimated effort (calendar weeks for a focused team)**, **Acceptance criteria**, **Business value**.

### Phase 1 — MVP POS + Inventory (weeks 1–14)

- Goal: A pilot shop sells, manages stock, and closes the till every day.
- Features: §6.1 in full.
- Dependencies: nothing.
- Complexity: 4.
- Team: 1 PM, 1 designer (part), 2 backend, 2 frontend, 1 QA, 1 DevOps (part).
- Effort: ~12–14 weeks.
- Acceptance: pilot shop §6.3 criteria.
- Business value: first paying customer; foundation for everything.

### Phase 2 — Supplier + Purchase Orders + Goods Receiving (weeks 12–18, overlap)

- Goal: End-to-end purchase cycle; cost prices stay accurate.
- Features: PO creation, supplier portal (later), partial receiving, batch/expiry, supplier invoice attachment, supplier performance KPIs, cost-price weighted average.
- Dependencies: Phase 1.
- Complexity: 3.
- Team: same.
- Effort: ~5–6 weeks.
- Acceptance: PO created → goods received in 2 partial deliveries → stock and cost updated → supplier KPI visible.
- Business value: profit accuracy; reduces stock-outs by 30–40%.

### Phase 3 — Online Store + Same Stock + Online Payment + COD (weeks 18–28)

- Goal: One stock, two channels.
- Features: storefront, catalogue, cart, checkout, COD, online card via gateway, MB WAY online, stock reservation on order, picking list, status flow, abandoned cart email.
- Dependencies: Phases 1–2.
- Complexity: 4.
- Team: + 1 frontend.
- Effort: ~8–10 weeks.
- Acceptance: online order reduces available stock instantly, paid order locks stock, cancelled order releases stock, picking list prints.
- Business value: new revenue channel without double bookkeeping.

### Phase 4 — Multi-Branch + Warehouse + Branch Transfer (weeks 26–34)

- Goal: Chain owners can run 2–10 stores from one screen.
- Features: branches, central warehouse, branch-specific prices and visibility, transfer request → approval → in-transit → received, consolidated reports, branch-level Z-report.
- Dependencies: Phases 1–2.
- Complexity: 4.
- Team: same.
- Effort: ~6–8 weeks.
- Acceptance: transfer of 50 SKUs between branches reflects in-transit, partial receive, and final stock correctly.
- Business value: unlocks the higher-priced multi-branch plan.

### Phase 5 — Customer Loyalty + Credit + Expenses + Advanced Reports (weeks 32–42)

- Goal: Know the customer, know the cash.
- Features: customer profile, points, store credit, customer due (B2B), expense module with categories and approval, profit by product/category/branch/supplier/employee, cohort retention, ABC analysis.
- Dependencies: Phases 1–4.
- Complexity: 3.
- Team: same.
- Effort: ~8 weeks.
- Acceptance: customer with €100 credit can pay in 3 visits; expense approval workflow; ABC report ranks SKUs.
- Business value: increases repeat sales and B2B contracts.

### Phase 6 — AI Forecasting + Reorder + Discount Recommendation (weeks 40–54)

- Goal: System suggests, owner approves.
- Features: reorder suggestion (lead time + sales velocity + seasonality), slow-mover discount suggestion, expiry liquidation, demand forecasting per SKU/branch, anomaly alerts (sudden cash variance, sudden stock loss).
- Dependencies: 6+ months of real data per shop.
- Complexity: 5.
- Team: + 1 data engineer (part), 1 ML engineer (part).
- Effort: ~10–12 weeks.
- Acceptance: reorder suggestions accepted by owner ≥60% of the time; reduce stock-outs by 25%.
- Business value: premium AI add-on (€20–€60/m).

### Phase 7 — SaaS Billing + Support + Enterprise Features (weeks 50–62)

- Goal: We run as a real SaaS company.
- Features: subscription plans, Stripe billing, dunning, in-app upsell, tiered support SLAs, in-app chat, knowledge base, status page, SSO for chains.
- Dependencies: Phases 1–5.
- Complexity: 3.
- Team: same.
- Effort: ~6–8 weeks.
- Acceptance: customer signs up and pays online without our help.
- Business value: scale beyond founder-led sales.

### Phase 8 — Compliance Hardening + Integrations + Scaling (weeks 60+)

- Goal: Be a serious option for chains and accountants.
- Features: validated certified invoicing path (own module or deep integration), SAF-T (PT) export hardened, accountant role + accountant marketplace, integrations with banks (open banking), e-commerce marketplaces, courier APIs (CTT, DHL, DPD, Glovo for retail), open API, data residency in EU.
- Dependencies: legal/AT validation.
- Complexity: 5.
- Team: + compliance/legal advisor.
- Effort: ongoing.
- Acceptance: passes accountant review; signs first 5+-branch chain.
- Business value: enterprise pricing tier.

---

## 8. User Roles and Permissions

### 8.1 Roles

- **Super Admin (our company)**: full platform.
- **Support Admin (our company)**: read all, impersonate with explicit tenant consent + audit, no destructive actions.
- **Shop Owner (tenant)**: full inside their tenant.
- **Branch Manager**: full inside their branch + read consolidated.
- **Cashier**: POS + own till + own sales lookup.
- **Warehouse Staff**: receiving, transfers, stock counts; no prices.
- **Accountant (read-only)**: financial reports, exports, SAF-T (PT).
- **Delivery Staff**: assigned online orders, status updates.
- **Supplier User (Phase 2+)**: own POs and receipts only.
- **Customer**: own orders, loyalty, credit (storefront only).

### 8.2 Permission matrix (simplified; V = view, C = create, E = edit, A = approve, D = delete, X = export, M = manage settings)

| Module                 | SuperAdm | SupportAdm | Owner   | BranchMgr          | Cashier              | Warehouse    | Accountant | Delivery | SupplierU | Customer       |
| ---------------------- | -------- | ---------- | ------- | ------------------ | -------------------- | ------------ | ---------- | -------- | --------- | -------------- |
| Tenants & plans        | VCEDAXM  | V          | –       | –                  | –                    | –            | –          | –        | –         | –              |
| Users in tenant        | V        | V          | VCEDAXM | VCE (own branch)   | –                    | –            | V          | –        | –         | –              |
| Products               | V        | V          | VCEDAXM | VCE                | V                    | V (no price) | VX         | –        | V         | V (storefront) |
| Pricing & discounts    | V        | V          | VCEDAXM | VEA                | V                    | –            | VX         | –        | –         | V              |
| POS sale               | V        | V          | VCEDAX  | VCEDAX             | VCE (own till)       | –            | V          | –        | –         | –              |
| Refund                 | V        | V          | VCEAX   | VCEA               | C (within €/% limit) | –            | V          | –        | –         | –              |
| Till open/close        | V        | V          | VAX     | VAX                | CE (own)             | –            | VX         | –        | –         | –              |
| Stock ledger           | V        | V          | VX      | VX                 | V (own branch)       | VCE          | VX         | –        | V (own)   | –              |
| Stock adjustment       | V        | V          | VAX     | VAE (within limit) | –                    | C (request)  | V          | –        | –         | –              |
| Suppliers              | V        | V          | VCEDAX  | VCE                | –                    | V            | VX         | –        | V (self)  | –              |
| Purchase orders        | V        | V          | VCEDAX  | VCEA               | –                    | V            | VX         | –        | V (own)   | –              |
| Goods receiving        | V        | V          | VCEAX   | VCEA               | –                    | VCE          | V          | –        | V (own)   | –              |
| Online orders          | V        | V          | VCEDAX  | VCEA               | V                    | V (pick)     | V          | VE (own) | –         | VC (own)       |
| Customers              | V        | V          | VCEDAX  | VCE                | VC                   | –            | V          | V (own)  | –         | V (own)        |
| Expenses               | V        | V          | VCEDAX  | VCEA               | –                    | –            | VX         | –        | –         | –              |
| Reports                | V        | V          | VX      | VX (own branch)    | V (own till)         | –            | VX         | –        | –         | –              |
| Audit log              | V        | V          | VX      | VX (own branch)    | –                    | –            | V          | –        | –         | –              |
| Subscription / billing | V        | V          | VCEAXM  | –                  | –                    | –            | V          | –        | –         | –              |
| Support tickets        | V        | VCEAX      | VCEAX   | VCE                | VC                   | VC           | VC         | VC       | VC        | VC             |

Notes: Branch Manager scope is limited to assigned branches. Cashier limits (refund €, discount %) are configurable per tenant. Every E/A/D action writes an audit-log entry.

---

## 9. Core Workflows

### A. POS Sale Workflow

1. Cashier logs in → selects branch + POS terminal.
2. Open till: enter opening cash by denomination → system stores opening balance and opens a `pos_session`.
3. Scan product barcode → system finds product variant + price + IVA.
4. Add to cart with quantity; allow line discount (within cashier's permission limit).
5. Cart shows subtotal, discount, IVA breakdown by rate, total.
6. Tender payment: cash, card, MB WAY, mixed; system computes change.
7. Confirm: write `sale` + `sale_items` + `payments`, write stock ledger movements (sale-out), update `stock_balances`, increment till cash if applicable.
8. Generate fiscal document (via certified provider integration) → store ATCUD/QR placeholders → print 80mm receipt + optional A4.
9. If the sale is reverted within X seconds → mark `voided` and reverse stock + cash atomically.
10. Update real-time daily totals on owner dashboard.
11. Close till at end of shift (see workflow B).

Edge cases: scale-weighed item, item without barcode (search), price-override with manager PIN, customer attached for loyalty/credit, partial card decline, network drop (offline mode §23).

### B. Till Closing Workflow (Z-report)

Inputs the system already has:

- Opening cash (from till open).
- Cash sales (computed).
- Card sales, MB WAY sales (computed; reconciled with terminal report by cashier).
- Refunds in cash, refunds in card.
- Cash drops (manager pulls cash to safe).
- Cash-paid expenses (e.g., delivery driver tip, small purchase).

Computation:

`Expected cash = Opening + CashSales − CashRefunds − CashDrops − CashExpenses`

Process:

1. Cashier counts cash by denomination.
2. System shows expected vs counted, difference (over/short).
3. If |difference| > tenant threshold (default €1) → require manager PIN + reason (forgot to scan, miscount, suspected theft, customer dispute).
4. Print Z-report (per session) and X-report (mid-shift snapshot).
5. Email daily summary to owner with KPIs (revenue, profit estimate, cash diff, top items, low-stock count, expired-soon count).
6. All numbers locked; any later correction is a separate compensating entry, never overwriting history.

### C. Supplier Receiving Workflow

1. System raises low-stock alert (SKU below `min_stock`, sales velocity rising, or expiry-driven).
2. System suggests a Purchase Order based on reorder quantity, supplier lead time, MOQ, last cost.
3. Manager edits → submits → owner approves (configurable).
4. PO sent to supplier (email PDF, or supplier portal in Phase 2+).
5. Supplier delivers (full or partial).
6. Warehouse staff scans incoming items → enter quantity, batch, expiry, unit cost.
7. System creates Goods Receipt linked to PO; partial receiving leaves remainder open.
8. Stock ledger gets `receipt-in` rows; `stock_balances` increases; cost price updated by weighted average; supplier invoice (PDF) attached.
9. Supplier invoice 3-way match: PO ↔ GR ↔ Invoice. Discrepancy flagged.
10. Supplier KPIs updated: on-time %, fill-rate %, defect %, average lead time, average cost variance.

### D. Online Order Workflow

1. Customer adds items to cart on storefront.
2. On checkout, system performs an atomic stock check + stock reservation (write `reserved` movement, decrement available).
3. Payment: COD (no capture), card via gateway (capture on confirm), MB WAY online, Multibanco reference (await ATM/home-banking confirmation).
4. On payment success → order moves to `Paid → Picking`. Picking list printed at branch/warehouse fulfilling the order.
5. Pack → Ship (assign courier or in-house delivery).
6. On delivered → reservation becomes a final sale-out movement; loyalty points awarded.
7. Failed delivery → status `Failed`, item back to available stock after policy window; refund issued for paid orders.
8. Return window: customer requests return → reverse logistics → on receipt and inspection, item goes to `sellable`, `damaged`, or `expired` stock; refund to original method or store credit.
9. Cancelled before pick → reservation released immediately.

### E. Branch Transfer Workflow

1. Branch A detects low stock on SKU; system queries other branches' available stock.
2. System suggests transfer from Branch B (highest surplus, shortest distance).
3. Branch A manager creates Transfer Request → Branch B manager approves → owner notified.
4. Branch B picks and ships → SKU moves to `in-transit` (decremented from B's available, not yet added to A).
5. Branch A receives, scans, confirms quantity (and any shortage/damage).
6. Stock ledger writes `transfer-out` (B), `in-transit-in`, `transfer-in` (A); discrepancies create an adjustment requiring approval.

### F. Return and Refund Workflow

1. Cashier/manager scans the original receipt or searches by date/customer.
2. System loads sale items; user selects items + quantities to return.
3. Policy check: within return window, item returnable, original payment method known.
4. Inspection state for each item: sellable, damaged, expired, opened-not-resellable.
5. Refund method: cash, original card, MB WAY refund (if supported by gateway), store credit, customer credit account.
6. Stock ledger: `return-in` to the right state (sellable / damaged / expired). Sale-level credit note created. Loyalty points reversed.
7. Audit-log entry with manager PIN; daily refund total visible on Z-report.

---

## 10. Inventory and Stock Ledger Design

We do **not** store stock as a single quantity column. We store an immutable **stock ledger** (every movement) and a **derived stock balance** per SKU per branch per state.

### 10.1 Stock states (per SKU × branch)

- **Available** — sellable on shelf or web.
- **Reserved** — held for an unpaid online order or a quote.
- **Sold** — already left the shop (terminal state, recorded for history).
- **Damaged** — not sellable, awaiting write-off or supplier return.
- **Expired** — past expiry, awaiting disposal.
- **In-transit** — between branches.
- **Returned** — returned by customer, pending inspection.
- **Quarantine** (optional) — recall, recount, supplier issue.

`Total physical = Available + Reserved + Damaged + Expired + In-transit + Returned + Quarantine`

### 10.2 Ledger row shape (conceptual)

`id, tenant_id, branch_id, product_id, variant_id, batch_id, movement_type, from_state, to_state, quantity, unit_cost, reference_type, reference_id, user_id, created_at, note`

### 10.3 Movement examples

- Supplier delivery → `null → Available`, qty +N, cost = invoice cost; reference = goods_receipt.
- POS sale → `Available → Sold`, qty −N; reference = sale.
- Online order placed → `Available → Reserved`, qty −N; reference = online_order.
- Online order paid (and stays reserved until shipped) → no change.
- Online order shipped → `Reserved → Sold`.
- Online order cancelled before ship → `Reserved → Available`.
- Damaged found → `Available → Damaged`; reason required.
- Expired found → `Available → Expired`; batch required.
- Transfer out → `Available → In-transit`; transfer reference.
- Transfer received → `In-transit → Available` (destination branch).
- Customer return (sellable) → `Sold → Returned → Available`.
- Customer return (damaged) → `Sold → Returned → Damaged`.
- Stock count correction → `Available → Available` (with delta) using a special `adjustment` movement; requires reason and manager approval if delta exceeds tolerance.

### 10.4 Rules

- Ledger is append-only. Corrections are compensating rows.
- `stock_balances` is rebuildable purely from the ledger (truth check).
- Every movement has a typed reference and a user.
- Negative balance is forbidden in `Available` except in clearly flagged offline-sync cases (§23) which raise an alert.
- Cost is tracked per movement; weighted average cost per SKU per branch is computed for COGS.
- Batch + expiry tracked optionally per product (FEFO suggested for food/butcher/halal).
- Serial numbers tracked optionally per product (phones, electronics).

---

## 11. Product Management Plan

Product master fields:

- Identity: `name`, `short_name_for_receipt`, `sku`, `internal_code`, `barcode (EAN/UPC)`, additional barcodes.
- Classification: `category`, `sub_category`, `brand`, `tags` (e.g., halal, vegan, frozen, alcohol), `default_supplier_id`.
- Commercial: `purchase_price`, `selling_price`, `iva_rate`, `iva_included_flag`, `margin_target_%`, `branch_price_overrides`, `customer_tier_prices` (B2B), `price_history`.
- Visuals: `primary_image`, `gallery`, `description_short`, `description_long_html`.
- Units & conversions: `base_unit` (un, kg, L, m), `secondary_units` with conversion (e.g., 1 box = 24 un), `weighable_flag`, `decimal_qty_allowed`.
- Variants: matrix of `attributes` (size, colour, flavour) → each variant is its own SKU with own barcode/price/stock.
- Bundles/kits: a parent product whose components are deducted from stock when sold.
- Batch & expiry: `batch_tracking_flag`, `default_shelf_life_days`, batches with `lot_no`, `manufacture_date`, `expiry_date`, `qty_in_batch`.
- Serials: `serial_tracking_flag`; serials linked on receipt and on sale.
- Branch settings: `is_active_in_branch`, `min_stock`, `max_stock`, `reorder_qty`, `lead_time_days`, `branch_price_override`.
- Online: `online_visible_flag`, `online_title`, `online_description`, `online_images`, `seo_slug`, `online_price_override`.
- Status: `active`, `inactive`, `archived`.
- Compliance: `requires_age_check_flag` (alcohol, tobacco), `hazmat_flag`.

Operations:

- Bulk import via CSV/Excel with dry-run preview.
- Bulk price/IVA change with effective date.
- Print barcode labels (label printer §22).
- Merge duplicates (governed action with audit).
- Soft-delete only; archived products keep history.

---

## 12. Portugal Payment and Invoicing Strategy

> **Compliance disclaimer**: Fiscal invoicing in Portugal is regulated by Autoridade Tributária e Aduaneira (AT). Topics like certification of invoicing software, ATCUD, QR codes, SAF-T (PT), IVA rates and rules, and electronic invoicing for B2G/B2B obligations evolve frequently. Every concrete decision below must be validated by a Portuguese certified accountant (TOC/CC) and, where required, by a tax/legal advisor and the AT itself.

### 12.1 Payment methods to support

- **Cash** — record by denomination; reconcile in Z-report.
- **Card (presence)** — physical terminal (SIBS, Redunicre, Stripe Terminal, SumUp, Viva Wallet, Easypay, etc.). MVP: cashier confirms terminal result manually; integration with select terminals later.
- **MB WAY** — push-to-phone or QR; supported via SIBS API or via gateways such as IfthenPay, Eupago, Easypay, Viva. MVP: manual confirmation; integration in Phase 1 late or Phase 3.
- **Multibanco reference** — generate reference + entity + amount via gateway; customer pays at ATM or home-banking; webhook confirms.
- **Online card** — gateway-hosted page (Stripe, Easypay, IfthenPay, Eupago, Viva). We do **not** see PAN; PCI-DSS scope is minimised.
- **Bank transfer** — for B2B and wholesale; reconciled manually or via open banking later.
- **Cash on Delivery (COD)** — for online orders; cash collected on delivery, reconciled to that day's till.

### 12.2 Invoicing approach

- **MVP approach**: integrate with an existing Portuguese certified invoicing provider (e.g., Moloni, InvoiceXpress, Vendus, Cloudware — exact partner chosen after commercial + technical evaluation). The fiscal invoice/receipt is issued by the certified partner; we pass cart, customer, IVA breakdown, payment; we receive the document number, ATCUD, QR code, and PDF, and we display/print it. This avoids the long, costly, and risky path of getting our own software certified prior to product-market fit.
- **Phase 8 option**: pursue our own certified invoicing certification with AT only after we have stable revenue and a clear legal/technical assessment.
- **Card data**: never stored on our servers. All card data is handled by the PCI-DSS compliant gateway. We store only tokens/last-4/scheme for display.
- **Wallet**: explicitly out of scope. We do not hold customer money. Loyalty points and store credit are accounting balances inside the tenant; refund payouts use the original payment method or store credit, not a custodial wallet.
- **SAF-T (PT)**: even with partner-issued documents, owners often need a unified SAF-T export for their accountant. We will surface the SAF-T export of the certified partner; if we later issue documents ourselves, we generate SAF-T (PT) directly.

### 12.3 IVA configuration

- Default Portugal mainland rates: 23% / 13% / 6% (verify current values and continental vs Madeira/Azores adjustments per AT).
- Per-product IVA rate; some categories (groceries, baby food, books) commonly at reduced rates — owner sets it; receipt shows breakdown.

---

## 13. SaaS Business Model

### 13.1 Plans (working pricing — to validate in pilot)

| Plan         | Target                       | Includes                                                                             | Excludes                       | Price (per shop / month, billed yearly) | Monthly billing   |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------ | ------------------------------ | --------------------------------------- | ----------------- |
| Starter      | 1-cashier shops              | 1 branch, 1 POS, 1k SKUs, basic reports, email support                               | Online store, multi-branch, AI | €19                                     | €25               |
| Pro          | Active independent shops     | 1 branch, up to 3 POS, 10k SKUs, full reports, online store, MB WAY/card via partner | Multi-branch, AI               | €39                                     | €49               |
| Multi-Branch | Small chains (2–10 branches) | All Pro + multi-branch + transfers + central reports + accountant role               | AI premium                     | €99 base + €29/branch                   | €129 + €39/branch |
| Enterprise   | 10+ branches / wholesalers   | All + SSO, custom SLAs, advanced API, dedicated CSM                                  | –                              | From €499                               | Custom            |

Add-ons (per tenant):

- Setup & onboarding (one-off): €149 (Starter), €299 (Pro), €699 (Multi-Branch), custom (Enterprise). Includes data import, configuration, training.
- Per extra POS terminal: €9/m.
- Premium reporting pack: €15/m.
- AI pack (Phase 6+): €19/m (Starter), €39/m (Pro), €79/m+ (Multi-Branch).
- Priority support (1-hour business-hours response, weekend on-call): €29/m (Pro), included for Multi-Branch+.
- Hardware setup package: cost + 20–30% margin; remote install or on-site (€80–€150 visit fee inside Lisbon/Porto).

### 13.2 Commercial principles

- Yearly = 2 months free.
- 30-day pilot: free, with hand-holding, no card upfront.
- No long lock-in beyond annual plan; cancel anytime at end of paid period.
- Transparent in-app billing + Stripe portal.

---

## 14. Revenue Model and Financial Projection

> **All numbers below are explicit assumptions for planning, not forecasts. Pilot results in §16 will replace them.**

Assumptions:

- Average plan ARPU/shop/month: €38 in early stage (mostly Starter+Pro), rising to €55 as Multi-Branch and add-ons grow.
- Setup fee per shop on signup: €200 weighted average.
- Hardware margin per shop (when sold): €120 weighted average (printer + scanner + cash drawer kit).
- Support packages take-up: 25% of paying shops at €29/m.
- Custom dev / training: €4–€8k/year average across the book in the first 12 months.
- Monthly churn target: ≤2.5% (annualised ~25% — high for SaaS overall, realistic for SMB retail).

### 14.1 Snapshots

| Stage          | Paying shops | ARPU/m | MRR    | Setup (annual one-off, blended) | Hardware (annual margin) | Support add-ons | Year-1 ARR (subscription) |
| -------------- | ------------ | ------ | ------ | ------------------------------- | ------------------------ | --------------- | ------------------------- |
| Pilot          | 5            | €30    | €150   | €1.0k                           | €0.6k                    | €0.4k           | ~€1.8k                    |
| Early traction | 20           | €36    | €720   | €4.0k                           | €2.4k                    | €2.1k           | ~€8.6k                    |
| Validated      | 50           | €42    | €2.1k  | €10k                            | €6k                      | €5.2k           | ~€25k                     |
| Scaling        | 100          | €50    | €5.0k  | €20k                            | €12k                     | €10.4k          | ~€60k                     |
| 250            | 250          | €58    | €14.5k | €50k                            | €30k                     | €26k            | ~€174k                    |
| 500            | 500          | €62    | €31.0k | €100k                           | €60k                     | €52k            | ~€372k                    |

Realistic target trajectory:

- Month 3: 1 pilot live (free).
- Month 6: 5 paying shops (€150–€250 MRR).
- Month 12: 50–80 paying shops (€2k–€4.5k MRR).
- Month 24: 200–300 paying shops (€10k–€18k MRR).
- Month 36: 500+ shops, multi-branch deals, AI package adopters → €25k–€40k MRR realistic stretch.

Costs to keep in mind (rough monthly, €):

- Cloud + 3rd-party (DB, storage, email, SMS, gateway fees): €150 → €1,500 as you grow.
- Team (Portugal cost basis, gross): junior dev €2k–€2.5k/m, mid €3k/m, senior €4–5k/m.
- Sales/onboarding: €1.5k–€2.5k/m.
- Marketing: €500/m starter → €2k/m.

Cash plan: do not hire a 6-person team on day one. Start with 4 people + founder + part-time designer. Add hires only after pilot validation (§30).

---

## 15. Go-To-Market Strategy

### 15.1 Phase A — Pilot (months 0–3)

- Founder + 1 onboarding person physically visit 50 shops in Lisboa/Almada/Amadora (or Porto/Gaia) over 6 weeks. Goal: 30 problem interviews, 10 free-pilot offers, 1–2 live pilots.
- Pick 1–2 shops where the owner is engaged, has stock pain, and is willing to give honest feedback.
- Fully install hardware, import products, train staff. Founder sits in the shop a full day during go-live.
- Document the result as a written + video case study (with permission).

### 15.2 Phase B — Local expansion (months 3–9)

- Use pilot case study to sell to 5 similar shops (same segment, same neighbourhood).
- Launch a Portuguese + English landing page with a 2-minute video, a price list, and a "book a demo" form.
- Run targeted Google + Meta ads in Portuguese and English (Lisbon, Porto, Algarve) for keywords like "POS mini mercado", "software stock loja", "POS halal".
- Build a partner channel: 2–3 accountants, 2 IT/hardware resellers, 1 invoicing certified partner. Pay 10–15% of first-year ARR as referral commission.
- Tap immigrant business associations and networks respectfully and via real introductions, not cold WhatsApp blasts.

### 15.3 Phase C — Scaling (months 9–24)

- Hire 1–2 sales/onboarding reps (Portuguese-native, comfortable in shops).
- Sponsor or attend Portuguese small-retail and hospitality events.
- Build a self-serve signup path for Starter plan.
- Launch a referral program: existing customer gets 1 free month per referred paying shop.
- Specialise vertical playbooks: Mini Mercado, Halal/Ethnic, Phone & Accessories, Butchers, Clothing.

### 15.4 Sales mechanics

- Always demo on a real tablet + scanner + printer setup; never demo only on screen-share.
- Lead with the owner's pain (cash/stock/profit), not features.
- Standard offer: 30-day pilot, set-up fee waived if subscription continues.
- Always sign a short written agreement (1–2 pages) even for pilots.

---

## 16. First 90-Day Action Plan

### Days 1–15 — Validate

- Build a 1-page positioning document and 5-slide pitch in Portuguese + English.
- Schedule 30 shop visits across mini mercados, halal, phone shops, butchers, clothing.
- Conduct structured interviews (script ready): top 3 pains, current tools, hours/week wasted, would they pay €X/month, why not.
- Collect 10 actual receipts and 5 supplier invoices to study real document formats.
- Define MVP scope (lock §6).
- Choose tech stack (lock §18) and hosting region (EU, Portugal/Iberia preferred).
- Engage a Portuguese certified accountant/legal advisor for compliance pre-read.

### Days 16–30 — Design

- UX wireframes for: POS sale, product list, product edit, stock ledger, supplier receiving, till open/close, owner dashboard.
- High-fidelity mocks for the top 5 screens.
- Database design v1 (§19) reviewed by all engineers.
- Architecture decision record: monolith (modular), Postgres, Redis, S3-compatible storage, queue, hosting.
- Set up repos, CI, environments (§27).
- Build clickable POS prototype + product module prototype.
- Choose certified invoicing partner; sign NDA/intent.

### Days 31–60 — Build core MVP

- Backend: tenants, users, auth, RBAC, products, categories, brands, suppliers.
- Backend: stock ledger + stock balances + adjustments.
- Backend: POS sale + payment + receipt + IVA + audit.
- Backend: supplier receiving + cost update + low-stock alert.
- Backend: till open/close + Z-report.
- Frontend: POS PWA (works on tablet + Windows mini-PC), product admin, dashboard.
- Reports: daily sales, stock, basic profit.
- Internal admin panel skeleton.

### Days 61–90 — Test & pilot

- Internal end-to-end testing with synthetic data (10k SKUs, 2 branches).
- Hardware testing: 2 brands of 80mm thermal printers, 2 brands of barcode scanners, 1 cash drawer, 1 customer display, 1 weighing scale (read-only for now).
- Pilot shop installation: import their real products (cleanup CSV), train staff, run real sales for 2 weeks.
- Daily standup with pilot owner; bug log; hot-fix cycle.
- Prepare pricing page, contracts, support workflow, KB articles for top 20 issues.
- Day 90 review: go/no-go for charging the next 3 customers.

---

## 17. Technical Architecture

### 17.1 Monolith vs Modular Monolith vs Microservices

| Option                                                          | Pros                                                       | Cons                                                                              | Verdict for ShopOS                                                                |
| --------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Monolith (one app)                                              | Fastest to build, simplest deploy                          | Hard to scale teams and modules                                                   | Too risky long-term                                                               |
| **Modular monolith** (one deployable, strong module boundaries) | Fast to build, clear seams, easy to extract services later | Some discipline required                                                          | **Recommended for MVP and through Phase 5**                                       |
| Microservices                                                   | Independent scaling/teams                                  | High ops complexity, slow at small scale, distributed transactions hard for stock | Wrong for MVP; consider extracting Reporting/AI/Online-store services in Phase 6+ |

### 17.2 High-level architecture (MVP through Phase 5)

```
[POS PWA / Tablet] [Admin Web] [Storefront Web]
        \           |              /
         \          |             /
          [API Gateway / Edge / WAF]
                    |
           [App Servers (modular monolith)]
            |         |        |        |
        [Postgres] [Redis] [Queue]  [Object storage S3]
                    |
        [Workers: reports, emails, webhooks, AI]
                    |
   [Observability: logs/metrics/traces/alerts]
   [Backups: PITR + nightly snapshots, encrypted]
   [Integrations: certified invoicing partner, payment gateways, courier APIs (later)]
```

### 17.3 Components

- **Frontend admin** — Next.js (React) responsive web for owner/manager.
- **POS** — PWA (installable, offline-capable) for tablet/Windows; Electron wrapper later if needed for hardware drivers.
- **Storefront (online store)** — Next.js, server-rendered, SEO-friendly, served per tenant via subdomain `<shop>.shopos.pt` or custom domain.
- **Backend API** — single deployable, modular: Auth, Tenant, Catalog, Pricing, Inventory, POS/Sale, Online Order, Customer, Loyalty, Supplier/Purchase, Branch/Transfer, Expense, Reporting, Notification, Subscription, Support.
- **Database** — PostgreSQL 16+, one DB per environment, **schema-per-tenant or row-level multi-tenant** (decide in §24/§19; default: row-level with tenant_id everywhere + RLS policies).
- **Cache** — Redis (sessions, rate-limits, hot lookups, product cache).
- **Queue** — start with Postgres-backed queue or Redis Streams; move to RabbitMQ/Kafka in Phase 6+.
- **Notification service** — email (Postmark/Sendgrid/SES), transactional SMS via Twilio/MessageBird (sparingly), webhooks.
- **Reporting service** — read-replica + scheduled jobs for heavy aggregates; later, a small data mart (Postgres or DuckDB/ClickHouse) when reports get heavy.
- **AI service (Phase 6+)** — Python FastAPI workers reading from data mart; nightly retrain; serve recommendations via API.
- **Payment gateway integration** — abstracted behind a `PaymentProvider` interface; first concrete adapters: chosen Portuguese gateway + Stripe.
- **Backup** — managed Postgres with PITR, daily encrypted snapshots in a second region.
- **Monitoring** — Sentry (errors), Prometheus + Grafana or Grafana Cloud (metrics), Loki/Elastic (logs), uptime + synthetic checks.
- **File storage** — S3-compatible (AWS S3, Cloudflare R2, or Hetzner/Scaleway in EU); product images, receipts, supplier PDFs.
- **Edge** — Cloudflare or equivalent: WAF, DDoS, CDN.

### 17.4 Multi-tenancy choice

- **Recommended**: shared database, shared schema, `tenant_id` column on every tenant-scoped table, enforced by Postgres Row-Level Security (RLS) and a tenant context set per request.
- Pros: cheap, simple ops, easy cross-tenant analytics for us, easy backups.
- Cons: blast radius if a bug bypasses RLS — mitigated by RLS + automated tests on every endpoint.
- Schema-per-tenant or DB-per-tenant kept as an option for Enterprise customers later.

### 17.5 Hosting

- EU region required (GDPR + customer trust). Options: AWS Frankfurt/Ireland, GCP Belgium, Azure Netherlands, Hetzner (EU), OVH/Scaleway (FR). For early stage, a managed Postgres + a couple of app servers + a managed cache on Hetzner Cloud or AWS is the right balance of cost and reliability.

---

## 18. Recommended Technology Stack

| Layer               | Choice                                                                                                                                    | Why                                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin/web frontend  | **Next.js + React + TypeScript + Tailwind + shadcn/ui**                                                                                   | Fast iteration, great DX, server-render where useful, huge talent pool.                                                                                                                              |
| POS app             | **PWA (Next.js or Vite + React) + service worker + IndexedDB**                                                                            | Installable on Android tablets and Windows; offline-capable; one codebase. Optional Electron wrapper later for deeper hardware integration.                                                          |
| Storefront          | **Next.js (SSR/ISR)**                                                                                                                     | SEO and speed for product pages.                                                                                                                                                                     |
| Mobile app (later)  | **Flutter** or **React Native**                                                                                                           | One codebase, native scanner/camera APIs. Decide when mobile use cases are clear.                                                                                                                    |
| Backend             | **Node.js + NestJS + TypeScript** (primary recommendation), with **.NET 8** or **Java Spring Boot** as enterprise-credibility alternative | NestJS gives a clean modular monolith out of the box, shares language with frontend, fast hiring in Portugal. .NET/Spring is reasonable if your team is already strong there — pick once and commit. |
| ORM                 | Prisma or TypeORM (Node) / EF Core (.NET) / Hibernate (Java)                                                                              | Type-safe data access.                                                                                                                                                                               |
| Database            | **PostgreSQL 16+**                                                                                                                        | ACID, JSONB, RLS, partitioning, pgvector for AI later.                                                                                                                                               |
| Cache               | **Redis**                                                                                                                                 | Sessions, rate-limits, hot caches.                                                                                                                                                                   |
| Queue               | Postgres queue (`pg_cron` + `LISTEN/NOTIFY`) or Redis Streams initially; **RabbitMQ** or Kafka later                                      | Simple early, scalable later.                                                                                                                                                                        |
| AI/ML service       | **Python + FastAPI**, scikit-learn, Prophet/StatsForecast, optional PyTorch later                                                         | Right ecosystem; isolated from main app.                                                                                                                                                             |
| Object storage      | **S3-compatible** (AWS S3 / Cloudflare R2 / Scaleway / MinIO self-hosted)                                                                 | Cheap, durable, EU regions available.                                                                                                                                                                |
| Search (later)      | Postgres trigram + pg_search; Meilisearch/OpenSearch when needed                                                                          | Defer.                                                                                                                                                                                               |
| Monitoring          | **Sentry**, **Grafana Cloud or Prometheus+Grafana+Loki**, **UptimeRobot/Better Uptime**                                                   | Errors + metrics + logs + uptime.                                                                                                                                                                    |
| CI/CD               | **GitHub Actions**                                                                                                                        | Cheap, ubiquitous.                                                                                                                                                                                   |
| Containers          | **Docker** + Docker Compose locally; managed runtime in prod                                                                              | Consistent environments.                                                                                                                                                                             |
| Prod runtime        | Managed Kubernetes (EKS/AKS/GKE) when scale demands; before that, plain VMs or Fly.io / Render / Hetzner with Docker Compose / Nomad      | Don't introduce Kubernetes too early.                                                                                                                                                                |
| Auth                | First-party (NestJS) with Argon2id + JWT for short-lived sessions + refresh tokens; consider Auth0/Clerk if speed matters                 | Keep control of identity for multi-tenant SaaS.                                                                                                                                                      |
| Email               | Postmark (transactional)                                                                                                                  | Best deliverability for receipts and password resets.                                                                                                                                                |
| Payments (online)   | Stripe + a Portuguese gateway (IfthenPay / Eupago / Easypay / Viva) for MB WAY/Multibanco                                                 | Local methods are essential in Portugal.                                                                                                                                                             |
| Certified invoicing | Integration with a certified provider (Moloni / InvoiceXpress / Vendus / Cloudware) — to choose                                           | Avoid AT certification cost/risk in MVP.                                                                                                                                                             |

---

## 19. Database Design (high level)

Conventions: every tenant-scoped table has `tenant_id UUID NOT NULL` with an index and an RLS policy. All tables have `id`, `created_at`, `updated_at`, `created_by`, `updated_by`, soft-delete via `deleted_at` where appropriate. Money stored as `numeric(14,4)`. Timestamps in UTC.

### Tables

- **tenants** — one per shop or shop group. Fields: `id`, `name`, `legal_name`, `nif`, `country`, `currency`, `timezone`, `language`, `plan_id`, `status`, `billing_email`. Parent of everything.
- **shops** — usually 1 per tenant (for solo owners) but supports tenant with multiple shop entities. Fields: `tenant_id`, `name`, `legal_name`, `nif`, `address`, `default_branch_id`.
- **branches** — physical locations under a shop. `tenant_id`, `shop_id`, `code`, `name`, `address`, `phone`, `is_warehouse`, `tz`, `opening_hours`.
- **warehouses** — special branches flagged `is_warehouse=true`; share the branches schema for simplicity.
- **users** — `tenant_id` (nullable for super-admins), `email`, `password_hash`, `name`, `phone`, `is_active`, `2fa_enabled`, `last_login_at`.
- **roles** — predefined + custom; `tenant_id` nullable for global ones.
- **permissions** — fine-grained codes; many-to-many with roles via `role_permissions`.
- **user_roles** — `user_id`, `role_id`, scope (`branch_id` nullable).
- **products** — master catalog (§11 fields).
- **product_variants** — variant matrix; child of `products`.
- **product_branch_settings** — `product_id`, `branch_id`, `is_active`, `min_stock`, `max_stock`, `reorder_qty`, `lead_time_days`, `branch_price_override`.
- **categories** / **brands** — hierarchical categories.
- **suppliers** — `name`, `nif`, `contact`, `payment_terms`, `lead_time_days`, performance KPIs.
- **purchase_orders** + **purchase_order_items** — open/partial/received/closed; references supplier, branch.
- **goods_receipts** + **goods_receipt_items** — actual deliveries; references PO; carries batch, expiry, unit cost.
- **stock_ledger** — append-only; one row per movement (§10.2). Indexed by `(tenant_id, product_id, branch_id, created_at)`. Partitioned by month at scale.
- **stock_balances** — derived snapshot per `(tenant_id, product_id, variant_id, branch_id, state)`; rebuildable from ledger; updated transactionally with ledger writes.
- **batches** — `product_id`, `lot_no`, `manufacture_date`, `expiry_date`.
- **serials** — `product_id`, `serial_no`, `state`, links to receipt and sale.
- **pos_sessions** — opening cash, opener user, opened_at, closed_at, expected_cash, counted_cash, difference, status, notes.
- **cash_drawer_movements** — `pos_session_id`, type (drop, expense, refund, sale, change), amount, user, note.
- **sales** + **sale_items** — POS and online sales; references customer (optional), session (POS), branch, currency, totals, IVA breakdown, fiscal doc references (number, ATCUD, QR).
- **payments** — `sale_id` (or order), method, amount, gateway_ref, status, captured_at, refunded_at.
- **online_orders** + **order_items** — storefront orders before/while becoming sales; status flow.
- **returns** + **refunds** — references original `sale`/`order`, items returned, condition, refund method.
- **discounts** / **promotions** — rules: % off, € off, BOGO, basket-level, time-bound, customer-tier.
- **customers** — `name`, `nif`, contact, address, tier, opt-ins, `loyalty_balance`, `credit_limit`, `credit_balance`.
- **loyalty_points** — ledger of earn/redeem.
- **customer_credit** — ledger of credit issued/used (B2B).
- **branch_transfers** + **branch_transfer_items** — per §9E.
- **expenses** — category, amount, payment method, branch, attachment, approval state.
- **notifications** — in-app and email log.
- **audit_logs** — actor, action, entity, before/after JSON, IP, user-agent.
- **subscriptions** — `tenant_id`, plan, status, period, billing provider id.
- **invoices_for_saas_clients** — invoices we issue to our SaaS customers (separate from their fiscal sales invoices to their customers).
- **support_tickets** + **ticket_messages** — priority, status, owner.
- **integrations** — per-tenant credentials for invoicing partner, payment gateways, etc., encrypted.
- **api_keys** / **webhooks** — for tenant-side automation.
- **feature_flags** — gate features per plan/tenant.
- **settings** — per-tenant key/value JSONB.
- **idempotency_keys** — for safe retries on POS/online order creation.
- **outbox** — for reliable webhook/event delivery.

Critical relationships:

- `stock_ledger` references **product**, **branch**, plus a polymorphic reference (`reference_type`, `reference_id`) to `goods_receipt`, `sale`, `online_order`, `branch_transfer`, `return`, `adjustment`.
- `sale_items` references `product`/`variant`; movements in `stock_ledger` are produced by the same transaction that creates the sale.
- `payments` reference either a `sale` or a SaaS `invoice` (clearly separated).

---

## 20. API Planning

API style: REST + JSON, versioned `/api/v1/...`. Some events streamed via Server-Sent Events or WebSockets to the POS (low-stock, new online order). Webhooks for tenant integrations.

For each group, indicative endpoints:

### Auth API

- `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/2fa/setup`, `POST /auth/2fa/verify`. Issues short-lived JWT + refresh token bound to device.

### Tenant API

- `POST /tenants` (super admin), `GET /tenants/:id`, `PATCH /tenants/:id`, `POST /tenants/:id/suspend`, `POST /tenants/:id/cancel`, `GET /tenants/:id/usage`.

### Shop / Branch API

- `GET/POST/PATCH /shops`, `GET/POST/PATCH /branches`, `POST /branches/:id/open-day`.

### User & Role API

- `GET/POST/PATCH /users`, `POST /users/:id/invite`, `GET /roles`, `POST /roles` (custom), `POST /users/:id/roles`.

### Product API

- `GET /products` (search, filter, paginate), `POST /products`, `GET /products/:id`, `PATCH /products/:id`, `POST /products/:id/archive`, `POST /products/import`, `POST /products/bulk-price-change`, `GET /products/:id/price-history`.

### POS API

- `POST /pos/sessions/open`, `POST /pos/sessions/:id/close`, `GET /pos/sessions/:id/x-report`, `GET /pos/sessions/:id/z-report`, `POST /pos/sessions/:id/cash-drop`.
- `POST /pos/sales` (create sale), `POST /pos/sales/:id/void`, `POST /pos/sales/:id/refund`, `GET /pos/sales/:id/receipt`.

### Sales API (cross-channel)

- `GET /sales` (filter by branch, channel, date), `GET /sales/:id`, `POST /sales/:id/refund`.

### Inventory API

- `GET /inventory/stock-balances`, `GET /inventory/ledger`, `POST /inventory/adjustments`, `POST /inventory/counts`, `GET /inventory/low-stock`, `GET /inventory/expiring`.

### Supplier API

- `GET/POST/PATCH /suppliers`, `GET /suppliers/:id/kpis`.

### Purchase API

- `POST /purchase-orders`, `GET /purchase-orders`, `PATCH /purchase-orders/:id`, `POST /purchase-orders/:id/send`, `POST /purchase-orders/:id/close`.

### Goods Receiving API

- `POST /goods-receipts`, `GET /goods-receipts`, `POST /goods-receipts/:id/items`, `POST /goods-receipts/:id/finalize`, `POST /goods-receipts/:id/3-way-match`.

### Online Order API

- `POST /online-orders`, `GET /online-orders`, `POST /online-orders/:id/pay`, `POST /online-orders/:id/cancel`, `POST /online-orders/:id/pick`, `POST /online-orders/:id/ship`, `POST /online-orders/:id/deliver`, `POST /online-orders/:id/return`.

### Payment API

- `POST /payments/intents`, `POST /payments/webhooks/:provider`, `GET /payments/:id`, `POST /payments/:id/refund`.

### Customer & Loyalty API

- `GET/POST/PATCH /customers`, `GET /customers/:id/orders`, `POST /customers/:id/credit-adjust`, `POST /loyalty/earn`, `POST /loyalty/redeem`.

### Expense API

- `GET/POST/PATCH /expenses`, `POST /expenses/:id/approve`.

### Report API

- `GET /reports/daily`, `GET /reports/sales-by-product`, `GET /reports/profit`, `GET /reports/cash-variance`, `GET /reports/abc`, `GET /reports/saf-t-export`.

### Notification API

- `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/preferences`.

### Subscription API

- `GET /subscription`, `POST /subscription/upgrade`, `POST /subscription/cancel`, `GET /invoices` (our SaaS invoices to the tenant).

### Support API

- `POST /support/tickets`, `GET /support/tickets`, `POST /support/tickets/:id/messages`.

### Admin API (our internal)

- `GET /admin/tenants`, `POST /admin/impersonate` (with consent + audit), `GET /admin/health`, `POST /admin/feature-flags`.

Cross-cutting:

- Idempotency keys on every state-changing endpoint that POS/storefront calls.
- Pagination via `?cursor=`.
- All tenant-scoped endpoints derive `tenant_id` from the auth token, never from the URL.
- Strong rate-limiting and per-IP/per-user quotas.

---

## 21. UI/UX Plan

### Principles

- The owner uses the system on their phone. The cashier uses it on a 10-inch tablet. Design phone-first for management and tablet-first for POS.
- Portuguese is the primary language, with English second. Add Spanish, then Bengali/Hindi/Urdu for immigrant-run shops in later phases.
- One primary action per screen. Big tap targets. Numeric inputs with the right keypad.
- Money is always shown in the IVA-included form by default for POS, with breakdown one tap away.

### Main screens

- **Super admin dashboard** — tenant list, MRR, churn, support queue, system health, feature-flag controls.
- **Shop owner dashboard (mobile-first)** — today's revenue, profit estimate, cash variance, top products, low-stock count, expiring soon, tickets needing approval.
- **Branch manager dashboard** — same as owner but scoped to branch, plus staff schedule and till status of each terminal.
- **POS screen** — left: cart with line items, discount, totals, IVA breakdown, payment buttons; right: search/scan + quick categories + favorites; top: cashier name, branch, terminal, session timer; bottom: payment + park sale + customer attach.
- **Product list** — fast search; filters by category, brand, supplier, status; bulk actions; quick stock view per branch.
- **Add/edit product** — tabs: Basics, Pricing & IVA, Stock & Reorder, Online, Batches/Serials, Variants, Images, Compliance.
- **Stock dashboard** — heatmap of low/expiring/over-stocked SKUs; drill-down to ledger; "stock value" per branch.
- **Supplier receiving** — scan-driven; left: PO; right: scanned items with quantity, batch, expiry, cost; partial save; finalise.
- **Purchase order** — generate from low-stock suggestions; edit lines; send PDF.
- **Till closing** — denomination counter, expected vs counted, difference, manager PIN, reason; print Z-report.
- **Reports** — preset cards (Daily, Profit, Cash Variance, Top Movers, Slow Movers, Expiry, Stock Value, ABC); custom date range; export CSV/PDF.
- **Customer screen** — profile, history, loyalty, credit, opt-ins, notes.
- **Staff screen** — users, roles, branch assignment, sales-per-cashier, refund rate, discount usage.
- **Settings** — branches, taxes/IVA, payment methods, hardware, integrations, branding.
- **Support** — tickets, KB, status page, contact channels.

### UX details

- Always-visible "test mode" banner during onboarding/training so accidental real sales are flagged.
- Undo last action (within 30 seconds) on POS where safe.
- Friendly Portuguese error messages, never raw stack traces.

---

## 22. Hardware Integration Plan

### Required for MVP

- **Barcode scanner** (USB, HID keyboard mode) — works as keyboard input, no driver needed. Validate with 2 popular models (e.g., Honeywell Voyager, Datalogic QuickScan, generic Symcode).
- **Receipt printer** (80mm thermal, ESC/POS) — Epson TM-T20III, Bixolon SRP-330, Xprinter (budget). For PWA, print via:
  - LAN printer + a small print-bridge service (recommended) or
  - Browser print via `window.print()` on a hidden A4-mapped layout, or
  - Electron build for direct ESC/POS over USB/LAN.
- **Cash drawer** — RJ11 connected to printer; printer triggers it on payment.
- **Card terminal** — MVP: standalone terminal from the merchant's bank (SIBS/Redunicre/Stripe/SumUp/Viva). Cashier confirms terminal result; system records the payment.

### Later (Phase 2–4)

- **Weighing scale** — read weight via serial/USB; for butchers and groceries. Integrate via local agent.
- **Barcode label printer** — Zebra/TSC label printer for in-shop labelling.
- **Customer display** — second screen showing cart total to customer.
- **Mobile scanner** — phone camera scanner for stock counts and receiving.
- **Card terminal direct integration** — SIBS, Stripe Terminal, SumUp, Viva — per partner availability.

### Common problems

- USB drivers and Windows updates breaking printers — keep a fallback print path.
- Scanners with locale issues (Portuguese keyboard layout) — configure scanner to US/PT layout consistently.
- Network printers losing IP — recommend MAC/IP reservations.
- Power loss during sale — idempotent sale creation + offline cache.

### Hardware testing protocol

- Before any pilot, run a 100-sale stress test with each printer + scanner combo.
- Document a "Tested hardware" page on the website. Sell pre-tested kits.

---

## 23. Offline POS Mode

Offline support is a differentiator but a danger zone for stock. We design conservatively.

### What works offline

- Login (cached credentials with limited TTL).
- Product catalogue, prices, IVA rates, customer search, recent sales lookup (read-only).
- POS sale creation with cash, card (manual confirm), MB WAY (manual confirm).
- Local cash session and cash drawer movements.

### What does NOT work offline

- Online orders/storefront.
- Real-time low-stock cross-branch view.
- Card/MB WAY automatic confirmation via gateway.
- Certified fiscal document issuance via the partner — if the partner requires online — cashier issues a temporary internal receipt and the fiscal document is generated and emailed once back online (compliance flow to be validated with the partner and a Portuguese accountant before launch).

### Local storage and sync

- IndexedDB with versioned schema; encrypted at rest where the platform allows.
- Outbox pattern: local actions become events; service worker syncs to backend with idempotency keys.
- Pull catalog and stock snapshots on terminal start; refresh in background.

### Conflict handling

- Stock decrements: each local sale has an idempotency key. Server applies and reconciles. If offline sales would push a SKU into negative on the server, the server still records them (truth of what was sold) but raises an `oversold` alert for the manager.
- Price/discount changes after offline catalog snapshot: the sale is recorded with the local price (recorded as `applied_price_at_time`), and a variance report flags differences.

### Last-item / oversell prevention

- Configurable "online-only mode" toggle: if checked, terminal refuses to sell SKUs that the server no longer flags as available — used during heavy promotions or when oversell risk is too high.
- For shops with online store + multi-branch: stock reservation always happens server-side; offline POS is only allowed to sell from a per-terminal reserved pool topped up while online.

### Sync alerts

- If a terminal has not synced in N minutes: red banner.
- If sync queue exceeds K events: block new sales until manager override.
- Daily report shows offline-sales count and any conflicts.

### Risk rules

- Configurable per tenant: max offline sales per session, max offline duration, allowed payment methods offline (e.g., disable card if terminal is offline).

---

## 24. Security Plan

- **Multi-tenant isolation**: `tenant_id` on every tenant-scoped table; PostgreSQL Row-Level Security policies enforced at the database layer; integration tests prove a user from tenant A cannot read tenant B.
- **RBAC**: role + permission codes; permissions checked at the API layer; sensitive actions also require a fresh password / 2FA challenge.
- **2FA**: TOTP for owners, super admins, and accountants. Optional for cashiers.
- **Password policy**: Argon2id, 12+ chars, breached-password check (HIBP API), forced rotation for super admins.
- **API authentication**: short-lived JWT (≤15 min) + rotating refresh tokens bound to device fingerprint; revocation list in Redis.
- **Encryption in transit**: HTTPS only, TLS 1.2+ (prefer 1.3), HSTS, secure cookies, mTLS for internal service hops where worth it.
- **Encryption at rest**: managed Postgres + S3 with encryption on; sensitive fields (integration credentials, NIFs where required) additionally application-encrypted with KMS keys.
- **Audit logs**: immutable, exported daily to cold storage; track who/what/when/IP/UA.
- **Admin action logs**: any super admin action against a tenant is logged and surfaced in the tenant's own audit screen.
- **Login monitoring**: rate-limit login attempts, lock account after N tries, alert on impossible-travel.
- **Session management**: idle timeout, device list, revoke session, "log out all devices".
- **Backups**: encrypted, periodic restore drills (test the restore, not just the backup).
- **Secrets management**: cloud secret manager (AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault); no secrets in repo or logs.
- **Dependency security**: SCA in CI (npm audit, Snyk, Trivy for containers), pinned versions, weekly cron for upgrades.
- **Secure SDLC**: code review, threat modelling for each module, SAST in CI, periodic external pen-test before charging multi-branch chains.
- **Card data**: never on our servers. Tokenisation only. PCI-DSS scope minimised (SAQ-A or SAQ-A-EP depending on integration choice — to confirm with the gateway).
- **Data access control**: production DB access via bastion + MFA + just-in-time approval; all production queries logged.
- **Bug bounty / responsible disclosure**: from Phase 7, publish a security.txt and a coordinated disclosure policy.

---

## 25. Compliance and Legal Considerations

> Every item below must be verified with a Portuguese certified accountant (TOC/CC), a tax/legal advisor, and where relevant the AT and CNPD. This plan assumes the founder will engage these professionals before charging the first euro.

- **GDPR (RGPD)**:
  - Data minimisation; document a Record of Processing Activities (RoPA).
  - Lawful bases per processing purpose (contract, legitimate interest, consent for marketing).
  - DPA (Data Processing Agreement) with every tenant; sub-processor list public.
  - Data subject rights: access, rectification, erasure, portability — surface a self-serve tool.
  - EU-only data residency by default; document any sub-processor outside the EEA with appropriate safeguards.
  - Designate a DPO if/when scale and processing categories require it.
  - Consider registration considerations with CNPD; verify with counsel.
- **Payment security**:
  - PCI-DSS scope minimised by using hosted gateways and tokenisation.
  - SCA (Strong Customer Authentication) / 3-D Secure 2 honoured by gateway integration.
- **Card data handling**: never stored, ever. No logs containing PAN.
- **Portugal VAT/IVA configuration**: configurable per product and per branch; verify rates and edge cases (Madeira/Azores, reduced/intermediate categories) with accountant.
- **Certified invoicing**: in MVP, fiscal documents are issued by a certified partner; we are a "front-end" that delegates issuance. Path to our own certification is Phase 8 or later, after legal/AT validation.
- **ATCUD / QR code / SAF-T (PT)**: ATCUD and QR codes appear on the partner-issued documents; we render and store them; SAF-T (PT) is exported by the partner and surfaced inside ShopOS for the accountant; if we ever issue documents ourselves, we generate ATCUD/QR/SAF-T per AT specs.
- **Data retention**: tenant data kept for the life of the contract + statutory retention (e.g., 10 years for fiscal records — verify); deletion workflow on contract end.
- **Terms and conditions**: covering subscription, fair-use, liability cap, governing law (Portugal), arbitration/jurisdiction.
- **Privacy policy**: public, plain-Portuguese.
- **Client contracts**: short subscription agreement + DPA + SLA addendum; pilot agreement; reseller/partner agreement template.
- **SLA**: defined per plan in §28.
- **Employment & contractor compliance**: Portuguese labour law for employees, recibo-verde or service contracts for contractors, all checked by counsel.
- **Open source compliance**: license inventory; avoid copyleft in distributed binaries unless deliberate.

Items that explicitly need professional verification:

- Whether and when our software requires AT certification.
- Exact ATCUD/QR/SAF-T (PT) flows when partner-issued.
- Lawful bases and DPO threshold for our processing.
- Cross-border transfer mechanisms if we use a non-EU sub-processor.
- E-invoicing obligations for B2G and B2B contexts.

---

## 26. Testing and QA Plan

- **Unit tests**: pure logic (pricing, IVA breakdown, stock-balance math, refund math, loyalty calculation, discount stacking). Target ≥ 80% coverage on these modules.
- **Integration tests**: API + database, with Postgres test container; verify RLS isolation between tenants in every test.
- **End-to-end tests** (Playwright): full POS flow, supplier receiving, online order to delivery, branch transfer, refund.
- **POS speed test**: 1,000 simulated sales in a session, p95 sale latency < 800 ms server-side.
- **Barcode scanning test**: 200 SKUs scanned via real scanner, 0 mis-reads, < 200 ms recognition.
- **Stock accuracy test**: random walk of receipts, sales, returns, transfers, adjustments; verify ledger == derived balance after every event.
- **Supplier receiving test**: partial deliveries, cost variance, batch/expiry capture, 3-way match.
- **Till closing test**: simulated 8-hour shift with 300 sales + 5 refunds + 2 cash drops; difference must be exactly 0.
- **Refund test**: full and partial refunds, multiple payment methods, store credit, returns to different states (sellable/damaged/expired).
- **Offline sync test**: 1,000 offline sales then reconnect; idempotency holds; alerts raised correctly.
- **Payment failure test**: gateway timeouts, declines, double-clicks, network drop mid-payment.
- **Permission test**: each role tested against every endpoint; auto-generated matrix; 0 cross-tenant leaks tolerated.
- **Security test**: OWASP top-10 checks, SAST in CI, periodic external pen-test before charging multi-branch chains.
- **Load test**: 100 concurrent POS terminals across 50 tenants; storefront 1,000 RPS.
- **Backup restore test**: monthly restore drill into a clean environment; data parity verified.
- **Pilot shop test**: 30 days in a real shop, daily KPI review, weekly retro.

QA cadence: every PR runs unit + integration + a curated E2E smoke; full E2E nightly; load test before each major release.

---

## 27. DevOps and Deployment Plan

### Environments

- **Local** — Docker Compose: app + Postgres + Redis + MinIO + Mailhog.
- **Development** — auto-deployed from `develop` branch; ephemeral preview envs per PR.
- **Staging** — production-like; copy of anonymised data; used for UAT and load tests.
- **Production** — EU region; one or two app servers; managed Postgres with read replica; managed Redis; CDN; WAF; backups.

### CI/CD

- GitHub Actions: lint → typecheck → unit → integration → SAST → SCA → build images → push to registry.
- Deploy to dev on merge to `develop`; staging on tag `staging-*`; production on tag `v*` with manual approval.
- Database migrations: forward-only, versioned, gated by review; expand-then-contract for risky changes; never destructive in a single deploy.

### Observability

- **Logging**: structured JSON; tenant_id and request_id on every line; ship to Loki/Elastic.
- **Metrics**: Prometheus/Grafana; SLOs per service (POS API p95, online order success rate, payment success rate, ledger consistency lag).
- **Errors**: Sentry; alert routing to on-call; PagerDuty/Opsgenie for paid plans.
- **Tracing**: OpenTelemetry from API to DB; sampled traces.

### Backup & rollback

- Postgres point-in-time recovery; nightly full snapshot replicated to a second region; encrypted.
- Object storage versioning + lifecycle.
- Rollback strategy: blue/green or canary for app; DB migrations require explicit forward and backward plans; feature flags to dark-launch risky features.

### Release management

- Two-week release train + emergency hotfix path.
- Release notes per tenant in-app and email.
- Pilot tenants on a "canary" channel that gets releases 1 week before others.

### Cost discipline

- Right-size from day one (no Kubernetes for 5 customers).
- Monthly cloud bill review; alerts on anomalies.

---

## 28. Support and Maintenance Plan

### Support ticket system

- In-app ticket form + email + WhatsApp/phone for Pro+; status, priority, ownership.
- Categories: bug, how-to, hardware, integration, billing, feature request.

### Priority levels and SLAs

| Priority      | Definition                         | First response                           | Resolution target | Plan          |
| ------------- | ---------------------------------- | ---------------------------------------- | ----------------- | ------------- |
| P1 — Down     | POS cannot sell, store-wide outage | 15 min business hours / 60 min off-hours | 4 hours           | Pro and above |
| P2 — Major    | Sales possible, key feature broken | 1 hour business hours                    | 1 business day    | All paid      |
| P3 — Minor    | Workaround exists                  | 1 business day                           | 5 business days   | All paid      |
| P4 — Question | How-to                             | 1 business day                           | best effort       | All paid      |

### Bug reporting

- In-app "report a problem" attaches device, version, last 50 actions; auto-creates Sentry-linked ticket.

### Feature request handling

- Public feedback portal (Canny-like) with voting; product reviews monthly; quarterly roadmap published.

### Client training

- Day 1: 2-hour in-shop training, recorded.
- Week 1: daily 15-minute check-in.
- Week 4: review call.
- Ongoing: monthly tip email, quarterly webinar.

### Knowledge base

- Searchable, Portuguese + English, video and screenshots; top 50 articles within first 3 months.

### Remote support

- Consent-based screen-share + impersonate-with-audit. No silent access ever.

### On-site setup

- Lisbon/Porto same-week visits at €80–€150; rest of mainland next-week at €150–€250 + travel; islands case-by-case.

### Maintenance contract

- Included in subscription: security updates, bug fixes, minor improvements.
- Excluded: custom development (billed separately, change-request based).

---

## 29. Risks and Mitigation

| Risk                              | Impact                     | Mitigation                                                                             | Prevention                                             |
| --------------------------------- | -------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Stock mismatch with reality       | Owner loses trust on day 1 | Mandatory monthly count; ledger truth tests; reconciliation alerts                     | Stock-ledger architecture (§10); idempotent operations |
| Slow POS                          | Cashiers refuse to use it  | SLO on POS p95 < 800 ms; offline cache; pre-loaded catalog                             | Performance budget in CI; load tests                   |
| Offline sync conflict             | Oversells, double-bookings | Offline guardrails (§23); idempotency keys; alerts                                     | Conservative offline design; per-tenant offline policy |
| Payment failure                   | Lost sale, angry customer  | Retry + idempotency; manual override path; dual confirmation                           | Gateway selection diligence; health checks             |
| Legal/compliance issue (AT, GDPR) | Fines, contract loss       | Engage TOC/CC + legal counsel before launch; partner with certified invoicing provider | Periodic compliance review; documented RoPA/DPA        |
| Customer resistance to change     | Long sales cycle           | Free 30-day pilot; on-site go-live; case studies                                       | Clear ROI calculator; vertical playbooks               |
| Complex onboarding                | High CAC; bad reviews      | Onboarding playbook; pre-built templates per vertical; data-import wizard              | Self-serve where possible; in-app checklist            |
| Data loss                         | Existential                | PITR + cross-region snapshots; restore drills                                          | Immutable ledger + audit log + backups                 |
| Security breach                   | Brand-ending               | Defense-in-depth (§24); pen-test; bug bounty                                           | Secure SDLC; least privilege; encryption               |
| Wrong profit calculation          | Owner trust                | COGS = weighted-average cost from receipts; visible formula; comparison report         | Daily audit of cost movements                          |
| Hardware failure                  | Shop cannot sell           | Recommend dual printer setup for high-volume shops; spare scanner; UPS                 | Pre-tested kits; documented troubleshooting            |
| Too many features too early       | Bloated, slow, buggy       | Strict MVP scope; phase gates; "say no" culture                                        | Quarterly roadmap pruning                              |
| Founder/key-person dependency     | Single point of failure    | Document everything; cross-train; runbook for ops                                      | Hiring plan in §30                                     |
| Competitor undercuts price        | Price war                  | Differentiate on stock + multi-channel + local support, not price                      | Don't compete on price; compete on value               |
| Currency/macroeconomic shock      | Reduced spend              | Annual contracts; long-term partner discounts                                          | Cash buffer (≥6 months runway)                         |

---

## 30. Team and Resource Plan

### Roles (long-term ideal)

- **Product Manager** — backlog, roadmap, customer interviews, release notes.
- **UI/UX Designer** — flows, mocks, design system, usability tests.
- **Frontend Developer × 2** — admin web, POS PWA, storefront.
- **Backend Developer × 2–3** — modular monolith, integrations, reports.
- **Database / Data Engineer** — schema, performance, reporting layer, AI data prep (Phase 6).
- **QA Tester** — manual + automation; pilot shadowing.
- **DevOps Engineer** — CI/CD, infra, observability, on-call.
- **Support Person** — first responder, KB writing, training calls.
- **Sales / Onboarding Person** — shop visits, demos, pilot management.
- **Founder/CEO** — strategy, partners, key sales, hiring.

### MVP minimum viable team (Day 0–90)

| Role                            | Headcount | Responsibility                                  | Notes                    |
| ------------------------------- | --------- | ----------------------------------------------- | ------------------------ |
| Founder / Product / Sales       | 1         | Vision, customer dev, sales, partner management | You                      |
| Backend developer (senior)      | 1         | Domain model, ledger, POS API, integrations     | Hire first               |
| Backend developer (mid)         | 1         | Suppliers, reports, internal admin              |                          |
| Frontend developer (mid/senior) | 1         | POS PWA + admin UI                              | Critical hire            |
| Frontend / full-stack (mid)     | 1         | Storefront (Phase 3) and admin                  | Can join in month 3      |
| QA / Support                    | 1         | Test, write KB, support pilot                   | Can be junior, will grow |
| Designer (part-time)            | 0.4       | Wireframes + design system                      | Contractor at first      |
| DevOps (part-time)              | 0.3       | CI/CD, infra, monitoring                        | Contractor or shared     |

Total Day-90: ~5.5 FTE + founder.

After pilot validation (month 6): add 1 sales/onboarding, 1 backend dev, convert designer/devops to full-time as needed.

### Hiring location

- Mix of Lisbon/Porto in-person leads and remote-EU mid/senior engineers. Portuguese-speaking sales/onboarding/support is non-negotiable.

### Compensation philosophy

- Pay at-or-above the Portuguese market median for retention; reasonable equity for early hires; private health insurance once revenue allows; meal card; clear progression.

---

## 31. Development Milestones

Concrete, dated, owner-assigned milestones (week numbers from Day 0):

- W2: Product validation complete (≥30 interviews, top 5 pains confirmed).
- W3: MVP scope locked (signed-off §6).
- W4: Tech stack and architecture decided (signed-off §17 / §18).
- W5: Database design v1 reviewed and committed.
- W6: Repo, CI, environments, observability skeleton ready.
- W8: POS prototype clickable on real tablet with mock data.
- W10: Stock ledger module passes truth tests; product module GA.
- W12: Supplier receiving end-to-end works in staging.
- W13: Till open/close + Z-report works end-to-end.
- W14: Reports v1 (daily, stock, basic profit) ready.
- W15: Internal end-to-end testing complete on synthetic data.
- W16: Pilot shop go-live (real sales).
- W20: First paid customer (post-pilot).
- W24: 5 paying customers; case study published.
- W28: Online store live (Phase 3) for at least 1 customer.
- W34: Multi-branch live (Phase 4) for at least 1 customer.
- W42: Loyalty + credit + advanced reports (Phase 5) live.
- W54: AI suggestions (Phase 6) in beta.
- W60: SaaS billing self-serve and partner channel signed.
- W72: 200+ paying tenants; Version 2 roadmap kicked off.

Each milestone has: owner, acceptance criteria, demo to founder + (where relevant) pilot owner, postmortem if missed.

---

## 32. Final Recommendation

### 32.1 Is this business worth building?

Yes — with discipline. The Portuguese small-retail market is large, painful, and under-served by modern, stock-first, multi-channel software. There is room for a focused, owner-friendly SaaS that combines POS, stock, suppliers, branches, and an online store. The combination of recurring revenue + setup + hardware margin + support packages, plus an AI add-on later, is a genuine SaaS economic engine, not a one-off project. Risk is real but manageable: the biggest risks are (a) trying to build too much before product-market fit, (b) underestimating Portuguese fiscal compliance (mitigated by partnering with a certified invoicing provider in MVP), and (c) running out of cash before reaching ~50 paying shops.

### 32.2 What should you build first?

Build the MVP exactly as scoped in §6: tenants, roles, products, **stock ledger**, **POS sale + payment + receipt**, **till open/close**, **supplier receiving**, **low-stock alerts**, **daily/profit reports**, **audit log**, **backup**, internal admin. Integrate with one certified invoicing partner. Nothing else.

The single most important asset to get right is the **stock ledger**. Everything else (POS, supplier, online, multi-branch, AI) is downstream of it.

### 32.3 What should you avoid?

- Restaurant features (KDS, table maps) until Phase 7+.
- Building your own certified invoicing engine from day one.
- Wallet / custodial money holding.
- Microservices and Kubernetes before €10k MRR.
- Selling to chains and pharmacies before MVP is rock-solid in 5+ small shops.
- Free-forever plans (kills the business).
- "Magic AI everywhere" marketing before you have data.
- Multi-country expansion before dominating Portugal.

### 32.4 Fastest path to the first paying customer

1. Identify 1 friendly mini mercado or halal shop with stock pain — week 1.
2. Sit in the shop for one full day, listen, take notes — week 1.
3. Build a 12-week MVP focused on what that shop actually needs — weeks 2–14.
4. Install and run the MVP in that shop for free for 30 days, on-site daily — weeks 15–18.
5. Convert to paid month 5; ask for a written 60-second testimonial and one referral — week 20.
6. Sell to the referred shop the same week using the case study — week 21.

### 32.5 6-month goal

- 5 paying customers, all renewed at month 6.
- 1 written + video case study; 2 referral customers.
- ≥ 95% pilot Z-report match within €0.50.
- Phase 1 fully shipped; Phase 2 (supplier/PO) shipped; Phase 3 (online) in beta with 1 customer.
- 2 partners signed (1 accountant, 1 IT/hardware reseller).
- Compliance pre-read complete; certified invoicing partner integration live.

### 32.6 12-month goal

- 50–80 paying shops; €4.5k–€9k MRR; ≥ 1 multi-branch reference customer.
- Phases 1–3 GA; Phase 4 (multi-branch) live; Phase 5 in flight.
- Self-serve signup for Starter plan.
- Net revenue retention ≥ 100%; gross monthly churn ≤ 2.5%.
- Team: ~6–8 people including founder; runway ≥ 9 months.
- Brand recognition in target neighbourhoods; first chain prospect in pipeline.

### 32.7 Closing note

Treat this document as a living plan. Validate it against real shops in the next 30 days, update §6 and §13 with what you learn, and only then commit engineering money. The companies that win SMB SaaS in Portugal will be the ones that show up in person, build for the shop owner (not the accountant), keep the stock ledger honest, and stay disciplined about scope. ShopOS can be that company.
