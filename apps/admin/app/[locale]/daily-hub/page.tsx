import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { DailyAdminClient } from "../daily/daily-client";

const messages = { ja, vi };

export default async function AdminDailyHubPage({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return <DailyAdminClient labels={{ ...t.daily, subtitle: t.adminConsole.dailyHub.subtitle, title: t.adminConsole.dailyHub.title }} locale={locale} />;
}
