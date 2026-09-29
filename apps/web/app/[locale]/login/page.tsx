"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function LoginPage() {
 const params = useParams<{ locale: string }>();
 const router = useRouter();
 const searchParams = useSearchParams();
 const locale = params.locale ?? "en";
 const returnTo = searchParams.get("returnTo") || `/${locale}`;

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
 const body = await res.json().catch(() => ({}));
 const msg =
 (body as { error?: string }).error ??
 (res.status === 401 ? "Invalid email or password" : "Login failed");
 setError(msg);
 return;
 }

 router.replace(returnTo);
 } catch {
 setError("Network error. Please try again.");
 } finally {
 setSubmitting(false);
 }
 }

 return (
 <div className="min-h-screen flex items-center justify-center px-4">
 <div className="w-full max-w-md space-y-8">
 <div className="text-center">
 <h1 className="text-3xl font-bold text-ink">Sign in to KotobaWorks</h1>
 <p className="mt-2 text-sm text-muted">
 Welcome back! Enter your credentials to continue learning.
 </p>
 </div>

 <form onSubmit={handleSubmit} className="space-y-5">
 {error && (
 <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
 {error}
 </div>
 )}

 <div className="space-y-1.5">
 <label htmlFor="email" className="block text-sm font-medium text-ink">
 Email
 </label>
 <input
 id="email"
 type="email"
 required
 autoComplete="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
 placeholder="you@example.com"
 />
 </div>

 <div className="space-y-1.5">
 <label htmlFor="password" className="block text-sm font-medium text-ink">
 Password
 </label>
 <input
 id="password"
 type="password"
 required
 autoComplete="current-password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
 placeholder="Enter your password"
 />
 </div>

 <button
 type="submit"
 disabled={submitting}
 className="w-full rounded-xl bg-gradient-to-r from-sakura to-sakura/80 px-4 py-3 text-sm font-semibold text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed min-h-[48px]"
 >
 {submitting ? "Signing in…" : "Sign in"}
 </button>
 </form>

 <div className="flex items-center justify-between text-sm">
 <Link
 href={`/${locale}/forgot-password`}
 className="text-accent hover:text-accent/80 font-medium transition-colors"
 >
 Forgot password?
 </Link>
 <Link
 href={`/${locale}/register`}
 className="text-accent hover:text-accent/80 font-medium transition-colors"
 >
 Create an account
 </Link>
 </div>
 </div>
 </div>
 );
}