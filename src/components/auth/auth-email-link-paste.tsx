"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { liveAuthCallbackUrlFromPastedLink } from "@/lib/auth/email-redirect";
import { useT } from "@/components/i18n/locale-provider";

export function AuthEmailLinkPaste({ next }: { next: "/reset-password" | "/dashboard" }) {
  const { t } = useT();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const dest = liveAuthCallbackUrlFromPastedLink(value, window.location.origin, next);
    if (!dest) {
      setInvalid(true);
      return;
    }
    window.location.assign(dest);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2" noValidate>
      <Label htmlFor="pastedAuthLink">{t("auth.pasteLinkLabel")}</Label>
      <Input
        id="pastedAuthLink"
        value={value}
        autoComplete="off"
        placeholder="Paste the link from your email"
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setValue(e.target.value);
          setInvalid(false);
        }}
      />
      {invalid ? <p className="text-destructive text-xs">{t("auth.pasteLinkInvalid")}</p> : null}
      <Button type="submit" variant="outline" className="w-full">
        {t("auth.pasteLinkOpen")}
      </Button>
    </form>
  );
}
