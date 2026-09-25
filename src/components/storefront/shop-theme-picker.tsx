"use client";

import { Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { SHOP_TEMPLATES, type ShopTemplateId } from "@/lib/storefront/templates";

export function ShopThemePicker({
  value,
  onChange,
  shopPath,
}: {
  value: ShopTemplateId;
  onChange: (id: ShopTemplateId) => void;
  shopPath?: string;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Website design</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {SHOP_TEMPLATES.map((tpl) => {
          const selected = tpl.id === value;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onChange(tpl.id)}
              className={cn(
                "focus-visible:ring-ring overflow-hidden rounded-xl border text-left transition-shadow focus-visible:ring-2 focus-visible:outline-none",
                selected
                  ? "border-primary ring-primary/30 shadow-md ring-2"
                  : "border-border hover:border-primary/40 hover:shadow-sm",
              )}
            >
              <div className="p-2" style={{ background: tpl.preview.bg }}>
                {tpl.header !== "plain" ? (
                  <div
                    className="mb-1.5 h-1.5 rounded-sm"
                    style={{ background: tpl.preview.accent }}
                  />
                ) : (
                  <div className="mb-1.5 h-1.5" />
                )}
                <div className={cn("flex gap-1", tpl.nav === "top" && "flex-col")}>
                  {tpl.nav === "side" ? (
                    <div
                      className="w-4 shrink-0 rounded-sm"
                      style={{ background: tpl.preview.accent, opacity: 0.35 }}
                    />
                  ) : (
                    <div className="flex gap-0.5">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-1.5 flex-1 rounded-sm"
                          style={{ background: tpl.preview.accent, opacity: 0.45 + i * 0.1 }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <div
                      className="h-4 rounded-sm"
                      style={{ background: tpl.preview.accent, opacity: 0.85 }}
                    />
                    <div className="grid grid-cols-3 gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-6 rounded-sm border"
                          style={{
                            background: tpl.preview.card,
                            borderColor: tpl.preview.accent + "33",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-card space-y-1 px-3 py-2.5">
                <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                  {tpl.name}
                  {selected ? <Check className="text-primary size-4" /> : null}
                </p>
                {shopPath ? (
                  <a
                    href={`${shopPath}?design=${tpl.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary inline-flex items-center gap-1 pt-0.5 text-[11px] font-medium hover:underline"
                  >
                    Preview
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
