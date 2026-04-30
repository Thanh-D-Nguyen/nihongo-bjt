import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["questionBank"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "prompt", label: sec?.colPrompt ?? "Prompt" },
        { key: "skillTag", label: sec?.colSkill ?? "Skill" },
        { key: "difficulty", label: sec?.colDifficulty ?? "Difficulty" },
        { key: "_count.options", label: sec?.colOptions ?? "Options" },
        { key: "status", label: sec?.colStatus ?? "Status" },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle}
      endpoint="/api/admin/quiz/questions?limit=100"
      statusKeys={["status"]}
      title={sec?.title ?? "Question Bank"}
    />
  );
}

