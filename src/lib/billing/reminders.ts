/** Payment / trial expiry reminders: notify from 2 days before the due date. */

export const REMINDER_LEAD_MS = 2 * 24 * 60 * 60 * 1000;

export function paymentDueAt(input: {
  status: string;
  trialEndsAt: string | null;
  nextBillingAt: string | null;
}): Date | null {
  const iso =
    input.status === "trial" ? input.trialEndsAt : (input.nextBillingAt ?? input.trialEndsAt);
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  return due;
}

export function dueOnKey(due: Date): string {
  return due.toISOString().slice(0, 10);
}

/** True from two days before expiry until the due instant (not after it lapses). */
export function shouldSendExpiryReminder(due: Date, now = new Date()): boolean {
  const t = due.getTime();
  const n = now.getTime();
  if (t <= n) return false;
  return n >= t - REMINDER_LEAD_MS;
}
