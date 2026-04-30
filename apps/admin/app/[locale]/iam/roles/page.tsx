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
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "status", label: t.adminConsole.common.status },
        { key: "permissionCount", label: t.shell.navItems.iamPermissions },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={t.shell.navItems.iamDescription}
      endpoint="/api/admin/iam/roles"
      title={t.shell.navItems.iamRoles}
    />
  );
}
