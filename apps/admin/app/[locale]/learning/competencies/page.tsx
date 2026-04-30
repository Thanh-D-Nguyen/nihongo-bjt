import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["competencies"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "code", label: sec?.colCode ?? "Code" },
        { key: "titleVi", label: sec?.colTitle ?? "Title (VI)" },
        { key: "titleJa", label: "Title (JA)" },
        { key: "level", label: sec?.colLevel ?? "Level" },
        { key: "status", label: sec?.colStatus ?? "Status" },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle ?? "BJT competency framework entries."}
      endpoint="/api/admin/learning/competencies?limit=100"
      statusKeys={["status", "level"]}
      title={sec?.title ?? "Competencies"}
    />
  );
}

