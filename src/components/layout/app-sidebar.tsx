"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  FilePlus2,
  FolderTree,
  KeyRound,
  MapPin,
  Monitor,
  Package,
  PackagePlus,
  Receipt,
  ScanBarcode,
  ScanLine,
  Settings,
  Shield,
  ShieldCheck,
  Store,
  Tag,
  Truck,
  Globe,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth/tenant";
import { useT } from "@/components/i18n/locale-provider";

type NavGroup = "sell" | "stock" | "buy" | "settings";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  roles?: AppRole[];
  group: NavGroup;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    icon: <BarChart3 className="size-4 shrink-0" />,
    group: "sell",
  },
  {
    href: "/pos",
    labelKey: "nav.pos",
    icon: <ScanLine className="size-4 shrink-0" />,
    roles: ["owner", "manager", "cashier", "warehouse"],
    group: "sell",
  },
  {
    href: "/sales",
    labelKey: "nav.sales",
    icon: <Receipt className="size-4 shrink-0" />,
    roles: ["owner", "manager", "cashier", "accountant"],
    group: "sell",
  },
  {
    href: "/online-orders",
    labelKey: "nav.onlineOrders",
    icon: <Globe className="size-4 shrink-0" />,
    roles: ["owner", "manager", "delivery"],
    group: "sell",
  },
  {
    href: "/sessions",
    labelKey: "nav.sessions",
    icon: <KeyRound className="size-4 shrink-0" />,
    roles: ["owner", "manager", "cashier"],
    group: "sell",
  },
  {
    href: "/sessions/shift",
    labelKey: "nav.shiftAccount",
    icon: <ClipboardList className="size-4 shrink-0" />,
    roles: ["owner", "manager", "cashier", "accountant"],
    group: "sell",
  },
  {
    href: "/products",
    labelKey: "nav.products",
    icon: <Package className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
    group: "stock",
  },
  {
    href: "/stock/receive",
    labelKey: "nav.receiveStock",
    icon: <ScanBarcode className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
    group: "stock",
  },
  {
    href: "/categories",
    labelKey: "nav.categories",
    icon: <FolderTree className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
    group: "stock",
  },
  {
    href: "/brands",
    labelKey: "nav.brands",
    icon: <Tag className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
    group: "stock",
  },
  {
    href: "/products/import",
    labelKey: "nav.import",
    icon: <Boxes className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
    group: "stock",
  },
  {
    href: "/suppliers",
    labelKey: "nav.suppliers",
    icon: <Truck className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
    group: "buy",
  },
  {
    href: "/purchase-orders",
    labelKey: "nav.purchaseOrders",
    icon: <FilePlus2 className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
    group: "buy",
  },
  {
    href: "/goods-receipts",
    labelKey: "nav.goodsReceipts",
    icon: <PackagePlus className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
    group: "buy",
  },
  {
    href: "/audit",
    labelKey: "nav.audit",
    icon: <ShieldCheck className="size-4 shrink-0" />,
    roles: ["owner", "manager", "accountant", "support_admin", "super_admin"],
    group: "settings",
  },
  {
    href: "/settings/shops",
    labelKey: "nav.shops",
    icon: <Store className="size-4 shrink-0" />,
    roles: ["owner"],
    group: "settings",
  },
  {
    href: "/settings/branches",
    labelKey: "nav.branches",
    icon: <MapPin className="size-4 shrink-0" />,
    roles: ["owner", "manager"],
    group: "settings",
  },
  {
    href: "/settings/team",
    labelKey: "nav.team",
    icon: <Users className="size-4 shrink-0" />,
    roles: ["owner", "manager"],
    group: "settings",
  },
  {
    href: "/settings/tills",
    labelKey: "nav.tills",
    icon: <Monitor className="size-4 shrink-0" />,
    roles: ["owner", "manager"],
    group: "settings",
  },
  {
    href: "/settings/storefront",
    labelKey: "nav.storefront",
    icon: <Settings className="size-4 shrink-0" />,
    roles: ["owner", "manager", "super_admin"],
    group: "settings",
  },
  {
    href: "/settings/billing",
    labelKey: "nav.billing",
    icon: <CreditCard className="size-4 shrink-0" />,
    roles: ["owner"],
    group: "settings",
  },
];

const GROUP_ORDER: NavGroup[] = ["sell", "stock", "buy", "settings"];
const GROUP_KEYS: Record<NavGroup, string> = {
  sell: "nav.sell",
  stock: "nav.stock",
  buy: "nav.buy",
  settings: "nav.settings",
};

interface Props {
  role: AppRole;
  showPlatform?: boolean;
  mobile?: boolean;
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/sessions") {
    return (
      pathname === "/sessions" ||
      pathname.startsWith("/sessions/open") ||
      /^\/sessions\/[0-9a-f-]+$/i.test(pathname)
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ role, showPlatform, mobile }: Props) {
  const pathname = usePathname() ?? "";
  const { t } = useT();
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <aside
      data-app-sidebar
      className={cn(
        "border-border bg-card/95 flex w-56 shrink-0 flex-col border-r",
        mobile ? "h-full w-full border-0" : "hidden md:flex",
      )}
      aria-label={t("a11y.mainNav")}
    >
      <nav className="flex flex-1 flex-col overflow-y-auto py-3">
        <ul className="flex flex-col gap-0.5 px-2">
          {showPlatform ? (
            <li>
              <Link
                href="/platform"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname.startsWith("/platform")
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Shield className="size-4 shrink-0" />
                <span className="font-medium">{t("nav.platform")}</span>
              </Link>
            </li>
          ) : null}
          {GROUP_ORDER.map((group) => {
            const groupItems = items.filter((item) => item.group === group);
            if (groupItems.length === 0) return null;
            return (
              <li key={group} className="mt-2 first:mt-0">
                <p className="text-muted-foreground px-3 pb-1 text-[10px] font-semibold tracking-wider uppercase">
                  {t(GROUP_KEYS[group])}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {groupItems.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive(pathname, item.href)
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                      >
                        {item.icon}
                        <span className="font-medium">{t(item.labelKey)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

/** @deprecated Use AppSidebar — kept for imports that still reference TopNav */
export const TopNav = AppSidebar;
