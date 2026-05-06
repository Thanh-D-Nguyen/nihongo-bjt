import type { Metadata } from "next";

import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { AccountInfoClient } from "./account-info-client";

const messages: Record<string, typeof vi> = { ja, vi };

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.accountInfo.title} — NihonGo BJT` };
}

export default async function AccountInfoPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return <AccountInfoClient labels={t.accountInfo} locale={locale} />;
}
