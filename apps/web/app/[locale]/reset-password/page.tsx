import { isSupportedLocale } from "@nihongo-bjt/config";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { BrandFull } from "../../_components/brand-logo";
import { AuthHeroLayout } from "../_components/auth-hero-layout";
import { ResetPasswordFormClient } from "./_components/reset-password-form-client";

const messages = { ja, vi, en };

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ locale: string }> }>): Promise<Metadata> {
  const { locale } = await params;
  const loc = isSupportedLocale(locale) ? locale : "vi";
  return { referrer: "no-referrer", robots: { index: false }, title: messages[loc].auth.resetPassword.metaTitle };
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isSupportedLocale(locale)) notFound();
  const loc = locale as keyof typeof messages;
  const copy = messages[loc].auth.resetPassword;
  const token = typeof query.token === "string" && query.token.length > 0 ? query.token : null;

  return (
    <AuthHeroLayout locale={locale}>
      <div className="mb-8 text-center lg:hidden">
        <Link href={`/${locale}`} className="inline-flex justify-center no-underline"><BrandFull markSize={36} /></Link>
      </div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{copy.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{copy.subtitle}</p>
      </div>
      <div className="rounded-2xl border border-ink/10 bg-surface p-6 shadow-[0_12px_40px_rgba(23,33,31,0.06)]">
        <ResetPasswordFormClient
          copy={{
            backToLogin: copy.backToLogin,
            confirmPasswordLabel: copy.confirmPasswordLabel,
            genericError: copy.genericError,
          invalidToken: copy.invalidToken,
          languageLabel: copy.languageLabel,
            mismatch: copy.mismatch,
            passwordHint: copy.passwordHint,
            passwordLabel: copy.passwordLabel,
            passwordTooLong: copy.passwordTooLong,
            preparing: copy.preparing,
            primaryCta: copy.primaryCta,
            submitting: copy.submitting,
            successMessage: copy.successMessage,
          }}
          localePrefix={`/${locale}`}
          token={token}
        />
      </div>
      <div className="mt-6 text-center text-sm text-muted">
        <Link className="font-medium text-ink underline-offset-4 hover:underline" href={`/${locale}/login`}>{copy.backToLogin}</Link>
      </div>
    </AuthHeroLayout>
  );
}
