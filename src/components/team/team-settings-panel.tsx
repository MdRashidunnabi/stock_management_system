"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createStaffLoginAction,
  createTeamInviteAction,
  removeStaffAction,
  revokeTeamInviteAction,
  setStaffPasswordAction,
} from "@/lib/team/actions";
import { STAFF_INVITE_ROLES, STAFF_LOGIN_ROLES } from "@/lib/team/schemas";
import type { TeamMemberRow } from "@/lib/team/queries";

interface Props {
  members: TeamMemberRow[];
  invites: Array<{
    id: string;
    email: string;
    role: string;
    token: string;
    invited_at: string;
    expires_at: string;
  }>;
  branches: Array<{ id: string; name: string; code: string }>;
  canManage: boolean;
  canControl: boolean;
}

export function TeamSettingsPanel({ members, invites, branches, canManage, canControl }: Props) {
  const [pending, startTransition] = useTransition();
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [role, setRole] = useState<string>("cashier");
  const [loginRole, setLoginRole] = useState<string>("cashier");
  const [branchId, setBranchId] = useState<string>("");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createTeamInviteAction({
        email: String(fd.get("email") ?? ""),
        role: role as (typeof STAFF_INVITE_ROLES)[number],
        branchId: "",
      });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      if (res?.data?.inviteUrl) {
        setLastInviteUrl(res.data.inviteUrl);
        toast.success("Invite created — copy the link below");
      }
      (e.target as HTMLFormElement).reset();
    });
  }

  function createLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canControl) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await createStaffLoginAction({
        email: String(fd.get("loginEmail") ?? ""),
        password: String(fd.get("loginPassword") ?? ""),
        role: loginRole as (typeof STAFF_LOGIN_ROLES)[number],
      });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success("Login saved. The password stays visible in the list below.");
      form.reset();
    });
  }

  function savePassword(userId: string, password: string) {
    startTransition(async () => {
      const res = await setStaffPasswordAction({ userId, password });
      if (res?.serverError) toast.error(res.serverError);
      else toast.success("Password updated");
    });
  }

  function removeMember(userId: string) {
    startTransition(async () => {
      const res = await removeStaffAction({ userId });
      if (res?.serverError) toast.error(res.serverError);
      else {
        setConfirmRemoveId(null);
        toast.success("Login removed");
      }
    });
  }

  function revoke(inviteId: string) {
    startTransition(async () => {
      const res = await revokeTeamInviteAction({ inviteId });
      if (res?.serverError) toast.error(res.serverError);
      else toast.success("Invite revoked");
    });
  }

  return (
    <div className="space-y-6">
      {canControl ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5" />
              Add a login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createLogin} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="loginEmail">Email</Label>
                <Input
                  id="loginEmail"
                  name="loginEmail"
                  type="email"
                  required
                  placeholder="cashier@shop.com"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="loginPassword">Password</Label>
                <Input
                  id="loginPassword"
                  name="loginPassword"
                  type="text"
                  required
                  minLength={8}
                  autoComplete="off"
                  placeholder="At least 8 characters, with a letter and a number"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={loginRole} onValueChange={setLoginRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_LOGIN_ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={pending} className="w-full">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save login
                </Button>
              </div>
            </form>
            <p className="text-muted-foreground mt-3 text-sm">
              You set the password and can read it in the list. Staff cannot change it themselves.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {canManage && !canControl ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5" />
              Invite team member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={invite} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="staff@example.com"
                />
              </div>
              {branches.length > 1 ? (
                <div className="space-y-2">
                  <Label>Branch (optional)</Label>
                  <Select
                    value={branchId || "all"}
                    onValueChange={(v) => setBranchId(v === "all" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All branches</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_INVITE_ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={pending} className="w-full">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Create invite
                </Button>
              </div>
            </form>
            {lastInviteUrl ? (
              <div className="bg-muted/50 mt-4 flex flex-wrap items-center gap-2 rounded-lg border p-3">
                <code className="text-xs break-all">{lastInviteUrl}</code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(lastInviteUrl);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="size-3" />
                  Copy
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Active members</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {members.map((m) => {
              const controllable = canControl && m.role !== "owner" && m.role !== "super_admin";
              return (
                <li key={m.user_id} className="space-y-3 py-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{m.full_name ?? m.email ?? m.user_id}</p>
                      <p className="text-muted-foreground text-xs">{m.email ?? m.user_id}</p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {m.role}
                    </Badge>
                  </div>
                  {controllable ? (
                    <div className="space-y-3 rounded-lg border p-3">
                      <div>
                        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          Password
                        </p>
                        <p className="font-mono text-base">
                          {m.staff_password ??
                            "Not saved yet. Set one below and it will stay visible."}
                        </p>
                      </div>
                      <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const password = String(
                            new FormData(e.currentTarget).get("password") ?? "",
                          );
                          savePassword(m.user_id, password);
                          e.currentTarget.reset();
                        }}
                      >
                        <div className="min-w-48 flex-1 space-y-1">
                          <Label htmlFor={`password-${m.user_id}`}>New password</Label>
                          <Input
                            id={`password-${m.user_id}`}
                            name="password"
                            type="text"
                            required
                            minLength={8}
                            autoComplete="off"
                          />
                        </div>
                        <Button type="submit" variant="outline" disabled={pending}>
                          Save password
                        </Button>
                      </form>
                      {confirmRemoveId === m.user_id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={pending}
                            onClick={() => removeMember(m.user_id)}
                          >
                            Confirm remove
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => setConfirmRemoveId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => setConfirmRemoveId(m.user_id)}
                        >
                          Remove login
                        </Button>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {invites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{inv.email}</p>
                    <p className="text-muted-foreground text-xs capitalize">{inv.role}</p>
                  </div>
                  {canManage ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => revoke(inv.id)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
