import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["battleConfigs"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "key", label: sec?.colKey ?? "Key" },
        { key: "value", label: sec?.colValue ?? "Value" },
        { key: "source", label: sec?.colSource ?? "Source" },
        { key: "description", label: sec?.colDescription ?? "Description" }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle ?? "Current battle system configuration (code-defined + live stats)."}
      endpoint="/api/admin/battle/configs"
      statusKeys={["source"]}
      title={sec?.title ?? "Battle Configs"}
    />
  );
}
