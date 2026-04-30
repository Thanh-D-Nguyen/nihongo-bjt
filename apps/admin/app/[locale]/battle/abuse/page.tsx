import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["battleAbuse"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "userId", label: sec?.colUser ?? "User ID" },
        { key: "signalType", label: sec?.colSignal ?? "Signal" },
        { key: "totalMatches", label: sec?.colTotal ?? "Total Matches" },
        { key: "abandoned", label: sec?.colAbandoned ?? "Abandoned" },
        { key: "avgDurationSeconds", label: sec?.colDuration ?? "Avg Duration (s)" }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle ?? "Users flagged for high abandon rates or suspiciously fast completions."}
      endpoint="/api/admin/battle/abuse-signals?limit=50"
      statusKeys={["signalType"]}
      title={sec?.title ?? "Battle Abuse Signals"}
    />
  );
}
