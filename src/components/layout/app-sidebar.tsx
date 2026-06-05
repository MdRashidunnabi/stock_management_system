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
  MapPin,
  Package,
  PackagePlus,
  Receipt,
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

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: AppRole[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <BarChart3 className="size-4 shrink-0" /> },
  {
    href: "/pos",
    label: "POS",
    icon: <ScanLine className="size-4 shrink-0" />,
    roles: ["owner", "manager", "cashier"],
  },
  {
    href: "/sales",
    label: "Sales",
    icon: <Receipt className="size-4 shrink-0" />,
    roles: ["owner", "manager", "cashier", "accountant"],
  },
  {
    href: "/online-orders",
    label: "Online",
    icon: <Globe className="size-4 shrink-0" />,
    roles: ["owner", "manager"],
  },
  {
    href: "/sessions",
    label: "Till",
    icon: <KeyRound className="size-4 shrink-0" />,
    roles: ["owner", "manager", "cashier"],
  },
  {
    href: "/products",
    label: "Products",
    icon: <Package className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
  },
  {
    href: "/categories",
    label: "Categories",
    icon: <FolderTree className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
  },
  {
    href: "/brands",
    label: "Brands",
    icon: <Tag className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
  },
  {
    href: "/suppliers",
    label: "Suppliers",
    icon: <Truck className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
  },
  {
    href: "/purchase-orders",
    label: "Orders",
    icon: <FilePlus2 className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
  },
  {
    href: "/goods-receipts",
    label: "Receiving",
    icon: <PackagePlus className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
  },
  {
    href: "/audit",
    label: "Audit",
    icon: <ShieldCheck className="size-4 shrink-0" />,
    roles: ["owner", "manager", "accountant", "support_admin", "super_admin"],
  },
  {
    href: "/settings/shops",
    label: "My shops",
    icon: <Store className="size-4 shrink-0" />,
    roles: ["owner"],
  },
  {
    href: "/settings/branches",
    label: "Branches",
    icon: <MapPin className="size-4 shrink-0" />,
    roles: ["owner", "manager"],
  },
  {
    href: "/settings/billing",
    label: "Billing",
    icon: <CreditCard className="size-4 shrink-0" />,
    roles: ["owner"],
  },
  {
    href: "/settings/team",
    label: "Team",
    icon: <Users className="size-4 shrink-0" />,
    roles: ["owner", "manager"],
  },
  {
    href: "/settings/storefront",
    label: "Shop",
    icon: <Settings className="size-4 shrink-0" />,
    roles: ["owner", "manager", "super_admin"],
  },
  {
    href: "/products/import",
    label: "Bulk import",
    icon: <Boxes className="size-4 shrink-0" />,
    roles: ["owner", "manager", "warehouse"],
  },
];

interface Props {
  role: AppRole;
  showPlatform?: boolean;
  /** Inside mobile drawer — always visible, full width */
  mobile?: boolean;
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function AppSidebar({ role, showPlatform, mobile }: Props) {
  const pathname = usePathname() ?? "";
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <aside
      className={cn(
        "border-border bg-card/95 flex w-56 shrink-0 flex-col border-r",
        mobile ? "h-full w-full border-0" : "hidden md:flex",
      )}
      aria-label="Main navigation"
    >
      <nav className="flex flex-1 flex-col overflow-y-auto py-3">
        <ul className="flex flex-col gap-0.5 px-2">
          {showPlatform ? (
            <li>
              <Link
                href="/platform"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  pathname.startsWith("/platform")
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Shield className="size-4 shrink-0" />
                <span className="font-medium">Platform</span>
              </Link>
            </li>
          ) : null}
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive(pathname, item.href)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

/** @deprecated Use AppSidebar — kept for imports that still reference TopNav */
export const TopNav = AppSidebar;
