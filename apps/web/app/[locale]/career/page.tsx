import type { Metadata } from "next";

import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { CareerRpgProvider } from "../../../src/features/career-rpg/store";

import { CareerPageClient } from "./_components/career-page-client";

const messages = { ja, vi, en } as const;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = (messages as Record<string, typeof vi>)[locale] ?? messages.vi;
  return { title: `${t.careerRpg.career.title} — NihonGo BJT` };
}

export default async function CareerRoute({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <CareerRpgProvider>
      <CareerPageClient labels={t.careerRpg} locale={locale} />
    </CareerRpgProvider>
  );
}
