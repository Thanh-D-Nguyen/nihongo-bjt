import type { Metadata } from "next";

import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { CareerRpgProvider } from "../../../../src/features/career-rpg/store";

import { ArcsPageClient } from "./_components/arcs-page-client";

const messages = { ja, vi } as const;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = (messages as Record<string, typeof vi>)[locale] ?? messages.vi;
  return { title: `${t.careerRpg.arcs.title} — NihonGo BJT` };
}

export default async function ArcsRoute({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <CareerRpgProvider>
      <ArcsPageClient labels={t.careerRpg} locale={locale} />
    </CareerRpgProvider>
  );
}
