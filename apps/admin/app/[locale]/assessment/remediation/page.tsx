import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["remediation"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "prompt", label: sec?.colPrompt ?? "Question Prompt" },
        { key: "skillTag", label: sec?.colSkill ?? "Skill" },
        { key: "difficulty", label: sec?.colDifficulty ?? "Difficulty" },
        { key: "hasRemediation", label: sec?.colHasCard ?? "Has Card Link" },
        { key: "hasExplanation", label: "Has Explanation" },
        { key: "status", label: sec?.colStatus ?? "Status" },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle ?? "Questions with remediation card links and explanations."}
      endpoint="/api/admin/quiz/remediation?limit=100"
      statusKeys={["status", "hasRemediation"]}
      title={sec?.title ?? "Remediation Links"}
    />
  );
}

