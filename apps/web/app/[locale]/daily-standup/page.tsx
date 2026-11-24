import { redirect } from "next/navigation";

export default async function DailyStandupRoute({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/scenarios`);
}
