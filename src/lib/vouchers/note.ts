export type VoucherNote = {
  status: string;
  amount: number;
  eligible: number;
  code: string | null;
  expires: string | null;
};

export function parseVoucherNote(notes: string | null | undefined): VoucherNote | null {
  const line = String(notes || "")
    .split("\n")
    .find((row) => row.startsWith("NEEDS_VOUCHER "));
  if (!line) return null;
  const fields = Object.fromEntries(
    line
      .slice("NEEDS_VOUCHER ".length)
      .split(" ")
      .map((part) => {
        const idx = part.indexOf("=");
        return [part.slice(0, idx), part.slice(idx + 1)];
      }),
  );
  return {
    status: fields.status || "pending",
    amount: Number(fields.amount || 0),
    eligible: Number(fields.eligible || 0),
    code: fields.code && fields.code !== "-" ? fields.code : null,
    expires: fields.expires && fields.expires !== "-" ? fields.expires : null,
  };
}

export function voucherNoteLine(voucher: VoucherNote): string {
  return [
    "NEEDS_VOUCHER",
    `status=${voucher.status}`,
    `amount=${voucher.amount.toFixed(2)}`,
    `eligible=${voucher.eligible.toFixed(2)}`,
    `code=${voucher.code || "-"}`,
    `expires=${voucher.expires || "-"}`,
  ].join(" ");
}

export function withVoucherNote(notes: string | null | undefined, voucher: VoucherNote): string {
  const rest = String(notes || "")
    .split("\n")
    .filter((row) => !row.startsWith("NEEDS_VOUCHER "))
    .join("\n")
    .trim();
  return [voucherNoteLine(voucher), rest].filter(Boolean).join("\n");
}

export function makeVoucherCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "NC";
  for (let i = 0; i < 8; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
