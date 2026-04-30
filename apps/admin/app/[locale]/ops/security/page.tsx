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
        { key: "inactiveAdminActors", label: "Inactive Admin Actors" },
        { key: "roles", label: t.shell.navItems.iamRoles },
        { key: "permissions", label: t.shell.navItems.iamPermissions },
        { key: "recentAuditEvents7d", label: "Audit Events (7d)" },
        { key: "criticalOpsActions7d", label: "Critical Ops Actions (7d)" },
        { key: "generatedAt", label: t.adminConsole.common.updatedAt }
      ]}
      common={t.adminConsole.common}
      description={t.overview.subtitle}
      endpoint="/api/admin/operations/security"
      title={t.shell.navItems.securityAudit}
    />
  );
}
