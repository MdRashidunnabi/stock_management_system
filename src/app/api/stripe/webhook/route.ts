import { createAdminClient } from "@/lib/supabase/admin";
import {
  readShopStripe,
  recordStripePayment,
  verifyStripeSignature,
} from "@/lib/storefront/stripe-shop";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const shop = new URL(request.url).searchParams.get("shop")?.trim().toLowerCase();
  const payload = await request.text();
  if (!shop) return new Response("Missing shop", { status: 400 });

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, notes")
    .eq("slug", shop)
    .maybeSingle();
  const keys = readShopStripe(tenant?.notes);
  if (!tenant || !keys) return new Response("Shop payments are not connected", { status: 404 });
  if (
    !verifyStripeSignature(payload, request.headers.get("stripe-signature"), keys.webhookSecret)
  ) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(payload) as {
    type?: string;
    data?: {
      object?: {
        id?: string;
        payment_status?: string;
        amount_total?: number;
        metadata?: { order_id?: string; shop?: string };
        client_reference_id?: string;
      };
    };
  };
  if (
    event.type === "checkout.session.completed" &&
    event.data?.object?.payment_status === "paid"
  ) {
    const session = event.data.object;
    const orderId = session.metadata?.order_id || session.client_reference_id;
    if (orderId && session.id && session.metadata?.shop === shop) {
      await recordStripePayment({
        orderId,
        sessionId: session.id,
        amount: (session.amount_total ?? 0) / 100,
      });
    }
  }
  return new Response("ok");
}
