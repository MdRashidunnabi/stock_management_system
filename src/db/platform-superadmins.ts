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

export const PLATFORM_SUPERADMINS: PlatformSuperAdminSeed[] = [
  {
    email: "md.rashidunnabicit@gmail.com",
    password: "3546611398@Ra",
    fullName: "Rashid (Platform Super Admin)",
  },
];
