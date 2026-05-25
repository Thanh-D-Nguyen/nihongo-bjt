import type { Metadata } from "next";

import en from "../../../../../messages/en.json";
import ja from "../../../../../messages/ja.json";
import vi from "../../../../../messages/vi.json";
import { CareerRpgProvider } from "../../../../../src/features/career-rpg/store";
import { findChapter } from "../../../../../src/features/career-rpg/mock-data";

import { ChapterPlayerClient } from "./_components/chapter-player-client";

const messages = { ja, vi, en } as const;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const t = (messages as Record<string, typeof vi>)[locale] ?? messages.vi;
  const chapter = findChapter(id);
  return { title: `${chapter?.titleJa ?? t.careerRpg.chapter.briefingEyebrow} — NihonGo BJT` };
}

export default async function ChapterRoute({
  params
}: {
  params: Promise<{ locale: keyof typeof messages; id: string }>;
}) {
  const { locale, id } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <CareerRpgProvider>
      <ChapterPlayerClient chapterId={id} labels={t.careerRpg} locale={locale} />
    </CareerRpgProvider>
  );
}
