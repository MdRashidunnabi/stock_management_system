"use client";

import { useRef, useState, useTransition } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadStorefrontLogo } from "@/lib/storefront/upload-logo";

interface Props {
  value: string;
  onChange: (url: string) => void;
}

export function StorefrontLogoField({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadPending, startUpload] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startUpload(async () => {
      const res = await uploadStorefrontLogo(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onChange(res.url);
      toast.success("Logo uploaded — visible on your shop now");
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  const preview = value.trim();

  return (
    <div className="border-primary/20 bg-primary/5 space-y-3 rounded-xl border p-4">
      <div>
        <Label className="text-base">Shop logo</Label>
        <p className="text-muted-foreground mt-1 text-xs">
          Shown at the top left of your public website. Upload PNG with transparent background for
          best results (max 5 MB).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="bg-card flex h-16 min-w-[120px] items-center justify-center rounded-lg border px-3 py-2 shadow-sm">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Shop logo preview"
              className="max-h-14 max-w-[200px] object-contain object-left"
            />
          ) : (
            <ImageIcon className="text-muted-foreground size-8" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="space-y-2">
            <Label htmlFor="logoUrl" className="text-xs">
              Logo URL (optional — paste if hosted elsewhere)
            </Label>
            <Input
              id="logoUrl"
              name="logoUrl"
              placeholder="/shops/your-shop/logo.png or https://..."
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={uploadPending}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
              className="hidden"
              onChange={handleFile}
              disabled={uploadPending}
            />
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={uploadPending}
              onClick={() => fileRef.current?.click()}
            >
              {uploadPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Upload logo
            </Button>
            {preview ? (
              <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
