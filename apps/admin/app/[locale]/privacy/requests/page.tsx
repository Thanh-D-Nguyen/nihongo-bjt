import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const p = t.privacyAdmin ?? {} as Record<string, string>;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "userId", label: p.colUser ?? "User ID" },
        { key: "kind", label: p.colKind ?? "Kind" },
        { key: "status", label: p.colStatus ?? "Status" },
        { key: "lastError", label: p.colLastError ?? "Last error" },
        { key: "createdAt", label: p.colCreated ?? "Created" },
        { key: "completedAt", label: p.colCompleted ?? "Completed" }
      ]}
      common={t.adminConsole.common}
      description={p.allDescription ?? "Privacy requests (export and delete) across all users."}
      endpoint="/api/admin/privacy/requests?limit=100"
      statusKeys={["status", "kind"]}
      title={t.shell.navItems.privacyRequests}
    />
  );
}
