"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useState } from "react";

export type ForgotPasswordFormCopy = {
  backToLogin: string;
  emailLabel: string;
  emailPlaceholder: string;
  genericError: string;
  primaryCta: string;
  submitting: string;
  successMessage: string;
  subtitle: string;
  validationError: string;
};

export function ForgotPasswordFormClient({
  copy,
  localePrefix,
}: {
  copy: ForgotPasswordFormCopy;
  localePrefix: string;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/keycloak/forgot-password", {
        body: JSON.stringify({ email }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "validation") {
          setError(copy.validationError);
        } else {
          setError(copy.genericError);
        }
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  }, [copy, email]);

  const fieldClass =
    "w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/20";

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        {/* Success checkmark */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf/10">
          <svg className="h-8 w-8 text-leaf" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm leading-relaxed text-ink">{copy.successMessage}</p>
        <Link
          className="inline-block rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-paper no-underline transition hover:bg-ink/90"
          href={`${localePrefix}/login`}
        >
          {copy.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-center text-sm leading-relaxed text-muted">{copy.subtitle}</p>

      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="forgot-email">
            {copy.emailLabel}
          </label>
          <input
            autoComplete="email"
            autoFocus
            className={fieldClass}
            id="forgot-email"
            name="email"
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder={copy.emailPlaceholder}
            required
            type="email"
            value={email}
          />
        </div>

        {error ? (
          <p
            className="rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          aria-busy={loading}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-leaf px-4 py-3 text-sm font-semibold text-white transition hover:bg-leaf/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? copy.submitting : copy.primaryCta}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        <Link
          className="font-semibold text-ink underline-offset-4 hover:underline"
          href={`${localePrefix}/login`}
        >
          {copy.backToLogin}
        </Link>
      </p>
    </div>
  );
}
