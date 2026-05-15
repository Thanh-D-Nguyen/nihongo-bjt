import type { Metadata } from "next";

import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { SettingsHubClient } from "./_components/settings-hub-client";

const messages: Record<string, typeof vi> = { ja, vi };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.settings.title} — NihonGo BJT` };
}

export default async function SettingsHubPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <SettingsHubClient
      labels={{
        settings: t.settings,
        accountInfo: t.accountInfo,
        appearancePage: t.appearancePage,
      }}
      locale={locale}
    />
  );
}
