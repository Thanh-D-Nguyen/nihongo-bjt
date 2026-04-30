import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { ContentDashboardClient } from "./_components/content-dashboard-client";

const messages = { ja, vi };

export default async function AdminContentPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <ContentDashboardClient labels={t.content} locale={locale} />;
}
