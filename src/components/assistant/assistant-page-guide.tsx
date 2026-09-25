"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function flashGuide(guide: string, hash: string) {
  const byAttr = document.querySelector(`[data-guide="${CSS.escape(guide)}"]`);
  const byHash = hash ? document.getElementById(hash) : null;
  const heading = document.querySelector("main h1");
  const el = (byAttr ?? byHash ?? heading) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("assistant-guide-flash");
  window.setTimeout(() => el.classList.remove("assistant-guide-flash"), 2400);
}

function GuideInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const guide = searchParams.get("guide");

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!guide && !hash) return;
    const timer = window.setTimeout(() => flashGuide(guide ?? hash, hash), 250);
    return () => window.clearTimeout(timer);
  }, [pathname, searchParams, guide]);

  return null;
}

export function AssistantPageGuide() {
  return <GuideInner />;
}
