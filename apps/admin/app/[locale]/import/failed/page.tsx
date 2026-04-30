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
        { key: "rawItemId", label: "Raw Item" },
        { key: "sourceKey", label: "Source Key" },
        { key: "message", label: "Message" },
        { key: "phase", label: "Phase" },
        { key: "severity", label: "Severity" }
      ]}
      common={t.adminConsole.common}
      description={t.overview.subtitle}
      endpoint="/api/admin/operations/import-staging/errors?limit=100"
      title={t.shell.navItems.importFailed}
    />
  );
}
