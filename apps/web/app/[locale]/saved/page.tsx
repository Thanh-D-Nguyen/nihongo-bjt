import type { Metadata } from "next";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { SavedPageClient } from "./_components/saved-page-client";

const messages: Record<string, typeof vi> = { ja, vi, en };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.saved.title} — NihonGo BJT` };
}

export default async function SavedPage({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <SavedPageClient labels={t.saved} locale={locale} />;
}
