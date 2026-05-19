import type { Metadata } from "next";

import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { PricingClient } from "./_components/pricing-client";

const messages: Record<string, typeof vi> = { ja, vi };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.pricing.title} — NihonGo BJT` };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <PricingClient labels={t.pricing} locale={locale} />;
}
