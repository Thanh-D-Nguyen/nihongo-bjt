import { redirect } from "next/navigation";

export default async function DictionaryPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/search?scope=lexeme`);
}
