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
        { key: "targetId", label: t.supportNotes?.colUser ?? "User ID" },
        { key: "reason", label: t.supportNotes?.colReason ?? "Reason" },
        { key: "after", label: t.supportNotes?.colBody ?? "Note content" },
        { key: "actorId", label: t.supportNotes?.colActor ?? "Admin actor" },
        { key: "createdAt", label: t.supportNotes?.colCreated ?? "Created" }
      ]}
      common={t.adminConsole.common}
      description={t.supportNotes?.description ?? "Support notes added by admin staff for users."}
      endpoint="/api/admin/support/notes?limit=100"
      title={t.shell.navItems.supportNotes}
    />
  );
}
