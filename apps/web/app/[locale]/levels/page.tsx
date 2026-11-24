import type { Metadata } from "next";
import { redirect } from "next/navigation";
import vi from "../../../messages/vi.json";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import { LevelsClient } from "./_components/levels-client";

const messages: Record<string, typeof vi> = { ja, vi, en };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.levels.title} — Kiokoto` };
}

export default async function LevelsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: keyof typeof messages }>;
  searchParams?: Promise<{ track?: string | string[] }>;
}) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const rawTrack = Array.isArray(sp?.track) ? sp.track[0] : sp?.track;
  const track = rawTrack?.trim().toLowerCase();

  if (track === "scenarios") {
    redirect(`/${locale}/scenarios`);
  }
  if (track === "reading") {
    redirect(`/${locale}/news`);
  }

  const t = messages[locale] ?? messages.vi;
  return <LevelsClient labels={t.levels} locale={locale} studyTrackLabels={t.studyTracks} />;
}
