/**
 * ShopOS subscription tiers (local dev + production billing).
 *
 * Shop tiers: how many separate shop businesses one owner can run.
 * Branch tiers: how many branches (locations) per shop — stock & website can differ per branch.
 *
 * More shops → lower price per shop. More branches → small add-on (volume discount).
 */

export const SHOP_TIER_OPTIONS = [1, 5, 10, 15, 20, 25, 30] as const;
export const BRANCH_TIER_OPTIONS = [1, 5, 10, 15, 20, 25, 30] as const;

export type ShopTier = (typeof SHOP_TIER_OPTIONS)[number];
export type BranchTier = (typeof BRANCH_TIER_OPTIONS)[number];

/** Cents per shop per month at each tier (volume discount). */
const PRICE_PER_SHOP_CENTS: Record<ShopTier, number> = {
  1: 2000,
  5: 1800,
  10: 1600,
  15: 1500,
  20: 1400,
  25: 1300,
  30: 1200,
};

/** Extra monthly cents for branch capacity tier (applies once per subscription). */
const BRANCH_ADDON_CENTS: Record<BranchTier, number> = {
  1: 0,
  5: 500,
  10: 900,
  15: 1200,
  20: 1500,
  25: 1800,
  30: 2000,
};

export function normalizeShopTier(n: number): ShopTier {
  const sorted = [...SHOP_TIER_OPTIONS];
  for (const t of sorted) {
    if (n <= t) return t;
  }
  return 30;
}

export function normalizeBranchTier(n: number): BranchTier {
  const sorted = [...BRANCH_TIER_OPTIONS];
  for (const t of sorted) {
    if (n <= t) return t;
  }
  return 30;
}

export function pricePerShopCents(shopTier: ShopTier): number {
  return PRICE_PER_SHOP_CENTS[shopTier];
}

export function calculateMonthlyCents(shopTier: ShopTier, branchTier: BranchTier): number {
  const shops = shopTier * pricePerShopCents(shopTier);
  const branches = BRANCH_ADDON_CENTS[branchTier];
  return shops + branches;
}

export function formatPlanSummary(shopTier: ShopTier, branchTier: BranchTier): string {
  const total = calculateMonthlyCents(shopTier, branchTier);
  const euros = (total / 100).toFixed(2);
  const perShop = (pricePerShopCents(shopTier) / 100).toFixed(2);
  const branchNote =
    branchTier === 1 ? "1 branch per shop" : `Up to ${branchTier} branches per shop`;
  return `Up to ${shopTier} shop${shopTier === 1 ? "" : "s"} (€${perShop} each) · ${branchNote} — €${euros}/month`;
}

export const PLAN_OPTIONS = SHOP_TIER_OPTIONS.map((shopTier) => ({
  shopTier,
  label: shopTier === 1 ? "1 shop — solo" : `Up to ${shopTier} shops — chain`,
  description: `€${(pricePerShopCents(shopTier) / 100).toFixed(2)} per shop / month`,
}));

export const BRANCH_PLAN_OPTIONS = BRANCH_TIER_OPTIONS.map((branchTier) => ({
  branchTier,
  label: branchTier === 1 ? "1 branch per shop" : `Up to ${branchTier} branches per shop`,
  addon:
    BRANCH_ADDON_CENTS[branchTier] === 0
      ? "Included"
      : `+€${(BRANCH_ADDON_CENTS[branchTier] / 100).toFixed(2)}/month`,
}));
