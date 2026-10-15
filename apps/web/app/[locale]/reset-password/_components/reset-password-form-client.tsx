"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

export type ResetPasswordFormCopy = {
  backToLogin: string;
  confirmPasswordLabel: string;
  genericError: string;
  invalidToken: string;
  languageLabel: string;
  mismatch: string;
  passwordHint: string;
  passwordLabel: string;
  passwordTooLong: string;
  preparing: string;
  primaryCta: string;
  submitting: string;
  successMessage: string;
};

export function ResetPasswordFormClient({
  copy,
  localePrefix,
  token,
}: {
  copy: ResetPasswordFormCopy;
  localePrefix: string;
  token: string | null;
}) {
  const [activeToken, setActiveToken] = useState(token);
  const [ready, setReady] = useState(Boolean(token));
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const tokenGeneration = useRef(0);
  const activeTokenRef = useRef(token);
  const locale = localePrefix.slice(1);
  const languageSwitcher = (
    <nav aria-label={copy.languageLabel} className="mb-5 flex justify-center gap-1">
      {(["vi", "ja", "en"] as const).map((code) => (
        <Link
          aria-current={locale === code ? "page" : undefined}
          className={locale === code ? "rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper no-underline" : "rounded-full px-3 py-1 text-xs font-medium text-muted no-underline hover:text-ink"}
          href={`/${code}/reset-password${activeToken && !complete ? `#token=${encodeURIComponent(activeToken)}` : ""}`}
          key={code}
          lang={code}
        >
          {code === "en" ? "English" : code === "ja" ? "日本語" : "Tiếng Việt"}
        </Link>
      ))}
    </nav>
  );

  useEffect(() => {
    const readTokenFromUrl = (initial = false) => {
      const url = new URL(window.location.href);
      const fragmentToken = new URLSearchParams(url.hash.slice(1)).get("token");
      const queryToken = url.searchParams.get("token");
      const nextToken = fragmentToken || queryToken;
      if (!initial && !nextToken) return;
      const resolvedToken = nextToken || (initial ? token || activeTokenRef.current : null);
      if (resolvedToken !== activeTokenRef.current) {
        activeTokenRef.current = resolvedToken;
        tokenGeneration.current += 1;
        setLoading(false);
      }
      setActiveToken(resolvedToken);
      if (nextToken) {
        setComplete(false);
        setPassword("");
        setConfirmation("");
        setError(null);
        url.hash = "";
        url.searchParams.delete("token");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
      }
      setReady(true);
    };
    readTokenFromUrl(true);
    const onHashChange = () => readTokenFromUrl();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [token]);

  const onSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!activeToken) {
      setError(copy.invalidToken);
      return;
    }
    if (password.length < 8) {
      setError(copy.passwordHint);
      return;
    }
    if (new TextEncoder().encode(password).length > 1024) {
      setError(copy.passwordTooLong);
      return;
    }
    if (password !== confirmation) {
      setError(copy.mismatch);
      return;
    }
    const requestGeneration = tokenGeneration.current;
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        body: JSON.stringify({ password, token: activeToken }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        if (requestGeneration === tokenGeneration.current) {
          setError(result.error === "invalid or expired token" ? copy.invalidToken : copy.genericError);
        }
        return;
      }
      if (requestGeneration === tokenGeneration.current) setComplete(true);
    } catch {
      if (requestGeneration === tokenGeneration.current) setError(copy.genericError);
    } finally {
      if (requestGeneration === tokenGeneration.current) setLoading(false);
    }
  }, [activeToken, confirmation, copy, password]);

  const fieldClass = "w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

  if (!ready) return <>{languageSwitcher}<p className="text-center text-sm text-muted" role="status">{copy.preparing}</p></>;

  if (complete) {
    return (
      <div className="space-y-5 text-center">
        {languageSwitcher}
        <p className="text-sm leading-relaxed text-ink" role="status">{copy.successMessage}</p>
        <Link className="inline-block rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-paper no-underline" href={`${localePrefix}/login`}>
          {copy.backToLogin}
        </Link>
      </div>
    );
  }

  if (!activeToken) {
    return (
      <div className="space-y-5 text-center">
        {languageSwitcher}
        <p className="text-sm leading-relaxed text-red-800" role="alert">{copy.invalidToken}</p>
        <Link className="font-semibold text-ink underline-offset-4 hover:underline" href={`${localePrefix}/login`}>
          {copy.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <>
    {languageSwitcher}
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="new-password">{copy.passwordLabel}</label>
        <input autoComplete="new-password" className={fieldClass} id="new-password" minLength={8} onChange={event => setPassword(event.target.value)} required type="password" value={password} />
        <p className="mt-1.5 text-xs text-muted">{copy.passwordHint}</p>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="confirm-password">{copy.confirmPasswordLabel}</label>
        <input autoComplete="new-password" className={fieldClass} id="confirm-password" onChange={event => setConfirmation(event.target.value)} required type="password" value={confirmation} />
      </div>
      {error ? <p className="rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-800" role="alert">{error}</p> : null}
      <button aria-busy={loading} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-leaf px-4 py-3 text-sm font-semibold text-white transition hover:bg-leaf/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} type="submit">
        {loading ? copy.submitting : copy.primaryCta}
      </button>
    </form>
    </>
  );
}
