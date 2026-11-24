import { redirect } from "next/navigation";

export default async function CareerRoute({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/scenarios`);
}
