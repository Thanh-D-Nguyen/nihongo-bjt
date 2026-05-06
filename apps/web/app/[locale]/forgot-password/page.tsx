import { isSupportedLocale } from "@nihongo-bjt/config";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { AuthHeroLayout } from "../_components/auth-hero-layout";
import { ForgotPasswordFormClient } from "./_components/forgot-password-form-client";

const messages = { ja, vi };

const LOCALE_LABELS: Record<string, string> = { vi: "Tiếng Việt", ja: "日本語" };

export async function generateMetadata({
  params
}: Readonly<{
  params: Promise<{ locale: string }>;
}>): Promise<Metadata> {
  const { locale } = await params;
  const loc = isSupportedLocale(locale) ? (locale as "ja" | "vi") : "vi";
  const t = messages[loc].auth.forgotPassword;
  return {
    robots: { index: false },
    title: t.metaTitle
  };
}

export default async function ForgotPasswordPage({
  params
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  const loc = locale as "ja" | "vi";
  const t = messages[loc].auth.forgotPassword;
  const localePrefix = `/${locale}`;

  // Locale switcher
  const localeQs = "";

  return (
    <AuthHeroLayout locale={locale}>
      {/* Brand — mobile only */}
      <div className="mb-8 text-center lg:hidden">
        <Link href={localePrefix} className="no-underline">
          <p className="text-xl font-bold tracking-tight text-ink">
            {messages[loc].nav.brand}
          </p>
        </Link>
      </div>

      {/* Tab switcher — link back to login/register for consistency */}
      <div className="mb-6 flex items-center justify-center gap-1 rounded-full border border-ink/10 bg-paper p-1">
        <Link
          className="rounded-full px-5 py-2 text-sm font-medium text-muted no-underline transition hover:text-ink"
          href={`${localePrefix}/login`}
        >
          {messages[loc].auth.login.primaryCta}
        </Link>
        <Link
          className="rounded-full px-5 py-2 text-sm font-medium text-muted no-underline transition hover:text-ink"
          href={`${localePrefix}/register`}
        >
          {messages[loc].auth.register.primaryCta}
        </Link>
      </div>

      {/* Locale switcher */}
      <nav aria-label="Language" className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-surface/70 p-1">
          {(["vi", "ja"] as const).map((code) => {
            const isActive = code === loc;
            const href = `/${code}/forgot-password${localeQs ? `?${localeQs}` : ""}`;
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper no-underline"
                    : "rounded-full px-3 py-1 text-xs font-medium text-muted no-underline transition hover:text-ink"
                }
                href={href}
                key={code}
                lang={code}
              >
                {LOCALE_LABELS[code]}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Heading */}
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.title}</h1>
      </div>

      {/* Form card */}
      <div className="rounded-2xl border border-ink/10 bg-surface p-6 shadow-[0_12px_40px_rgba(23,33,31,0.06)]">
        <ForgotPasswordFormClient
          copy={{
            backToLogin: t.backToLogin,
            emailLabel: t.emailLabel,
            emailPlaceholder: t.emailPlaceholder,
            genericError: t.genericError,
            primaryCta: t.primaryCta,
            submitting: t.submitting,
            successMessage: t.successMessage,
            subtitle: t.subtitle,
            validationError: t.validationError,
          }}
          localePrefix={localePrefix}
        />
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-sm text-muted">
        <Link
          className="font-medium text-ink underline-offset-4 hover:underline"
          href={localePrefix}
        >
          {messages[loc].auth.login.backHome}
        </Link>
      </div>
    </AuthHeroLayout>
  );
}
