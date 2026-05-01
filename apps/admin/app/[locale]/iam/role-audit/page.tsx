import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { IamRoleAuditClient } from "./iam-role-audit-client";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <IamRoleAuditClient
      common={t.adminConsole.common}
      labels={t.iam.roleAudit as unknown as Record<string, string>}
      locale={locale}
    />
  );
}
