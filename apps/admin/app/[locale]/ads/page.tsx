import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { AdsConsoleClient } from "./ads-console-client";

const messages = { ja, vi };

export default async function AdminAdsPage({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <AdsConsoleClient
      common={t.adminConsole.common}
      labels={t.adminConsole.adsConsole}
    />
  );
}
