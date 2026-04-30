import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AdminResourceTableClient } from "../../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["growthSocial"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "kind", label: sec?.colKind ?? "Kind" },
        { key: "publicToken", label: sec?.colToken ?? "Token" },
        { key: "userId", label: sec?.colUser ?? "User" },
        { key: "_count.cardAssets", label: sec?.colAssets ?? "Assets" },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle}
      endpoint="/api/admin/growth/share-items?limit=100"
      title={sec?.title ?? "Social Sharing"}
    />
  );
}

