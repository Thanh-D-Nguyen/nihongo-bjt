import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { AdminResourceTableClient } from "../_components/admin-resource-table-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec = (t as Record<string, unknown>)["i18nCenter"] as Record<string, string> | undefined;
  return (
    <AdminResourceTableClient
      columns={[
        { key: "namespace", label: sec?.colNamespace ?? "Namespace" },
        { key: "key", label: sec?.colKey ?? "Key" },
        { key: "description", label: sec?.colDescription ?? "Description" },
        { key: "_count.translations", label: sec?.colTranslations ?? "Translations" },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={sec?.subtitle}
      endpoint="/api/admin/i18n/keys?limit=100"
      title={sec?.title ?? "i18n Center"}
    />
  );
}

