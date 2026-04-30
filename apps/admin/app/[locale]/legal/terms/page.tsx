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
        { key: "version", label: "Version" },
        { key: "status", label: t.adminConsole.common.status },
        { key: "effectiveAt", label: "Effective At" }
      ]}
      common={t.adminConsole.common}
      description={t.overview.subtitle}
      endpoint="/api/admin/legal/policies?policyKey=terms_of_service"
      title={t.shell.navItems.legalTerms}
    />
  );
}
