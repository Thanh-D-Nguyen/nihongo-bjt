import { redirect } from "next/navigation";

export default async function DailyRadarModulePlaceholder({
  params
}: {
  params: Promise<{ locale: string; moduleKey: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/levels`);
}
