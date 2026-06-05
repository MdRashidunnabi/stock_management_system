"use client";

import { useRef, useState, useTransition } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadProductImage } from "@/lib/catalog/products/upload-image";

interface Props {
  productId?: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export function ProductImageField({ productId, value, onChange, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadPending, startUpload] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("productId", productId ?? "new");
    startUpload(async () => {
      const res = await uploadProductImage(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onChange(res.url);
      toast.success("Image uploaded");
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  const preview = value.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="size-4" />
          Product image
        </CardTitle>
        <CardDescription className="text-xs">
          Shown in Products and POS. Paste a link or upload a photo (JPEG, PNG, WebP, GIF, max 5
          MB).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="border-border bg-muted/30 flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-full object-cover" />
            ) : (
              <ImageIcon className="text-muted-foreground size-8" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="space-y-2">
              <Label htmlFor="primaryImageUrl">Image URL</Label>
              <Input
                id="primaryImageUrl"
                placeholder="https://... or /shops/your-shop/photo.jpg"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled || uploadPending}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFile}
                disabled={disabled || uploadPending}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || uploadPending}
                onClick={() => fileRef.current?.click()}
              >
                {uploadPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Upload image
              </Button>
              {preview ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || uploadPending}
                  onClick={() => onChange("")}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
