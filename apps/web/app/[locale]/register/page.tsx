"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useGoAuth } from "../../../lib/go-auth-provider";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

export default function RegisterPage() {
  const params = useParams<{ locale: string }>();
  const router = useRouter();
  const locale = params.locale ?? "en";
  const messages = locale === "vi" ? vi : locale === "ja" ? ja : en;
  const t = messages.auth.register;
  const { reload } = useGoAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.passwordsMismatch);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim()
        })
      });

      if (!res.ok) {
        setError(res.status === 409 ? t.userExists : t.registrationFailed);
        return;
      }

      // Auto-login after successful registration.
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });

      if (loginRes.ok) {
        await reload();
        router.replace(`/${locale}`);
      } else {
        // Registration succeeded but auto-login failed; redirect to login page.
        router.replace(`/${locale}/login`);
      }
    } catch {
      setError(t.registrationFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-ink">{t.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {t.subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="displayName" className="block text-sm font-medium text-ink">
              {messages.accountInfo.displayName}
            </label>
            <input
              id="displayName"
              type="text"
              required
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              placeholder={messages.accountInfo.displayName}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-ink">
              {t.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              placeholder={t.emailPlaceholder}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-ink">
              {t.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              placeholder={t.passwordPlaceholder}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink">
              {t.confirmPasswordLabel}
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              placeholder={t.confirmPasswordPlaceholder}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-sakura to-sakura/80 px-4 py-3 text-sm font-semibold text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed min-h-[48px]"
          >
            {submitting ? t.submitting : t.primaryCta}
          </button>
        </form>

        <div className="text-center text-sm">
          <span className="text-muted">{t.loginLead} </span>
          <Link
            href={`/${locale}/login`}
            className="text-accent hover:text-accent/80 font-medium transition-colors"
          >
            {t.loginCta}
          </Link>
        </div>
      </div>
    </div>
  );
}
