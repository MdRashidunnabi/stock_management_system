import { getAssistantSession } from "@/lib/assistant/actions";
import { ShopAssistant } from "@/components/assistant/shop-assistant";
import { getRequestLocale } from "@/lib/i18n/get-locale";

export async function AssistantGate() {
  const session = await getAssistantSession();
  const locale = await getRequestLocale();
  return <ShopAssistant key={locale} session={session} />;
}
