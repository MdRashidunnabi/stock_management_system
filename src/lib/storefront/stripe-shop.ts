import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type ShopStripeKeys = {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
};

const PK = /\[stripe_pk=([^\]]+)\]/;
const SK = /\[stripe_sk=([^\]]+)\]/;
const WH = /\[stripe_wh=([^\]]+)\]/;

export function stripeWebhookUrl(origin: string, shopSlug: string): string {
  return `${origin.replace(/\/$/, "")}/api/stripe/webhook?shop=${encodeURIComponent(shopSlug)}`;
}

function readPartialStripe(notes: string | null | undefined): ShopStripeKeys {
  const text = String(notes || "");
  return {
    publishableKey: text.match(PK)?.[1] ?? "",
    secretKey: unseal(text.match(SK)?.[1] ?? ""),
    webhookSecret: unseal(text.match(WH)?.[1] ?? ""),
  };
}

export function readShopStripe(notes: string | null | undefined): ShopStripeKeys | null {
  const keys = readPartialStripe(notes);
  if (!keys.publishableKey || !keys.secretKey || !keys.webhookSecret) return null;
  return keys;
}

export function stripeConnected(notes: string | null | undefined): boolean {
  return readShopStripe(notes) != null;
}

export function withShopStripe(
  notes: string | null | undefined,
  keys: Partial<ShopStripeKeys>,
): string {
  let text = String(notes || "")
    .replace(/\[stripe_pk=[^\]]+\]\n?/g, "")
    .replace(/\[stripe_sk=[^\]]+\]\n?/g, "")
    .replace(/\[stripe_wh=[^\]]+\]\n?/g, "")
    .trim();
  const current = readPartialStripe(notes);
  const publishableKey = keys.publishableKey || current?.publishableKey || "";
  const secretKey = keys.secretKey || current?.secretKey || "";
  const webhookSecret = keys.webhookSecret || current?.webhookSecret || "";
  if (!publishableKey && !secretKey && !webhookSecret) return text;
  const lines = [
    publishableKey ? `[stripe_pk=${publishableKey}]` : "",
    secretKey ? `[stripe_sk=${seal(secretKey)}]` : "",
    webhookSecret ? `[stripe_wh=${seal(webhookSecret)}]` : "",
    text,
  ].filter(Boolean);
  return lines.join("\n");
}

export function assertStripeKey(kind: "pk" | "sk" | "wh", value: string): string | null {
  const key = value.trim();
  if (!key) return null;
  if (kind === "pk" && !/^pk_(test|live)_/.test(key)) {
    throw new Error("The publishable key should start with pk_test_ or pk_live_.");
  }
  if (kind === "sk" && !/^sk_(test|live)_/.test(key)) {
    throw new Error("The secret key should start with sk_test_ or sk_live_.");
  }
  if (kind === "wh" && !key.startsWith("whsec_")) {
    throw new Error("The webhook signing secret should start with whsec_.");
  }
  return key;
}

export async function createStripeCheckout(input: {
  secretKey: string;
  orderId: string;
  orderNumber: string;
  shopSlug: string;
  amount: number;
  email?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const cents = Math.round(input.amount * 100);
  if (cents < 50) throw new Error("Card payments need a total of at least €0.50.");
  const body = new URLSearchParams({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.orderId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(cents),
    "line_items[0][price_data][product_data][name]": `Order ${input.orderNumber}`,
    "metadata[order_id]": input.orderId,
    "metadata[shop]": input.shopSlug,
  });
  if (input.email) body.set("customer_email", input.email);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !json.url) {
    throw new Error(json.error?.message || "Stripe did not start the card payment.");
  }
  return json.url;
}

