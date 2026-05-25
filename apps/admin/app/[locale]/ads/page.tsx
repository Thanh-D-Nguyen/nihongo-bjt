import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { AdsConsoleClient } from "./ads-console-client";

const messages = { ja, vi, en };

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
