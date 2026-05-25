import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { AdminAnalyticsClient } from "./analytics-client";

const messages = { ja, vi, en };

export default async function AdminAnalyticsPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <AdminAnalyticsClient common={t.adminConsole.common} labels={t.analytics} locale={locale} />;
}
