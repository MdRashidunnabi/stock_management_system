"use client";

import { useTransition } from "react";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addBranchAction } from "@/lib/branches/actions";

type Branch = { id: string; code: string; name: string; city: string | null };

interface Props {
  branches: Branch[];
  licensedBranchCount: number;
}

export function BranchesPanel({ branches, licensedBranchCount }: Props) {
  const [pending, startTransition] = useTransition();
  const canAdd = branches.length < licensedBranchCount;

  function addBranch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await addBranchAction({
        code: String(fd.get("code") ?? ""),
        name: String(fd.get("name") ?? ""),
        addressLine1: String(fd.get("address") ?? ""),
        city: String(fd.get("city") ?? ""),
        county: String(fd.get("county") ?? ""),
        eircode: String(fd.get("eircode") ?? ""),
      });
      if (res?.serverError) toast.error(res.serverError);
      else {
        toast.success("Branch added");
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your branches</CardTitle>
          <CardDescription>
            Each branch can have its own stock on the website. Customers pick a branch when they
            shop online. ({branches.length} of {licensedBranchCount} used)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {branches.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-3 text-sm">
                <MapPin className="text-muted-foreground size-4" />
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-muted-foreground text-xs">
                    Code {b.code}
                    {b.city ? ` · ${b.city}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {canAdd ? (
        <Card>
          <CardHeader>
            <CardTitle>Add another branch</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addBranch} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">Branch code</Label>
                <Input id="code" name="code" required placeholder="DUB2" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Branch name</Label>
                <Input id="name" name="name" required placeholder="City centre" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Address (optional)</Label>
                <Input id="address" name="address" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eircode">Eircode</Label>
                <Input id="eircode" name="eircode" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Add branch
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
