import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "day", label: "Day" },
        { key: "reviews", label: "Reviews" },
        { key: "dau", label: "DAU" }
      ]}
      common={t.adminConsole.common}
      description="Flashcard review trends from the executive analytics endpoint."
      endpoint="/api/admin/analytics?days=30&section=mauDauWau"
      title={t.shell.navItems.flashcardAnalytics}
    />
  );
}

