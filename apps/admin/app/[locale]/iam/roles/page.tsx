import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { IamRolesClient } from "./iam-roles-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <IamRolesClient
      common={t.adminConsole.common}
      labels={t.iam.roleManagement as unknown as Record<string, string>}
      locale={locale}
    />
  );
}
