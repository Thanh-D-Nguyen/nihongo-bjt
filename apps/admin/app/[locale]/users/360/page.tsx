import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { User360Client } from "./user-360-client";

const messages = { ja, vi, en };

export default async function Page({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <User360Client
      common={t.adminConsole.common}
      locale={locale}
      um={t.userManagement}
    />
  );
}