export async function stripeSessionPaid(input: {
  secretKey: string;
  sessionId: string;
  shopSlug: string;
}): Promise<{ orderId: string; amount: number } | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(input.sessionId)}`,
    { headers: { Authorization: `Bearer ${input.secretKey}` } },
  );
  if (!res.ok) return null;
  const session = (await res.json()) as {
    payment_status?: string;
    client_reference_id?: string;
    amount_total?: number;
    metadata?: { order_id?: string; shop?: string };
  };
  if (session.payment_status !== "paid") return null;
  if (session.metadata?.shop && session.metadata.shop !== input.shopSlug) return null;
  const orderId = session.metadata?.order_id || session.client_reference_id;
  if (!orderId) return null;
  return { orderId, amount: (session.amount_total ?? 0) / 100 };
}

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((piece) => {
      const idx = piece.indexOf("=");
      return [piece.slice(0, idx), piece.slice(idx + 1)];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const hmac = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const a = Buffer.from(hmac);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function confirmStripeReturn(shopSlug: string, sessionId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("notes")
    .eq("slug", shopSlug)
    .maybeSingle();
  const keys = readShopStripe(tenant?.notes);
  if (!keys || !sessionId.startsWith("cs_")) return false;
  const paid = await stripeSessionPaid({
    secretKey: keys.secretKey,
    sessionId,
    shopSlug,
  });
  if (!paid) return false;
  await recordStripePayment({ orderId: paid.orderId, sessionId, amount: paid.amount });
  return true;
}

/** Send a card refund back through the shop's Stripe account. */
export async function refundStripeOrder(input: {
  orderId: string;
  amount: number;
  idempotencyKey: string;
}): Promise<number> {
  const cents = Math.round(input.amount * 100);
  if (cents < 1) throw new Error("The refund amount must be at least €0.01.");
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("online_orders")
    .select("id, tenant_id, payment_method")
    .eq("id", input.orderId)
    .maybeSingle();
  if (!order || order.payment_method !== "online_card") {
    throw new Error("Refunds go back only to a card paid through Stripe.");
  }
  const { data: tenant } = await admin
    .from("tenants")
    .select("notes")
    .eq("id", order.tenant_id)
    .maybeSingle();
  const keys = readShopStripe(tenant?.notes);
  if (!keys) throw new Error("Stripe is not connected for this shop.");
  const { data: pay } = await admin
    .from("payments")
    .select("id, external_ref, amount, refunded_amount, status")
    .eq("online_order_id", order.id)
    .eq("method", "card")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!pay?.external_ref || pay.status === "refunded") {
    throw new Error("This order has no Stripe card payment left to refund.");
  }
  const remaining = Math.round((Number(pay.amount) - Number(pay.refunded_amount ?? 0)) * 100);
  if (cents > remaining + 1) {
    throw new Error("That refund is more than the card payment still held.");
  }
  const intent = await paymentIntentId(keys.secretKey, pay.external_ref);
  const body = new URLSearchParams({
    payment_intent: intent,
    amount: String(cents),
  });
  const res = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${keys.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey,
    },
    body,
  });
  const json = (await res.json()) as { id?: string; amount?: number; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || "Stripe did not refund the card.");
  return (json.amount ?? cents) / 100;
}

async function paymentIntentId(secretKey: string, externalRef: string): Promise<string> {
  if (externalRef.startsWith("pi_")) return externalRef;
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(externalRef)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  );
  const json = (await res.json()) as {
    payment_intent?: string | { id?: string };
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message || "Stripe payment was not found.");
  const intent = json.payment_intent;
  const id = typeof intent === "string" ? intent : intent?.id;
  if (!id) throw new Error("Stripe has not captured this card payment yet.");
  return id;
}

export async function recordStripePayment(input: {
  orderId: string;
  sessionId: string;
  amount?: number;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("online_orders")
    .select("id, tenant_id, total, notes, status")
    .eq("id", input.orderId)
    .maybeSingle();
  if (!order) return;
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("online_order_id", order.id)
    .eq("external_ref", input.sessionId)
    .maybeSingle();
  if (!existing) {
    await admin.from("payments").insert({
      tenant_id: order.tenant_id,
      online_order_id: order.id,
      method: "card",
      amount: input.amount && input.amount > 0 ? input.amount : Number(order.total),
      status: "captured",
      external_ref: input.sessionId,
      captured_at: new Date().toISOString(),
    });
  }
  const note = stripePaidNote(order.notes, input.sessionId);
  await admin
    .from("online_orders")
    .update({
      status: order.status === "pending" ? "confirmed" : order.status,
      notes: note,
    })
    .eq("id", order.id);
}

export function orderPaidByStripe(notes: string | null | undefined): boolean {
  return String(notes || "").includes("STRIPE status=paid");
}

function stripePaidNote(notes: string | null, sessionId: string): string {
  const rest = String(notes || "")
    .split("\n")
    .filter((line) => !line.startsWith("STRIPE "))
    .join("\n")
    .trim();
  return [`STRIPE status=paid session=${sessionId}`, rest].filter(Boolean).join("\n");
}

function seal(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function unseal(payload: string): string {
  if (!payload) return "";
  try {
    const raw = Buffer.from(payload, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function secretKey(): Buffer {
  return createHash("sha256")
    .update(process.env.SUPABASE_SERVICE_ROLE_KEY || "shopos-stripe")
    .digest();
}
