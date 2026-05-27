"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  ProgressBar,
} from "@nihongo-bjt/ui";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { useProfileImageUpload } from "../../profile/_components/use-profile-image-upload";
import { MeTabProgress } from "./me-tab-progress";
import { MeTabAchievements } from "./me-tab-achievements";
import { MeTabSettings } from "./me-tab-settings";

/* ─── Types ─── */

type Tab = "overview" | "progress" | "achievements" | "settings";

interface LearnerProfile {
  avatarAssetId: string | null;
  coverAssetId: string | null;
  displayName: string | null;
  email: string | null;
  id: string;
  status: string;
  targetBjtBand?: string | null;
}

interface QuickStats {
  streakDays: number;
  reviewCount: number;
  bjtAccuracyPct: number;
  dueFlashcards: number;
}

interface MePageLabels {
  metaTitle: string;
  title: string;
  eyebrow: string;
  tabs: {
    overview: string;
    progress: string;
    achievements: string;
    settings: string;
  };
  hero: {
    changeCover: string;
    removeCover: string;
    changeAvatar: string;
    removeAvatar: string;
    uploading: string;
    uploadError: string;
    memberSince: string;
    editProfile: string;
  };
  stats: {
    streak: string;
    reviews: string;
    accuracy: string;
    level: string;
    dueCards: string;
    days: string;
  };
  overview: {
    profileCompletion: string;
    completionHint: string;
    todaySnapshot: string;
    dueReviews: string;
    streakActive: string;
    noStreakYet: string;
    recentAchievements: string;
    noRecentAchievements: string;
    quickActions: string;
    reviewCards: string;
    practiceQuiz: string;
    viewProgress: string;
  };
  settingsTab: Record<string, string>;
}

/* ─── Helpers ─── */

function initialsFor(name: string | null | undefined) {
  const clean = name?.trim();
  if (!clean) return "NB";
  return clean.slice(0, 2).toUpperCase();
}

