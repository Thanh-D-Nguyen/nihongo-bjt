import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { UsersConsoleClient } from "./users-console-client";

const messages = { ja, vi, en };

export default async function AdminUsersPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <UsersConsoleClient
      common={t.adminConsole.common}
      form={t.users}
      locale={locale}
      um={t.userManagement}
    />
  );
}
