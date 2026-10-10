import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/tenant";
import { getOnlineOrderDetail } from "@/lib/storefront/admin-queries";
import { getOnlineOrderVoucher } from "@/lib/vouchers/admin";
import { PrintPageButton } from "@/components/online-orders/print-page-button";
import { code39Svg } from "@/lib/vouchers/code39";
import { formatEuro, formatDateTimeIE } from "@/lib/utils";

export default async function VoucherPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["owner", "manager", "warehouse", "delivery"]);
  const { id } = await params;
  const [detail, voucher] = await Promise.all([
    getOnlineOrderDetail(id),
    getOnlineOrderVoucher(id),
  ]);
  if (!detail) notFound();
  if (!voucher?.earnedCode) {
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="text-xl font-semibold">Voucher not issued yet</h1>
        <p className="mt-2 text-sm">
          Confirm the payment on the order first. The code is created then.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md bg-white p-8 text-stone-900">
      <p className="text-xs tracking-[0.2em] uppercase">Needs · Colour of Spice</p>
      <h1 className="mt-2 text-3xl font-bold">Voucher {formatEuro(voucher.earnedAmount)}</h1>
      <p className="mt-2 text-sm">Order {detail.order.order_number}</p>
      <p className="text-sm">{detail.order.customer_name}</p>
      <div className="mt-6" dangerouslySetInnerHTML={{ __html: code39Svg(voucher.earnedCode) }} />
      <p className="mt-2 text-center font-mono text-xl tracking-[0.3em]">{voucher.earnedCode}</p>
      <p className="mt-4 text-sm">
        Deadline: {voucher.expiresAt ? formatDateTimeIE(voucher.expiresAt) : "30 days from issue"}
      </p>
      <p className="mt-3 text-sm">
        Use this code once on the Needs website. It comes off the product total. After it is used,
        the code is no longer valid. A new voucher is based on what you pay after this discount.
      </p>
      <PrintPageButton />
    </main>
  );
}
