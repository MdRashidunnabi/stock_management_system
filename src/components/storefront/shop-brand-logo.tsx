"use client";

import { useState } from "react";

export function ShopBrandLogo({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <span className="text-foreground truncate text-lg font-bold">{name}</span>;
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        className="h-12 max-h-14 w-auto max-w-[min(100%,220px)] object-contain object-left sm:h-14 sm:max-w-[280px]"
        fetchPriority="high"
        onError={() => setFailed(true)}
      />
    </>
  );
}
