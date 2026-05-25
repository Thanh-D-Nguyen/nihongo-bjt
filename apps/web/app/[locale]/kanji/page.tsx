import type { Metadata } from "next";
import vi from "../../../messages/vi.json";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import { KanjiClient } from "./_components/kanji-client";

const messages: Record<string, typeof vi> = { ja, vi, en };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.kanji.title} — NihonGo BJT` };
}

export default async function KanjiPage({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return <KanjiClient labels={t.kanji} locale={locale} />;
}
