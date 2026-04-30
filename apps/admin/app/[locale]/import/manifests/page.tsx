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
        { key: "sourceType", label: "Source type" },
        { key: "targetType", label: "Target type" },
        { key: "version", label: "Version" },
        { key: "status", label: "Status" },
        { key: "notes", label: "Notes" },
        { key: "createdAt", label: "Created" },
        { key: "updatedAt", label: "Updated" }
      ]}
      common={t.adminConsole.common}
      description="Import mapping manifests with source-to-target type configurations."
      endpoint="/api/admin/operations/import-manifests?limit=100"
      title={t.shell.navItems.importManifests}
    />
  );
}
