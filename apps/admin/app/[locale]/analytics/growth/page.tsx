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
        { key: "week", label: "Week" },
        { key: "signups", label: "Signups" },
        { key: "w1Retention", label: "W1 retention" }
      ]}
      common={t.adminConsole.common}
      description="User growth cohorts and weekly retention from the executive analytics endpoint."
      endpoint="/api/admin/analytics?days=30&section=cohort"
      title={t.shell.navItems.userGrowth}
    />
  );
}

