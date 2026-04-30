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
        { key: "dbStatus", label: "DB" },
        { key: "featureFlagsTotal", label: t.shell.navItems.featureFlags },
        { key: "deadLettersOpen", label: t.shell.navItems.deadLetter },
        { key: "importErrors24h", label: t.overview.importErrorsTitle },
        { key: "generatedAt", label: t.adminConsole.common.updatedAt }
      ]}
      common={t.adminConsole.common}
      description={t.overview.subtitle}
      endpoint="/api/admin/operations/system/health"
      statusKeys={["status", "dbStatus"]}
      title={t.shell.navItems.systemHealth}
    />
  );
}
