import { redirect } from "next/navigation";

export default async function KanjiPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/search?scope=kanji`);
}
