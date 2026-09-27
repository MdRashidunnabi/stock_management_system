"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  platformRemoveShopMemberAction,
  platformRestoreShopMemberAction,
  platformSendShopMemberEmailAction,
  platformSetShopMemberPasswordAction,
  platformUpdateShopMemberRoleAction,
} from "@/lib/billing/actions";
import { SHOP_MEMBER_ROLES } from "@/lib/billing/schemas";
import { getSafeActionData, getSafeActionError } from "@/lib/parse-safe-action-result";

const ROLE_LABEL: Record<(typeof SHOP_MEMBER_ROLES)[number], string> = {
  owner: "Owner",
  manager: "Manager",
  accountant: "Accountant",
  cashier: "Cashier",
};

export type ShopMemberRow = {
  user_id: string;
  email: string | null;
  role: string;
  is_active: boolean;
};

export function PlatformTeamMemberRow({
  tenantId,
  member,
  lastOwner,
  onUpdated,
}: {
  tenantId: string;
  member: ShopMemberRow;
  lastOwner: boolean;
  onUpdated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [role, setRole] = useState(member.role);
  const [password, setPassword] = useState("");

  const ids = { tenantId, userId: member.user_id };

  function run(work: () => Promise<unknown>) {
    setNotice(null);
    startTransition(async () => {
      const res = await work();
      const err = getSafeActionError(res);
      if (err) {
        setNotice({ ok: false, text: err });
        return;
      }
      const data = getSafeActionData<{ ok: true; message?: string }>(res);
      setNotice({ ok: true, text: data?.message ?? "Saved." });
      setPassword("");
      onUpdated?.();
    });
  }

  return (
    <li className="relative z-10 border-b py-2 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm">{member.email ?? member.user_id}</p>
          <p className="text-muted-foreground text-xs capitalize">
            {member.role.replaceAll("_", " ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {member.is_active ? (
            <Badge variant="secondary">Active</Badge>
          ) : (
            <Badge variant="destructive">Removed</Badge>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>
      </div>
      {open ? (
        <div className="mt-2 space-y-2 rounded-md border p-2">
          {notice ? (
            <Alert variant={notice.ok ? "default" : "destructive"}>
              <AlertDescription>{notice.text}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Role</span>
              <select
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={pending || (lastOwner && member.role === "owner")}
              >
                {SHOP_MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              size="sm"
              disabled={pending || role === member.role}
              onClick={() =>
                run(() =>
                  platformUpdateShopMemberRoleAction({
                    ...ids,
                    role: role as (typeof SHOP_MEMBER_ROLES)[number],
                  }),
                )
              }
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save role
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => platformSendShopMemberEmailAction(ids))}
            >
              Send login email
            </Button>
            {member.is_active ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending || lastOwner}
                onClick={() => run(() => platformRemoveShopMemberAction(ids))}
              >
                Remove
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => platformRestoreShopMemberAction(ids))}
              >
                Restore
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="text"
              autoComplete="new-password"
              placeholder="New password"
              className="h-9 max-w-56"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || password.length < 8}
              onClick={() => run(() => platformSetShopMemberPasswordAction({ ...ids, password }))}
            >
              Set password
            </Button>
          </div>
          {lastOwner ? (
            <p className="text-muted-foreground text-[11px]">
              Keep at least one owner on this shop.
            </p>
          ) : (
            <p className="text-muted-foreground text-[11px]">
              Passwords are not emailed. Share a new password yourself.
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}
