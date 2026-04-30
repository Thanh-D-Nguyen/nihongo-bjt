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
        { key: "slug", label: "Slug" },
        { key: "titleVi", label: "Title (VI)" },
        { key: "titleJa", label: "Title (JA)" },
        { key: "type", label: "Type" },
        { key: "status", label: "Status" },
        { key: "timeLimitSeconds", label: "Time limit (s)" },
        { key: "_count.sections", label: "Sections" },
        { key: "_count.sessions", label: "Sessions" },
        { key: "createdAt", label: "Created" }
      ]}
      common={t.adminConsole.common}
      description={t.adminConsole.bjt.subtitle}
      endpoint="/api/admin/quiz/tests?limit=100"
      title={t.adminConsole.bjt.title}
    />
  );
}
