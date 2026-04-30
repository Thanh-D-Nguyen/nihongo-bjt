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
        { key: "status", label: t.adminConsole.common.status },
        { key: "version", label: "Version" },
        { key: "commitSha", label: "Commit" },
        { key: "environment", label: "Env" },
        { key: "uptimeSeconds", label: "Uptime (s)" },
        { key: "nodeVersion", label: "Node" },
        { key: "generatedAt", label: t.adminConsole.common.updatedAt }
      ]}
      common={t.adminConsole.common}
      description={t.overview.subtitle}
      endpoint="/api/admin/operations/system/release"
      title={t.shell.navItems.release}
    />
  );
}
