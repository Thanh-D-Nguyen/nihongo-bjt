import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["battleMatches"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "userId", label: sec?.colUser ?? "User" },
        { key: "mode", label: sec?.colMode ?? "Mode" },
        { key: "roomCode", label: sec?.colRoom ?? "Room" },
        { key: "status", label: sec?.colStatus ?? "Status" },
        { key: "userScore", label: sec?.colUserScore ?? "User score" },
        { key: "opponentScore", label: sec?.colOpponentScore ?? "Opp. score" },
        { key: "_count.rounds", label: sec?.colRounds ?? "Rounds" },
        { key: "startedAt", label: sec?.colStarted ?? "Started" }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle}
      endpoint="/api/admin/battle/sessions?limit=100"
      statusKeys={["status"]}
      title={sec?.title ?? "Battle Matches"}
    />
  );
}
