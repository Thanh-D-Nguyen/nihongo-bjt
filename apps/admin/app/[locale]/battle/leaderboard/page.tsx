import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["battleLeaderboard"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "rank", label: sec?.colRank ?? "Rank" },
        { key: "userId", label: sec?.colUser ?? "User ID" },
        { key: "wins", label: sec?.colWins ?? "Wins" },
        { key: "losses", label: sec?.colLosses ?? "Losses" },
        { key: "totalMatches", label: sec?.colTotal ?? "Total" },
        { key: "winRate", label: sec?.colWinRate ?? "Win Rate %" },
        { key: "avgScore", label: sec?.colAvgScore ?? "Avg Score" }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle ?? "Top players ranked by win count from completed battles."}
      endpoint="/api/admin/battle/leaderboard?limit=50"
      title={sec?.title ?? "Battle Leaderboard"}
    />
  );
}
