import { redirect } from "next/navigation";

export default async function InboxRoute({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/flashcards?tab=review`);
}
