/**
 * Platform super-admin accounts (LOCAL DEVELOPMENT ONLY).
 *
 * Add more rows to seed additional ShopOS Platform operators.
 * Run: npm run db:seed:platform
 *
 * Do not use real production passwords here. For production, create users
 * via signup + `npm run db:seed:platform -- email@company.com` or the
 * Platform → Platform staff UI after the first admin exists.
 */
export type PlatformSuperAdminSeed = {
  email: string;
  password: string;
  fullName: string;
};

/** Local seed password — set PLATFORM_SEED_PASSWORD in .env.local; never commit real production passwords. */
const seedPassword = process.env.PLATFORM_SEED_PASSWORD?.trim() || "ChangeMe-Platform-Seed-Only";

export const PLATFORM_SUPERADMINS: PlatformSuperAdminSeed[] = [
  {
    email: "md.rashidunnabicit@gmail.com",
    password: seedPassword,
    fullName: "Rashid (Platform Super Admin)",
  },
];
