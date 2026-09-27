import { describe, expect, it } from "vitest";
import {
  asEmailOtpType,
  authEmailRedirectTo,
  defaultNextForAuthType,
  isAllowedAuthOrigin,
  looksLikeAuthCode,
  looksLikeAuthTokenHash,
  liveAuthCallbackUrlFromPastedLink,
  originFromForwardedHeaders,
} from "./email-redirect";

describe("originFromForwardedHeaders", () => {
  it("prefers the Origin header", () => {
    expect(
      originFromForwardedHeaders({
        origin: "https://shopos-red.vercel.app",
        host: "localhost:3000",
      }),
    ).toBe("https://shopos-red.vercel.app");
  });

  it("builds https from x-forwarded-host on Vercel", () => {
    expect(
      originFromForwardedHeaders({
        forwardedHost: "shopos-red.vercel.app",
        forwardedProto: "https",
        host: "shopos-red.vercel.app",
      }),
    ).toBe("https://shopos-red.vercel.app");
  });

  it("uses http for localhost", () => {
    expect(originFromForwardedHeaders({ host: "localhost:3000" })).toBe("http://localhost:3000");
  });
});

describe("isAllowedAuthOrigin", () => {
  it("allows the live Vercel host even when env still says localhost", () => {
    expect(isAllowedAuthOrigin("https://shopos-red.vercel.app", "http://localhost:3000")).toBe(
      true,
    );
  });

  it("rejects an unknown host", () => {
    expect(isAllowedAuthOrigin("https://evil.example", "http://localhost:3000")).toBe(false);
  });
});

describe("authEmailRedirectTo", () => {
  it("sends confirm links to the site the user is on", () => {
    expect(
      authEmailRedirectTo(
        "https://shopos-red.vercel.app",
        "http://localhost:3000",
        "/dashboard",
      ),
    ).toBe("https://shopos-red.vercel.app/auth/callback?next=/dashboard");
  });

  it("falls back to the configured app URL when the host is not trusted", () => {
    expect(authEmailRedirectTo("https://evil.example", "http://localhost:3000", "/dashboard")).toBe(
      "http://localhost:3000/auth/callback?next=/dashboard",
    );
  });

  it("never emails localhost when the configured app URL is live", () => {
    expect(
      authEmailRedirectTo(
        "http://localhost:3000",
        "https://shopos-red.vercel.app",
        "/reset-password",
      ),
    ).toBe("https://shopos-red.vercel.app/auth/callback?next=/reset-password");
  });
});

describe("looksLikeAuthCode", () => {
  it("accepts a supabase pkce code", () => {
    expect(looksLikeAuthCode("eaafd7bb-b892-468b-aaa9-ec46c43cc934")).toBe(true);
  });

  it("rejects empty or tiny values", () => {
    expect(looksLikeAuthCode("abc")).toBe(false);
    expect(looksLikeAuthCode("")).toBe(false);
  });
});

describe("auth email otp helpers", () => {
  it("defaults recovery links to the password form", () => {
    expect(asEmailOtpType("recovery")).toBe("recovery");
    expect(asEmailOtpType("nope")).toBe(null);
    expect(defaultNextForAuthType("recovery", "/dashboard")).toBe("/reset-password");
    expect(looksLikeAuthTokenHash("pkce-token-hash-value-123456")).toBe(true);
  });

  it("rewrites a localhost reset URL onto the live app", () => {
    expect(
      liveAuthCallbackUrlFromPastedLink(
        "http://localhost:3000/?code=8943c891-2d05-4e8e-99b0-5264cbcaddc3",
        "https://shopos-red.vercel.app",
        "/reset-password",
      ),
    ).toBe(
      "https://shopos-red.vercel.app/auth/callback?code=8943c891-2d05-4e8e-99b0-5264cbcaddc3&next=%2Freset-password&type=recovery",
    );
  });
});
