import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["battleBots"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "botKey", label: sec?.colKey ?? "Bot Key" },
        { key: "correctProbability", label: sec?.colDifficulty ?? "Correct %" },
        { key: "minDelayMs", label: "Min Delay (ms)" },
        { key: "maxDelayMs", label: "Max Delay (ms)" },
        { key: "isDefault", label: "Default" },
        { key: "totalMatches", label: sec?.colMatches ?? "Matches" },
        { key: "avgUserScore", label: "Avg User Score" },
        { key: "avgBotScore", label: "Avg Bot Score" }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle ?? "Code-defined bot profiles with live match statistics."}
      endpoint="/api/admin/battle/bots"
      title={sec?.title ?? "Bot Profiles"}
    />
  );
}
