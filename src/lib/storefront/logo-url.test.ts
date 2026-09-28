import { afterEach, describe, expect, it, vi } from "vitest";
import { publicStorefrontLogoUrl, resolveStorefrontLogoUrl } from "./logo-url";

describe("resolveStorefrontLogoUrl", () => {
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = original;
  });

  it("rewrites a stored local storage URL to the current supabase origin", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    expect(
      resolveStorefrontLogoUrl(
        "http://127.0.0.1:54321/storage/v1/object/public/storefront-logos/abc/logo.png",
      ),
    ).toBe("http://127.0.0.1:54321/storage/v1/object/public/storefront-logos/abc/logo.png");
  });

  it("rewrites a stale supabase host onto the current origin", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    expect(
      resolveStorefrontLogoUrl(
        "https://old.supabase.co/storage/v1/object/public/storefront-logos/abc/logo.png",
      ),
    ).toBe("http://127.0.0.1:54321/storage/v1/object/public/storefront-logos/abc/logo.png");
  });

  it("keeps same-origin site paths", () => {
    expect(resolveStorefrontLogoUrl("/shops/needscarlow/logo.png")).toBe(
      "/shops/needscarlow/logo.png",
    );
  });

  it("builds a public URL from a storage object path", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(publicStorefrontLogoUrl("tenant/logo.png")).toBe(
      "https://example.supabase.co/storage/v1/object/public/storefront-logos/tenant/logo.png",
    );
  });
});
