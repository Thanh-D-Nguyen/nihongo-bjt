import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["flashcardDecks"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "titleVi", label: sec?.colTitle ?? "Title (VI)" },
        { key: "titleJa", label: "Title (JA)" },
        { key: "visibility", label: sec?.colVisibility ?? "Visibility" },
        { key: "status", label: sec?.colStatus ?? "Status" },
        { key: "_count.cards", label: sec?.colCards ?? "Cards" },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle}
      endpoint="/api/admin/flashcards/decks?limit=100"
      statusKeys={["status", "visibility"]}
      title={sec?.title ?? "Generated Decks"}
    />
  );
}

