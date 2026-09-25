const SAFE_AUTH_ERRORS = new Set([
  "Missing authentication code.",
  "Could not complete sign-in.",
  "Email link is invalid or has expired",
]);

export function publicAuthCallbackError(raw: string | null | undefined): string {
  const message = (raw ?? "").trim();
  if (!message) return "Could not complete sign-in.";
  if (SAFE_AUTH_ERRORS.has(message)) return message;
  const lower = message.toLowerCase();
  if (lower.includes("expired") || lower.includes("invalid")) {
    return "This sign-in link is invalid or has expired.";
  }
  return "Could not complete sign-in.";
}

export function publicStorefrontOrderError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("insufficient stock")) {
    return "Some items are no longer in stock. Please update your cart.";
  }
  if (msg.includes("shop not found") || msg.includes("not enabled")) {
    return "This online shop is not available.";
  }
  if (msg.includes("pickup")) {
    return "Please choose a collection date and time in the future.";
  }
  if (msg.includes("delivery address")) {
    return "Please enter your delivery address.";
  }
  if (msg.includes("idempoten") || msg.includes("duplicate")) {
    return "This order was already placed.";
  }
  return "Order could not be placed. Please try again.";
}
