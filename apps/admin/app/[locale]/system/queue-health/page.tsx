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
        { key: "status", label: t.adminConsole.common.status },
        { key: "openDeadLetters", label: "Open DLQ" },
        { key: "failedDeadLetters", label: "Failed DLQ" },
        { key: "resolvedDeadLetters", label: "Resolved DLQ" },
        { key: "discardedDeadLetters", label: "Discarded DLQ" },
        { key: "stalledJobs", label: "Stalled" },
        { key: "generatedAt", label: t.adminConsole.common.updatedAt }
      ]}
      common={t.adminConsole.common}
      description={t.overview.subtitle}
      endpoint="/api/admin/operations/system/queue-health"
      title={t.shell.navItems.queueHealth}
    />
  );
}
