import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["learningPaths"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "slug", label: "Slug" },
        { key: "titleVi", label: sec?.colTitle ?? "Title (VI)" },
        { key: "titleJa", label: "Title (JA)" },
        { key: "targetLevel", label: "Target Level" },
        { key: "displayOrder", label: "Order" },
        { key: "status", label: sec?.colStatus ?? "Status" },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle ?? "Structured learning paths for BJT preparation."}
      endpoint="/api/admin/learning/paths?limit=100"
      statusKeys={["status"]}
      title={sec?.title ?? "Learning Paths"}
    />
  );
}

