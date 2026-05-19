import type { Metadata } from "next";

import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { SubscriptionSettingsClient } from "./_components/subscription-settings-client";

const messages: Record<string, typeof vi> = { ja, vi };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.subscription.title} — NihonGo BJT` };
}

export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <SubscriptionSettingsClient labels={t.subscription} locale={locale} />;
}
