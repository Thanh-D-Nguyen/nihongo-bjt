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
        { key: "name", label: "Check" },
        { key: "status", label: "Status" }
      ]}
      common={t.adminConsole.common}
      description="System health and data freshness from the operations health endpoint."
      endpoint="/api/admin/operations/system/health"
      title={t.shell.navItems.systemAnalytics}
    />
  );
}

