import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { DailyAdminClient } from "./daily-client";

const messages = { ja, vi, en };

export default async function AdminDailyPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <DailyAdminClient labels={t.daily} locale={locale} />;
}
