-- =============================================================================
-- ShopOS - Step 4 - Migration 02: Enumerated types
-- =============================================================================

-- Tenant status
create type public.tenant_status as enum (
  'pending',     -- created but not yet activated
  'trial',       -- in 30-day pilot
  'active',      -- paying customer
  'past_due',    -- payment failed
  'suspended',   -- access blocked by us
  'cancelled'    -- terminated
);

-- User role within a tenant
create type public.user_role as enum (
  'super_admin',     -- ShopOS company staff (platform-wide)
  'support_admin',   -- ShopOS support staff (read + impersonate)
  'owner',           -- the shop owner / tenant admin
  'manager',         -- branch manager
  'cashier',         -- POS operator
  'warehouse',       -- warehouse / receiving staff
  'accountant',      -- read-only financial access
  'delivery'         -- delivery rider for online orders
);

-- POS session (till) status
create type public.pos_session_status as enum (
  'open',
  'closed',
  'force_closed'
);

-- Sale channel
create type public.sale_channel as enum (
  'pos',
  'online',
  'b2b',
  'phone'
);

-- Sale status
create type public.sale_status as enum (
  'completed',
  'voided',
  'refunded',
  'partially_refunded'
);

-- Payment method
create type public.payment_method as enum (
  'cash',
  'card',
  'contactless',
  'apple_pay',
  'google_pay',
  'revolut',
  'bank_transfer',
  'store_credit',
  'customer_account',
  'voucher'
);

-- Payment status
create type public.payment_status as enum (
  'pending',
  'authorised',
  'captured',
  'failed',
  'refunded',
  'partially_refunded',
  'voided'
);

-- Stock movement state
create type public.stock_state as enum (
  'available',
  'reserved',
  'sold',
  'damaged',
  'expired',
  'in_transit',
  'returned',
  'quarantine'
);

-- Stock movement type (reason)
create type public.stock_movement_type as enum (
  'goods_receipt',
  'pos_sale',
  'online_reserve',
  'online_release',
  'online_ship',
  'damaged',
  'expired',
  'transfer_out',
  'transfer_in',
  'return',
  'adjustment',
  'opening_balance',
  'count_correction'
);

-- Purchase order status
create type public.purchase_order_status as enum (
  'draft',
  'submitted',
  'partially_received',
  'received',
  'cancelled',
  'closed'
);

-- Goods receipt status
create type public.goods_receipt_status as enum (
  'draft',
  'finalised',
  'cancelled'
);

-- Cash drawer movement type
create type public.cash_movement_type as enum (
  'opening',
  'sale',
  'refund_out',
  'cash_drop',
  'expense',
  'pay_in',
  'pay_out',
  'closing'
);

-- IE VAT codes (mirror src/lib/constants.ts)
create type public.vat_code as enum (
  'STD',  -- 23%
  'RED',  -- 13.5%
  'SEC',  -- 9%
  'LIV',  -- 4.8%
  'ZER',  -- 0%
  'EXE'   -- exempt
);
