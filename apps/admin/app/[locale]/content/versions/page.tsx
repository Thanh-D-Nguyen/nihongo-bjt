import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["contentVersions"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "entityType", label: sec?.colEntityType ?? "Entity Type" },
        { key: "entityId", label: "Entity ID" },
        { key: "versionNumber", label: sec?.colVersion ?? "Version" },
        { key: "changeSummary", label: "Change Summary" },
        { key: "status", label: sec?.colStatus ?? "Status" },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle ?? "Track content changes and version history."}
      endpoint="/api/admin/content/versions?limit=100"
      statusKeys={["status", "entityType"]}
      title={sec?.title ?? "Content Versions"}
    />
  );
}

