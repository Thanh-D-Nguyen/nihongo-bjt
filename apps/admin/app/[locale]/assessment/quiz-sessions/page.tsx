import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["quizSessions"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "userId", label: sec?.colUser ?? "User" },
        { key: "testId", label: sec?.colTest ?? "Test" },
        { key: "status", label: sec?.colStatus ?? "Status" },
        { key: "estimatedScore", label: sec?.colScore ?? "Score" },
        { key: "estimatedBjtBand", label: sec?.colBand ?? "Band" },
        { key: "correctCount", label: sec?.colCorrect ?? "Correct" },
        { key: "totalQuestions", label: sec?.colTotal ?? "Total" },
        { key: "startedAt", label: sec?.colStarted ?? "Started" }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle}
      endpoint="/api/admin/quiz/sessions?limit=100"
      statusKeys={["status"]}
      title={sec?.title ?? "Quiz Sessions"}
    />
  );
}

