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
        { key: "action", label: t.adminConsole.common.action },
        { key: "targetType", label: "Target Type" },
        { key: "targetId", label: "Target ID" },
        { key: "actorId", label: "Actor" },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={t.shell.navItems.iamDescription}
      endpoint="/api/admin/iam/role-audit?limit=50"
      title={t.shell.navItems.iamRoleAudit}
    />
  );
}
