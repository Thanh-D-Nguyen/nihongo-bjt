import type { Metadata } from "next";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

const messages = { en, ja, vi };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale as keyof typeof messages] ?? vi;
  return { title: t.auth.login.metaTitle };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
