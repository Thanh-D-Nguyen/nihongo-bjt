import { redirect } from "next/navigation";

export default async function SettingsHubPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/me?tab=settings`);
}
