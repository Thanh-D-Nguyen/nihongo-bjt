import type { Metadata } from "next";
import vi from "../../../../messages/vi.json";
import ja from "../../../../messages/ja.json";
import { LevelDetailClient } from "./_components/level-detail-client";

const messages: Record<string, typeof vi> = { ja, vi };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.levels.title} — NihonGo BJT` };
}

export default async function LevelDetailPage({
  params
}: {
  params: Promise<{ level: string; locale: keyof typeof messages }>;
}) {
  const { level, locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return <LevelDetailClient code={level.toUpperCase()} labels={t.levelDetail} locale={locale} />;
}
