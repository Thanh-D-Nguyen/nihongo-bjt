import ja from "../../messages/ja.json";
import vi from "../../messages/vi.json";
import { AdminOverviewClient } from "./_components/admin-overview-client";

const messages = { ja, vi };

export default async function AdminHome({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <AdminOverviewClient
      common={t.adminConsole.common}
      locale={locale}
      overviewDashboard={t.overviewDashboard}
      overviewLegacy={t.overview}
    />
  );
}
