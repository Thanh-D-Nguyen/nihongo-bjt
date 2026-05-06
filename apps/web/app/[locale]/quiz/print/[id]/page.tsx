import type { Metadata } from "next";

import { PrintExamClient } from "./_components/print-exam-client";

export const metadata: Metadata = {
  title: "In đề thi BJT — NihonGo BJT",
  robots: "noindex"
};

export default async function PrintExamPage({
  params
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  return <PrintExamClient examId={id} locale={locale} />;
}
