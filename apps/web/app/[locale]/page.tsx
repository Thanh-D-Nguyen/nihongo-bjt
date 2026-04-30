import ja from "../../messages/ja.json";
import vi from "../../messages/vi.json";
import { DailyHubClient } from "./_components/daily-hub-client";

const messages = { ja, vi };

export default async function LearnerHome({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <DailyHubClient
      dailyLabels={t.daily}
      dashboardLabels={t.dashboard}
      locale={locale}
    />
  );
}
