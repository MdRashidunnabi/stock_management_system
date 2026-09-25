"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/layout/app-sidebar";
import type { AppRole } from "@/lib/auth/tenant";
import { useT } from "@/components/i18n/locale-provider";

interface Props {
  role: AppRole;
  showPlatform?: boolean;
}

/** Mobile menu — same links as the desktop left sidebar */
export function MobileNav({ role, showPlatform }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const { t } = useT();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/30 bg-white/10 text-white hover:bg-white/20 md:hidden"
          aria-label={t("common.menu")}
        >
          <Menu className="size-4" />
          {t("common.menu")}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle>{t("common.menu")}</SheetTitle>
        </SheetHeader>
        <div
          onClick={(e) => {
            const anchor = (e.target as HTMLElement).closest("a");
            if (anchor?.getAttribute("href") && anchor.getAttribute("href") !== pathname) {
              setOpen(false);
            }
          }}
        >
          <AppSidebar role={role} showPlatform={showPlatform} mobile />
        </div>
      </SheetContent>
    </Sheet>
  );
}
