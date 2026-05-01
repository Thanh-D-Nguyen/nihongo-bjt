import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { SettingsAdminClient } from "./settings-admin-client";

const messages = { en, ja, vi };

export default async function AdminSettingsPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec =
    (((t as Record<string, unknown>)["adminConsole"] as Record<string, unknown> | undefined)?.[
      "settingsManagement"
    ] as Record<string, string> | undefined) ??
    ((t as Record<string, unknown>)["settingsManagement"] as Record<string, string> | undefined) ??
    ((t as Record<string, unknown>)["settingsAdmin"] as Record<string, string> | undefined) ??
    {};
  return <SettingsAdminClient common={t.adminConsole.common} labels={sec} />;
}
