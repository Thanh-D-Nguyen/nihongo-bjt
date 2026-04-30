import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["flashcardTemplates"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "frontText", label: sec?.colFront ?? "Front" },
        { key: "backText", label: sec?.colBack ?? "Back" },
        { key: "sourceType", label: sec?.colSource ?? "Source" },
        { key: "reading", label: sec?.colReading ?? "Reading" },
        { key: "status", label: sec?.colStatus ?? "Status" },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle}
      endpoint="/api/admin/flashcards/variants?limit=100"
      statusKeys={["status"]}
      title={sec?.title ?? "Flashcard Templates"}
    />
  );
}

