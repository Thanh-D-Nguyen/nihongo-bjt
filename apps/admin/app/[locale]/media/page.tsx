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
        { key: "objectKey", label: t.mediaLibrary.colKey },
        { key: "mimeType", label: t.mediaLibrary.colMime },
        { key: "byteSize", label: "Size (bytes)" },
        { key: "rightsStatus", label: t.mediaLibrary.colRights },
        { key: "status", label: t.mediaLibrary.colStatus },
        { key: "provider", label: "Provider" },
        { key: "license", label: "License" },
        { key: "createdAt", label: "Created" }
      ]}
      common={t.adminConsole.common}
      description={t.mediaLibrary.subtitle}
      endpoint="/api/admin/media?limit=100"
      statusKeys={["rightsStatus", "status"]}
      title={t.mediaLibrary.title}
    />
  );
}
