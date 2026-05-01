import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { DailyItemsAdminClient } from "./daily-items-client";

const messages = { en, ja, vi };

export default async function AdminDailyHubPage({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec =
    ((t.adminConsole as Record<string, unknown> | undefined)?.["dailyItems"] as
      | Record<string, string>
      | undefined) ?? {};
  return (
    <DailyItemsAdminClient
      common={t.adminConsole.common}
      labels={sec as unknown as Record<string, string>}
      locale={locale}
    />
  );
}
