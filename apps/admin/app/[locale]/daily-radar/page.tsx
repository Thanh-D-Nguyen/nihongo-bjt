import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { DailyRadarAdminClient } from "./daily-radar-admin-client";

const messages = { en, ja, vi };

export default async function DailyRadarAdminPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return <DailyRadarAdminClient common={t.adminConsole.common} labels={t.dailyRadarAdmin} />;
}
