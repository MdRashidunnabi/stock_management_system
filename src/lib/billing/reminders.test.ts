import { describe, expect, it } from "vitest";
import { dueOnKey, paymentDueAt, shouldSendExpiryReminder } from "./reminders";

describe("paymentDueAt", () => {
  it("uses trial end while the shop is on trial", () => {
    const due = paymentDueAt({
      status: "trial",
      trialEndsAt: "2026-10-24T12:00:00.000Z",
      nextBillingAt: "2026-11-01T12:00:00.000Z",
    });
    expect(due?.toISOString()).toBe("2026-10-24T12:00:00.000Z");
  });

  it("uses next billing date once the shop is paying", () => {
    const due = paymentDueAt({
      status: "active",
      trialEndsAt: "2026-10-01T12:00:00.000Z",
      nextBillingAt: "2026-11-01T12:00:00.000Z",
    });
    expect(due?.toISOString()).toBe("2026-11-01T12:00:00.000Z");
  });
});

describe("shouldSendExpiryReminder", () => {
  const due = new Date("2026-10-24T12:00:00.000Z");

  it("does not send more than two days before", () => {
    expect(shouldSendExpiryReminder(due, new Date("2026-10-21T11:59:00.000Z"))).toBe(false);
  });

  it("sends from two days before expiry", () => {
    expect(shouldSendExpiryReminder(due, new Date("2026-10-22T12:00:00.000Z"))).toBe(true);
    expect(shouldSendExpiryReminder(due, new Date("2026-10-23T18:00:00.000Z"))).toBe(true);
  });

  it("does not send after expiry", () => {
    expect(shouldSendExpiryReminder(due, new Date("2026-10-24T12:00:01.000Z"))).toBe(false);
  });

  it("keys one reminder per due date", () => {
    expect(dueOnKey(due)).toBe("2026-10-24");
  });
});
