"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { setActiveTenantAction } from "@/lib/auth/actions";
import type { TenantContext, TenantMembership } from "@/lib/auth/tenant";

interface Props {
  current: TenantContext;
  memberships: TenantMembership[];
}

export function TenantSwitcher({ current, memberships }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(tenantId: string) {
    if (tenantId === current.tenantId) return;
    startTransition(async () => {
      const res = await setActiveTenantAction({ tenantId });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      const data = res?.data;
      if (data && data.ok === false) {
        toast.error(data.message);
        return;
      }
      toast.success("Switched shop");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending} className="h-8 gap-2 px-2 font-medium">
          <span className="max-w-[180px] truncate">{current.tenantName}</span>
          <ChevronsUpDown className="text-muted-foreground size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your shops</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.tenantId}
            onSelect={() => pick(m.tenantId)}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex flex-col">
              <span className="text-sm">{m.tenantName}</span>
              <span className="text-muted-foreground text-xs capitalize">{m.role}</span>
            </div>
            {m.tenantId === current.tenantId ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
