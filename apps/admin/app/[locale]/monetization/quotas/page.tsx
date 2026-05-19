import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { MonetizationConsoleClient } from "../monetization-console-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <MonetizationConsoleClient
      common={t.adminConsole.common}
      labels={t.adminConsole.monetizationConsole}
      initialTab="quotas"
    />
  );
}
