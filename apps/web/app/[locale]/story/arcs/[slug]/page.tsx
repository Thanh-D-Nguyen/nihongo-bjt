import type { Metadata } from "next";

import en from "../../../../../messages/en.json";
import ja from "../../../../../messages/ja.json";
import vi from "../../../../../messages/vi.json";
import { CareerRpgProvider } from "../../../../../src/features/career-rpg/store";
import { findArc } from "../../../../../src/features/career-rpg/mock-data";

import { ArcDetailClient } from "./_components/arc-detail-client";

const messages = { ja, vi, en } as const;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = (messages as Record<string, typeof vi>)[locale] ?? messages.vi;
  const arc = findArc(slug);
  return { title: `${arc?.titleJa ?? t.careerRpg.arcs.title} — NihonGo BJT` };
}

export default async function ArcDetailRoute({
  params
}: {
  params: Promise<{ locale: keyof typeof messages; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <CareerRpgProvider>
      <ArcDetailClient labels={t.careerRpg} locale={locale} slug={slug} />
    </CareerRpgProvider>
  );
}