function completionPct(profile: LearnerProfile | null) {
  if (!profile) return 0;
  const fields = [profile.displayName, profile.email, profile.targetBjtBand];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

/* ─── Main Component ─── */

export function MePageClient({
  labels,
  analyticsLabels,
  gamificationLabels,
  settingsLabels,
  locale,
}: {
  labels: MePageLabels;
  analyticsLabels: unknown;
  gamificationLabels: unknown;
  settingsLabels: unknown;
  locale: string;
}) {
  const auth = useKeycloakAuth();
  const uploader = useProfileImageUpload();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const searchParams = useSearchParams();

  const initialTab = (searchParams.get("tab") ?? "overview") as Tab;
  const [tab, setTab] = useState<Tab>(
    ["overview", "progress", "achievements", "settings"].includes(initialTab) ? initialTab : "overview"
  );
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  /* ── Load profile + quick stats ── */
  const loadData = useCallback(async () => {
    if (!auth.accessToken) {
      setLoading(auth.loading);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const [profileRes, statsRes] = await Promise.all([
        learnerApiFetch("/api/auth/me"),
        learnerApiFetch("/api/learner/analytics?days=7"),
      ]);
      if (profileRes.ok) {
        const body = await profileRes.json();
        setProfile(body.profile);
      }
      if (statsRes.ok) {
        const body = await statsRes.json();
        const totals = body?.totals ?? {};
        setStats({
          streakDays: totals.streakDays ?? 0,
          reviewCount: totals.reviewCount ?? 0,
          bjtAccuracyPct: totals.bjtAccuracyPct ?? 0,
          dueFlashcards: body.dueFlashcards ?? 0,
        });
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, auth.loading]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* ── Load asset URLs ── */
  useEffect(() => {
    let cancelled = false;
    async function loadAssetUrl(assetId: string | null, setter: (url: string | null) => void) {
      if (!assetId || !auth.accessToken) { setter(null); return; }
      try {
        const res = await learnerApiFetch(`/api/media/assets/${assetId}/read-url`);
        if (res.ok) {
          const body = await res.json();
          if (!cancelled) setter(body.readUrl);
        }
      } catch { if (!cancelled) setter(null); }
    }
    void loadAssetUrl(profile?.avatarAssetId ?? null, setAvatarUrl);
    void loadAssetUrl(profile?.coverAssetId ?? null, setCoverUrl);
    return () => { cancelled = true; };
  }, [auth.accessToken, profile?.avatarAssetId, profile?.coverAssetId]);

  /* ── Image upload ── */
  const updateProfileImage = useCallback(
    async (field: "avatarAssetId" | "coverAssetId", assetId: string | null) => {
      setSaving(true);
      try {
        const res = await learnerApiFetch("/api/auth/profile", {
          body: JSON.stringify({ [field]: assetId }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        });
        if (res.ok) {
          const body = await res.json();
          setProfile(body.profile);
          await auth.reload();
        }
      } catch { setError(true); }
      finally { setSaving(false); }
    },
    [auth]
  );

  const handleFile = useCallback(
    async (field: "avatarAssetId" | "coverAssetId", event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const assetId = await uploader.upload(file);
      if (assetId) await updateProfileImage(field, assetId);
    },
    [updateProfileImage, uploader]
  );

  const uploading = uploader.uploading || saving;
  const displayName = profile?.displayName ?? auth.displayName ?? "Learner";
  const isBusy = loading || auth.loading;

  /* ── Loading state ── */
  if (isBusy) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6">
        <div className="h-48 animate-pulse rounded-2xl bg-ink/5" />
        <div className="h-12 animate-pulse rounded-xl bg-ink/5" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-ink/5" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-0 px-4 pb-12">
      {/* ═══ HERO SECTION ═══ */}
      <section className="overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm">
        {/* Cover */}
        <div
          className="relative min-h-36 sm:min-h-44 bg-[linear-gradient(135deg,#0f766e_0%,#1d4ed8_55%,#6366f1_100%)]"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
        >
          <div className="absolute inset-0 bg-ink/20" />
          <div className="absolute right-3 top-3 flex gap-2">
            <input ref={coverInputRef} accept="image/*" className="hidden" type="file"
              onChange={(e) => void handleFile("coverAssetId", e)} />
            <button
              className="rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium text-ink/80 backdrop-blur-sm transition hover:bg-white"
              disabled={uploading}
              onClick={() => coverInputRef.current?.click()}
            >
              {uploading ? labels.hero.uploading : labels.hero.changeCover}
            </button>
            {profile?.coverAssetId && (
              <button
                className="rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-ink/60 backdrop-blur-sm transition hover:bg-white/80"
                disabled={uploading}
                onClick={() => void updateProfileImage("coverAssetId", null)}
              >
                {labels.hero.removeCover}
              </button>
            )}
          </div>
        </div>

        {/* Avatar + Info */}
        <div className="-mt-10 flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-end sm:gap-4 sm:px-6 sm:pb-5">
          <div className="relative">
            <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border-[3px] border-white bg-brand-navy text-xl font-bold text-white shadow-lg sm:h-24 sm:w-24 sm:text-2xl">
              {avatarUrl ? <img alt="" className="h-full w-full object-cover" src={avatarUrl} /> : initialsFor(displayName)}
            </div>
            <input ref={avatarInputRef} accept="image/*" className="hidden" type="file"
              onChange={(e) => void handleFile("avatarAssetId", e)} />
            <button
              className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-white shadow-md ring-1 ring-ink/10 transition hover:scale-110"
              disabled={uploading}
              onClick={() => avatarInputRef.current?.click()}
              title={labels.hero.changeAvatar}
            >
              <svg className="h-3.5 w-3.5 text-ink/70" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" />
              </svg>
            </button>
          </div>

          <div className="min-w-0 flex-1 pb-0.5">
            <h1 className="truncate text-xl font-bold text-ink sm:text-2xl">{displayName}</h1>
            <p className="truncate text-sm text-muted">{profile?.email ?? auth.email ?? ""}</p>
          </div>
        </div>
      </section>

      {/* ═══ QUICK STATS BAR ═══ */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label={labels.stats.streak} value={stats?.streakDays ?? 0} suffix={labels.stats.days} accent="emerald" />
        <StatPill label={labels.stats.reviews} value={stats?.reviewCount ?? 0} accent="blue" />
        <StatPill label={labels.stats.accuracy} value={`${stats?.bjtAccuracyPct ?? 0}%`} accent="violet" />
        <StatPill label={labels.stats.dueCards} value={stats?.dueFlashcards ?? 0} accent="amber" />
      </section>

      {/* ═══ TAB BAR (Sticky) ═══ */}
      <nav className="sticky top-0 z-20 -mx-4 mt-5 border-b border-ink/8 bg-white/90 px-4 backdrop-blur-md" role="tablist">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {(["overview", "progress", "achievements", "settings"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`relative shrink-0 px-4 py-3 text-sm font-semibold transition-colors ${
                tab === t
                  ? "text-accent"
                  : "text-muted hover:text-ink"
              }`}
            >
              {labels.tabs[t]}
              {tab === t && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ═══ TAB CONTENT ═══ */}
      <div className="mt-5">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {labels.hero.uploadError}
          </div>
        )}

        {tab === "overview" && (
          <OverviewTab labels={labels} profile={profile} stats={stats} locale={locale} />
        )}
        {tab === "progress" && (
          <MeTabProgress labels={analyticsLabels} locale={locale} />
        )}
        {tab === "achievements" && (
          <MeTabAchievements labels={gamificationLabels} locale={locale} />
        )}
        {tab === "settings" && (
          <MeTabSettings labels={labels.settingsTab} settingsLabels={settingsLabels} locale={locale} />
        )}
      </div>
    </main>
  );
}

/* ═══ OVERVIEW TAB ═══ */

function OverviewTab({
  labels,
  profile,
  stats,
  locale,
}: {
  labels: MePageLabels;
  profile: LearnerProfile | null;
  stats: QuickStats | null;
  locale: string;
}) {
  const completion = completionPct(profile);
  const o = labels.overview;

  return (
    <div className="space-y-5">
      {/* Profile completion */}
      {completion < 100 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{o.profileCompletion}</p>
              <span className="text-xs font-bold tabular-nums text-accent">{completion}%</span>
            </div>
            <ProgressBar value={completion} />
            <p className="text-xs text-muted">{o.completionHint}</p>
          </CardContent>
        </Card>
      )}

      {/* Today snapshot — bento style */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-lg">
              🔥
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                {(stats?.streakDays ?? 0) > 0
                  ? o.streakActive.replace("{n}", String(stats?.streakDays ?? 0))
                  : o.noStreakYet}
              </p>
              <p className="text-xs text-muted">{o.todaySnapshot}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-lg">
              📚
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                {o.dueReviews.replace("{n}", String(stats?.dueFlashcards ?? 0))}
              </p>
              <p className="text-xs text-muted">{o.todaySnapshot}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted">{o.quickActions}</h3>
        <div className="grid grid-cols-3 gap-3">
          <QuickActionCard
            href={`/${locale}/flashcards`}
            icon="📖"
            label={o.reviewCards}
          />
          <QuickActionCard
            href={`/${locale}/quiz`}
            icon="🎯"
            label={o.practiceQuiz}
          />
          <QuickActionCard
            href="#"
            icon="📊"
            label={o.viewProgress}
            onClick={() => {/* handled by parent tab switch */}}
          />
        </div>
      </section>

      {/* Recent achievements placeholder */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{o.recentAchievements}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">{o.noRecentAchievements}</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══ STAT PILL ═══ */

function StatPill({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  accent: "emerald" | "blue" | "violet" | "amber";
}) {
  const bgMap = {
    emerald: "bg-emerald-50 border-emerald-100",
    blue: "bg-blue-50 border-blue-100",
    violet: "bg-violet-50 border-violet-100",
    amber: "bg-amber-50 border-amber-100",
  };
  const textMap = {
    emerald: "text-emerald-700",
    blue: "text-blue-700",
    violet: "text-violet-700",
    amber: "text-amber-700",
  };

  return (
    <div className={`rounded-xl border p-3 ${bgMap[accent]} transition-transform hover:scale-[1.02]`}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums ${textMap[accent]}`}>
        {value}
        {suffix && <span className="ml-1 text-xs font-medium text-muted">{suffix}</span>}
      </p>
    </div>
  );
}

/* ═══ QUICK ACTION CARD ═══ */

function QuickActionCard({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: string;
  label: string;
  onClick?: () => void;
}) {
  const content = (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-ink/8 bg-surface p-3 text-center transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md active:scale-95">
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-semibold text-ink">{label}</span>
    </div>
  );

  if (onClick) {
    return <button onClick={onClick} className="text-left">{content}</button>;
  }
  return <Link href={href}>{content}</Link>;
}
