import { redirect } from "next/navigation";

export default async function ModulesIndexPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/levels`);
}
