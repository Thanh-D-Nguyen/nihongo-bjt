import { redirect } from "next/navigation";

export default async function LinkedAccountsRedirectPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/settings/accounts`);
}
