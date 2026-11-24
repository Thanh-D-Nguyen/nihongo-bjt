import { redirect } from "next/navigation";

export default async function GrammarPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/search?scope=grammar`);
}
