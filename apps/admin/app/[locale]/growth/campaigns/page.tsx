import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["growthCampaigns"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "name", label: sec?.colName ?? "Name" },
        { key: "status", label: sec?.colStatus ?? "Status" },
        { key: "provider", label: sec?.colProvider ?? "Provider" },
        { key: "startDate", label: sec?.colStart ?? "Start" },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle}
      endpoint="/api/admin/growth/campaigns?limit=100"
      statusKeys={["status"]}
      title={sec?.title ?? "Ad Campaigns"}
    />
  );
}

