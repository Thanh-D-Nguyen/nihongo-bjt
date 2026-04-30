import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["quizTemplates"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "slug", label: "Slug" },
        { key: "titleVi", label: sec?.colTitle ?? "Title (VI)" },
        { key: "type", label: "Type" },
        { key: "status", label: sec?.colStatus ?? "Status" },
        { key: "timeLimitSeconds", label: "Time Limit (s)" },
        { key: "_count.sections", label: sec?.colSections ?? "Sections" },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle ?? "Quiz templates — practice-type tests for learner self-study."}
      endpoint="/api/admin/quiz/tests?limit=100&type=practice"
      statusKeys={["status", "type"]}
      title={sec?.title ?? "Quiz Templates"}
    />
  );
}

