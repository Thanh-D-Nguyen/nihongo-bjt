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
        { key: "email", label: "Email" },
        { key: "displayName", label: "Name" },
        { key: "status", label: t.adminConsole.common.status },
        { key: "roleCodes", label: t.shell.navItems.iamRoles },
        { key: "updatedAt", label: t.adminConsole.common.updatedAt }
      ]}
      common={t.adminConsole.common}
      description={t.shell.navItems.iamDescription}
      endpoint="/api/admin/iam/admins"
      title={t.shell.navItems.iamAdmins}
    />
  );
}
