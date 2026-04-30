import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "d", label: "Day" },
        { key: "total", label: "Total searches" },
        { key: "zero", label: "Zero-result" }
      ]}
      common={t.adminConsole.common}
      description={t.analytics.drillSearchDesc}
      endpoint="/api/admin/analytics?days=30&section=search"
      title={t.analytics.drillSearchTitle}
    />
  );
}
