import type { Metadata } from "next";
import vi from "../../../messages/vi.json";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import { LevelsClient } from "./_components/levels-client";

const messages: Record<string, typeof vi> = { ja, vi, en };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.levels.title} — NihonGo BJT` };
}

export default async function LevelsPage({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return <LevelsClient labels={t.levels} locale={locale} />;
}
