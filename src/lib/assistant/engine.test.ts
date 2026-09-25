import { describe, expect, it } from "vitest";
import { processAssistantTurn, welcomeReply } from "@/lib/assistant/engine";
import type { AssistantSession, AssistantTurnInput } from "@/lib/assistant/types";

const guest: AssistantSession = {
  signedIn: false,
  email: null,
  displayName: null,
  role: null,
  tenantName: null,
  tenantSlug: null,
  isPlatformStaff: false,
};

const owner: AssistantSession = {
  signedIn: true,
  email: "owner@demo.shopos.local",
  displayName: "Demo Owner",
  role: "owner",
  tenantName: "Greenway Mini Market",
  tenantSlug: "greenway",
  isPlatformStaff: false,
};

const cashier: AssistantSession = {
  signedIn: true,
  email: "cashier@demo.shopos.local",
  displayName: "Demo Cashier",
  role: "cashier",
  tenantName: "Greenway Mini Market",
  tenantSlug: "greenway",
  isPlatformStaff: false,
};

function turn(
  text: string,
  session: AssistantSession = guest,
  extra: Partial<AssistantTurnInput> = {},
) {
  return processAssistantTurn({
    text,
    session,
    phase: "idle",
    demoStep: 0,
    pendingLogin: null,
    ...extra,
  });
}

describe("ShopOS assistant", () => {
  it("asks for a role when a guest wants their account", () => {
    const result = turn("I want to access my account");
    expect(result.phase).toBe("awaiting_role");
    expect(result.replies[0]?.text).toMatch(/owner/i);
    expect(result.replies[0]?.chips?.map((c) => c.id)).toEqual([
      "owner",
      "manager",
      "staff",
      "admin",
      "super_admin",
    ]);
  });

  it("opens owner login when a guest says I am Owner", () => {
    const result = turn("I am Owner");
    expect(result.phase).toBe("login");
    expect(result.pendingLogin?.roleLabel).toBe("Shop Owner");
    expect(result.pendingLogin?.next).toBe("/dashboard");
    expect(result.replies[0]?.showLogin).toBe(true);
  });

  it("asks which kind of staff, then opens cashier login to POS", () => {
    const staff = turn("::role:staff");
    expect(staff.phase).toBe("awaiting_staff_kind");
    const cashierLogin = turn("cashier", guest, { phase: "awaiting_staff_kind" });
    expect(cashierLogin.phase).toBe("login");
    expect(cashierLogin.pendingLogin?.next).toBe("/pos");
    expect(cashierLogin.pendingLogin?.roleLabel).toBe("Cashier");
  });

  it("starts a guest demo walkthrough", () => {
    const result = turn("guest demo");
    expect(result.phase).toBe("demo");
    expect(result.replies[0]?.text).toMatch(/Guest demo/i);
    expect(result.replies[0]?.actions?.some((a) => a.href === "/demo")).toBe(true);
  });

  it("splits customer payments and ShopOS billing", () => {
    const result = turn("I have a question about payment");
    expect(result.replies[0]?.text).toMatch(/two payments/i);
    const labels = result.replies[0]?.actions?.map((a) => a.label) ?? [];
    expect(labels.some((l) => /POS/i.test(l))).toBe(true);
    expect(labels.some((l) => /billing/i.test(l))).toBe(true);
  });

  it("opens POS for a signed-in owner asking to take a payment", () => {
    const result = turn("How do I take a payment?", owner);
    expect(result.replies[0]?.actions?.[0]?.href).toContain("/pos");
    expect(result.replies[0]?.lookupTopic).toBe("tills");
  });

  it("does not send a cashier to billing", () => {
    const result = turn("Show billing", cashier);
    expect(result.replies[0]?.text).toMatch(/shop owner/i);
    expect(result.replies[0]?.actions?.[0]?.href).toContain("/demo#billing");
  });

  it("opens billing for an owner subscription question", () => {
    const result = turn("Where is my ShopOS subscription?", owner);
    expect(result.replies[0]?.actions?.[0]?.href).toContain("/settings/billing");
  });

  it("opens products when asked about stock", () => {
    const result = turn("Where do I see stock?", owner);
    expect(result.replies[0]?.actions?.[0]?.href).toContain("/products");
  });

  it("tells a signed-in owner they are already in their account", () => {
    const result = turn("I want to access my account", owner);
    expect(result.replies[0]?.text).toMatch(/already signed in/i);
    expect(result.phase).toBe("idle");
  });

  it("understands Bangla account intent", () => {
    const result = turn("আমার অ্যাকাউন্ট চাই");
    expect(result.phase).toBe("awaiting_role");
  });

  it("welcome for guests offers demo and account chips", () => {
    const welcome = welcomeReply(guest);
    expect(welcome.chips?.some((c) => c.id === "demo")).toBe(true);
    expect(welcome.chips?.some((c) => c.id === "account")).toBe(true);
  });
});
