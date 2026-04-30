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
        { key: "description", label: "Description" },
        { key: "roleCount", label: t.shell.navItems.iamRoles },
        { key: "createdAt", label: t.adminConsole.common.createdAt }
      ]}
      common={t.adminConsole.common}
      description={t.shell.navItems.iamDescription}
      endpoint="/api/admin/iam/permissions"
      title={t.shell.navItems.iamPermissions}
    />
  );
}
