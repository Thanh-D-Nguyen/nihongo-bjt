import { redirect } from "next/navigation";

export default async function SavedPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/search?tab=saved`);
}
