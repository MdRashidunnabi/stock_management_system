type Translate = (path: string, vars?: Record<string, string>) => string;

/** Zod / server keys look like `errors.badLogin`. Plain English still shows as-is. */
export function displayMessage(t: Translate, message: string | undefined | null): string {
  if (!message) return "";
  if (message.includes(".")) return t(message);
  return message;
}
