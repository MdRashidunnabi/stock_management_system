"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { platformGrantStaffAction } from "@/lib/billing/actions";

export function PlatformStaffForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const email = new FormData(e.currentTarget).get("email");
        startTransition(async () => {
          const res = await platformGrantStaffAction({ email: String(email ?? "") });
          if (res?.serverError) {
            setError(res.serverError);
            toast.error(res.serverError);
            return;
          }
          toast.success("Platform access granted");
          (e.target as HTMLFormElement).reset();
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">User email</Label>
        <Input id="email" name="email" type="email" required placeholder="you@company.com" />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Grant platform access
      </Button>
    </form>
  );
}
