import type { Metadata } from "next";

import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { AppearanceSettingsClient } from "./_components/appearance-settings-client";

const messages: Record<string, typeof vi> = { ja, vi, en };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.appearancePage.title} — NihonGo BJT` };
}

export default async function AppearanceSettingsPage({
  params,
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <AppearanceSettingsClient labels={t.appearancePage} locale={locale} />;
}
