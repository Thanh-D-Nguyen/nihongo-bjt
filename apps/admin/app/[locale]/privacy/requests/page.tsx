import { redirect } from "next/navigation";

/**
 * /privacy/requests was historically a duplicate of /privacy/data-requests
 * (same `/api/admin/privacy/requests` endpoint). Consolidated 2026-05-01:
 * /privacy/data-requests is the canonical management surface.
 */
export default async function Page({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/privacy/data-requests`);
}
