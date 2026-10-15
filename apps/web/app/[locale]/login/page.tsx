"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useGoAuth } from "../../../lib/go-auth-provider";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

export function getSafeLoginReturnTo(value: string | null, locale: string, origin: string): string {
 const safeLocale = locale === "vi" || locale === "ja" || locale === "en" ? locale : "en";
 const fallback = `/${safeLocale}`;
 if (!value) return fallback;
 try {
 const target = new URL(value, origin);
 if (target.origin !== origin || (target.pathname !== fallback && !target.pathname.startsWith(`${fallback}/`))) return fallback;
 return `${target.pathname}${target.search}${target.hash}`;
 } catch {
 return fallback;
 }
}

export default function LoginPage() {
 const params = useParams<{ locale: string }>();
 const router = useRouter();
 const searchParams = useSearchParams();
 const locale = params.locale ?? "en";
 const messages = locale === "vi" ? vi : locale === "ja" ? ja : en;
 const t = messages.auth.login;
 const { reload } = useGoAuth();
 const requestedReturnTo = searchParams.get("returnTo");

 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [error, setError] = useState<string | null>(null);
 const [submitting, setSubmitting] = useState(false);

 async function handleSubmit(e: FormEvent) {
 e.preventDefault();
 setError(null);
 setSubmitting(true);

 try {
 const res = await fetch("/api/auth/login", {
 method: "POST",
 credentials: "same-origin",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ email: email.trim(), password })
 });

 if (!res.ok) {
 setError(res.status === 401 ? t.wrongCredentials : t.errorLoginFailed);
 return;
 }

 await reload();
 router.replace(getSafeLoginReturnTo(requestedReturnTo, locale, window.location.origin));
 } catch {
 setError(t.errorLoginFailed);
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
 <label htmlFor="email" className="block text-sm font-medium text-ink">
 {messages.auth.register.emailLabel}
 </label>
 <input
 id="email"
 type="email"
 required
 autoComplete="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
 placeholder={messages.auth.register.emailPlaceholder}
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
 autoComplete="current-password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
 placeholder={t.passwordPlaceholder}
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

 <div className="flex items-center justify-between text-sm">
 <Link
 href={`/${locale}/forgot-password`}
 className="text-accent hover:text-accent/80 font-medium transition-colors"
 >
 {t.forgotPassword}
 </Link>
 <Link
 href={`/${locale}/register`}
 className="text-accent hover:text-accent/80 font-medium transition-colors"
 >
 {t.registerCta}
 </Link>
 </div>
 </div>
 </div>
 );
}
