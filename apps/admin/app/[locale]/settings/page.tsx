import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { AdminResourceTableClient } from "../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const s = t.settingsAdmin ?? {} as Record<string, string>;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "key", label: s.colKey ?? "Flag key" },
        { key: "enabled", label: s.colEnabled ?? "Enabled" },
        { key: "description", label: s.colDescription ?? "Description" },
        { key: "updatedAt", label: s.colUpdated ?? "Updated" }
      ]}
      common={t.adminConsole.common}
      description={s.description ?? "System feature flags and configuration settings."}
      endpoint="/api/admin/operations/feature-flags"
      statusKeys={["enabled"]}
      title={t.shell.navItems.settings}
    />
  );
}
