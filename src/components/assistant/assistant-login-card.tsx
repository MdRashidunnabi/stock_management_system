"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signInAction } from "@/lib/auth/actions";
import type { PendingLogin } from "@/lib/assistant/types";
import { useT } from "@/components/i18n/locale-provider";
import { displayMessage } from "@/lib/i18n/display";

export function AssistantLoginCard({ pending }: { pending: PendingLogin }) {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingSubmit, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signInAction({
        email,
        password,
        next: pending.next,
      });
      if (res?.serverError) {
        setError(displayMessage(t, res.serverError));
        return;
      }
      if (res?.validationErrors) {
        setError(t("auth.formCheck"));
        return;
      }
      if (res?.data && res.data.ok === false) {
        setError(displayMessage(t, res.data.message));
        return;
      }
      toast.success(t("auth.signInAs", { role: pending.roleLabel }));
    });
  }

  return (
    <form onSubmit={onSubmit} className="bg-background/80 mt-2 space-y-3 rounded-xl border p-3">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {pending.roleLabel}
      </p>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="agent-email">{t("auth.email")}</Label>
        <Input
          id="agent-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pendingSubmit}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="agent-password">{t("auth.password")}</Label>
        <Input
          id="agent-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pendingSubmit}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pendingSubmit}>
        {pendingSubmit ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          t("auth.signInAs", { role: pending.roleLabel })
        )}
      </Button>
    </form>
  );
}
