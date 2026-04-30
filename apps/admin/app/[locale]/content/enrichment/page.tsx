import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["contentEnrichment"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "entityType", label: sec?.colEntityType ?? "Entity Type" },
        { key: "entityId", label: "Entity ID" },
        { key: "enrichmentType", label: sec?.colEnrichType ?? "Enrichment Type" },
        { key: "priority", label: "Priority" },
        { key: "status", label: sec?.colStatus ?? "Status" },
        { key: "processedAt", label: "Processed At" },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle ?? "Content enrichment processing queue."}
      endpoint="/api/admin/content/enrichment?limit=100"
      statusKeys={["status", "enrichmentType"]}
      title={sec?.title ?? "Enrichment Queue"}
    />
  );
}

