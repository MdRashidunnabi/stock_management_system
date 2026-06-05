"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CreditCard,
  FilePlus2,
  FolderTree,
  KeyRound,
  Package,
  PackagePlus,
  Receipt,
  ScanLine,
  Settings,
  Shield,
  ShieldCheck,
  Tag,
  Truck,
  Globe,
  MapPin,
  Store,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth/tenant";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: AppRole[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <BarChart3 className="size-4" /> },
  {
    href: "/pos",
    label: "POS",
    icon: <ScanLine className="size-4" />,
    roles: ["owner", "manager", "cashier"],
  },
  {
    href: "/sales",
    label: "Sales",
    icon: <Receipt className="size-4" />,
    roles: ["owner", "manager", "cashier", "accountant"],
  },
  {
    href: "/online-orders",
    label: "Online",
    icon: <Globe className="size-4" />,
    roles: ["owner", "manager"],
  },
  {
    href: "/sessions",
    label: "Till",
    icon: <KeyRound className="size-4" />,
    roles: ["owner", "manager", "cashier"],
  },
  {
    href: "/products",
    label: "Products",
    icon: <Package className="size-4" />,
    roles: ["owner", "manager", "warehouse"],
  },
  {
    href: "/categories",
    label: "Categories",
    icon: <FolderTree className="size-4" />,
    roles: ["owner", "manager", "warehouse"],
  },
  {
    href: "/brands",
    label: "Brands",
    icon: <Tag className="size-4" />,
    roles: ["owner", "manager", "warehouse"],
  },
  {
    href: "/suppliers",
    label: "Suppliers",
    icon: <Truck className="size-4" />,
    roles: ["owner", "manager", "warehouse"],
  },
  {
    href: "/purchase-orders",
    label: "Orders",
    icon: <FilePlus2 className="size-4" />,
    roles: ["owner", "manager", "warehouse"],
  },
  {
    href: "/goods-receipts",
    label: "Receiving",
    icon: <PackagePlus className="size-4" />,
    roles: ["owner", "manager", "warehouse"],
  },
  {
    href: "/audit",
    label: "Audit",
    icon: <ShieldCheck className="size-4" />,
    roles: ["owner", "manager", "accountant", "support_admin", "super_admin"],
  },
  {
    href: "/settings/shops",
    label: "My shops",
    icon: <Store className="size-4" />,
    roles: ["owner"],
  },
  {
    href: "/settings/branches",
    label: "Branches",
    icon: <MapPin className="size-4" />,
    roles: ["owner", "manager"],
  },
  {
    href: "/settings/billing",
    label: "Billing",
    icon: <CreditCard className="size-4" />,
    roles: ["owner"],
  },
  {
    href: "/settings/team",
    label: "Team",
    icon: <Users className="size-4" />,
    roles: ["owner", "manager"],
  },
  {
    href: "/settings/storefront",
    label: "Shop",
    icon: <Settings className="size-4" />,
    roles: ["owner", "manager", "super_admin"],
  },
];

interface Props {
  role: AppRole;
  showPlatform?: boolean;
}

export function TopNav({ role, showPlatform }: Props) {
  const pathname = usePathname() ?? "";

  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <nav
      className="border-border/80 bg-card/90 -mx-4 overflow-x-auto rounded-b-xl border-b px-2 pb-1 shadow-sm backdrop-blur-sm sm:-mx-6 sm:px-4 lg:-mx-8 lg:px-6"
      aria-label="Main navigation"
    >
      <ul className="flex items-center gap-0.5 py-1">
        {showPlatform ? (
          <li>
            <Link
              href="/platform"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                pathname.startsWith("/platform")
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Shield className="size-4" />
              <span className="font-medium">Platform</span>
            </Link>
          </li>
        ) : null}
        {items.map((item) => {
          const active =
            item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="ml-auto flex items-center gap-2">
          <Link
            href="/products/import"
            className="text-info hover:bg-info/10 hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium sm:flex"
          >
            <Boxes className="size-3.5" />
            Bulk import
          </Link>
        </li>
      </ul>
    </nav>
  );
}
