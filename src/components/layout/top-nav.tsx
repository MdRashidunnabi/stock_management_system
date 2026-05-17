"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, FolderTree, Package, Receipt, ScanLine, Tag, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: "/dashboard", label: "Dashboard", icon: <BarChart3 className="size-4" /> },
  { href: "/pos", label: "POS", icon: <ScanLine className="size-4" /> },
  { href: "/sales", label: "Sales", icon: <Receipt className="size-4" /> },
  { href: "/products", label: "Products", icon: <Package className="size-4" /> },
  { href: "/categories", label: "Categories", icon: <FolderTree className="size-4" /> },
  { href: "/brands", label: "Brands", icon: <Tag className="size-4" /> },
  { href: "/suppliers", label: "Suppliers", icon: <Truck className="size-4" /> },
];

export function TopNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="border-border bg-card/40 -mx-4 overflow-x-auto border-b px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-primary text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="ml-auto flex items-center gap-2">
          <Link
            href="/products/import"
            className="text-muted-foreground hover:text-foreground hidden items-center gap-2 px-3 py-2 text-xs sm:flex"
          >
            <Boxes className="size-3.5" />
            Bulk import
          </Link>
        </li>
      </ul>
    </nav>
  );
}
