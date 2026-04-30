import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { AdminResourceTableClient } from "../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "sourceType", label: "Source type" },
        { key: "sourceDir", label: "Source dir" },
        { key: "status", label: "Status" },
        { key: "fileCount", label: "Files" },
        { key: "itemCount", label: "Items" },
        { key: "errorCount", label: "Errors" },
        { key: "startedAt", label: "Started" },
        { key: "completedAt", label: "Completed" },
        { key: "createdAt", label: "Created" }
      ]}
      common={t.adminConsole.common}
      description={t.adminConsole.import.subtitle}
      endpoint="/api/admin/operations/import-batches?limit=100"
      title={t.adminConsole.import.title}
    />
  );
}
