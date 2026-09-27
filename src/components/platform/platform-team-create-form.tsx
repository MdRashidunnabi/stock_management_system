"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { platformCreateShopMemberAction } from "@/lib/billing/actions";
import { getSafeActionData, getSafeActionError } from "@/lib/parse-safe-action-result";

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "accountant", label: "Accountant" },
  { value: "cashier", label: "Cashier" },
] as const;

function generateStaffPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let body = "";
  for (const b of bytes) body += alphabet[b % alphabet.length];
  return `Shop${body}1`;
}

export function PlatformTeamCreateForm({
  tenantId,
  onCreated,
}: {
  tenantId: string;
  onCreated?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [password, setPassword] = useState("");

  return (
    <form
      className="space-y-3 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setNotice(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        startTransition(async () => {
          const res = await platformCreateShopMemberAction({
            tenantId,
            fullName: String(fd.get("fullName") ?? ""),
            email: String(fd.get("email") ?? ""),
            role: String(fd.get("role") ?? "cashier") as (typeof ROLES)[number]["value"],
            password: String(fd.get("password") ?? ""),
            resetPasswordIfExists: fd.get("resetPasswordIfExists") === "on",
          });
          const err = getSafeActionError(res);
          if (err) {
            setNotice({ ok: false, text: err });
            toast.error(err);
            return;
          }
          const data = getSafeActionData<{ ok: true; message: string }>(res);
          const text = data?.message ?? "Account saved.";
          setNotice({ ok: true, text });
          toast.success(text);
          form.reset();
          setPassword("");
          onCreated?.();
        });
      }}
    >
      <p className="text-sm font-medium">Create login</p>
      <p className="text-muted-foreground text-xs">
        Creates a confirmed sign-in for this shop and emails a sign-in link. We never put the
        password in that email — share it with them yourself if you set one.
      </p>
      {notice ? (
        <Alert variant={notice.ok ? "default" : "destructive"}>
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" required maxLength={120} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="memberEmail">Email</Label>
          <Input id="memberEmail" name="email" type="email" required autoComplete="off" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="memberRole">Role</Label>
          <select
            id="memberRole"
            name="role"
            defaultValue="cashier"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="memberPassword">Password</Label>
          <div className="flex gap-2">
            <Input
              id="memberPassword"
              name="password"
              type="text"
              required
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setPassword(generateStaffPassword())}
            >
              Generate
            </Button>
          </div>
          <p className="text-muted-foreground text-[11px]">At least 8 characters, a letter and a number.</p>
        </div>
      </div>
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" name="resetPasswordIfExists" className="mt-0.5" />
        <span>If this email already has a login, replace their password with this one.</span>
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Create account
      </Button>
    </form>
  );
}
