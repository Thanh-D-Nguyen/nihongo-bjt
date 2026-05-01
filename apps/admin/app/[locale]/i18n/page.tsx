import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { I18nAdminClient } from "./i18n-admin-client";

const messages = { en, ja, vi };

export default async function Page({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec =
    (((t as Record<string, unknown>)["adminConsole"] as Record<string, unknown> | undefined)?.[
      "i18nManagement"
    ] as Record<string, string> | undefined) ??
    ((t as Record<string, unknown>)["i18nManagement"] as Record<string, string> | undefined) ??
    ((t as Record<string, unknown>)["i18nCenter"] as Record<string, string> | undefined) ??
    {};
  return <I18nAdminClient common={t.adminConsole.common} labels={sec as Record<string, string>} />;
}
