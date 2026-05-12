import type { Metadata } from "next";
import vi from "../../../../messages/vi.json";
import ja from "../../../../messages/ja.json";
import { KanjiDetailClient } from "./_components/kanji-detail-client";

const messages: Record<string, typeof vi> = { ja, vi };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.kanji.title} — NihonGo BJT` };
}

export default async function KanjiDetailPage({
  params
}: {
  params: Promise<{ id: string; locale: keyof typeof messages }>;
}) {
  const { id, locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return <KanjiDetailClient actionLabels={t.contentActions} id={id} labels={t.kanjiDetail} locale={locale} />;
}
