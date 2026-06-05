"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTeamInviteAction, revokeTeamInviteAction } from "@/lib/team/actions";
import { STAFF_INVITE_ROLES } from "@/lib/team/schemas";
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
}

export function TeamSettingsPanel({ members, invites, branches, canManage }: Props) {
  const [pending, startTransition] = useTransition();
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [role, setRole] = useState<string>("cashier");
  const [branchId, setBranchId] = useState<string>("");

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

  function revoke(inviteId: string) {
    startTransition(async () => {
      const res = await revokeTeamInviteAction({ inviteId });
      if (res?.serverError) toast.error(res.serverError);
      else toast.success("Invite revoked");
    });
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5" />
              Invite team member
            </CardTitle>
            <CardDescription>
              Share the invite link with your colleague. They create an account (or sign in) and
              join your shop.
            </CardDescription>
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
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{m.full_name ?? m.email ?? m.user_id}</p>
                  <p className="text-muted-foreground text-xs">{m.email}</p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {m.role}
                </Badge>
              </li>
            ))}
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
