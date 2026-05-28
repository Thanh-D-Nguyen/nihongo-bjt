"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetchOptional } from "../../../../../lib/learner-api";
import { OnlineIndicator } from "./online-indicator";
import { ProfileStats } from "./profile-stats";
import { ProfileAchievements } from "./profile-achievements";
import { ProfileActions } from "./profile-actions";

interface PublicProfileData {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  targetBjtBand: string | null;
  learningPurpose: string | null;
  privacyLevel: string;
  memberSince: string;
  online: boolean;
  lastSeenAt: string | null;
  relationship: "self" | "friend" | "stranger" | "blocked" | null;
  stats: {
    currentStreak: number | null;
    longestStreak: number | null;
    totalStudyDays: number | null;
    achievementCount: number | null;
    battleWins: number | null;
    battleTotal: number | null;
    battleWinRate: number | null;
  } | null;
  achievements: Array<{
    id: string;
    slug: string;
    name: string;
    iconUrl: string | null;
    unlockedAt: string;
  }> | null;
}

interface PublicProfileLabels {
  actions: {
    addFriend: string;
    challenge: string;
    friends: string;
    pendingFriend: string;
  };
  achievements: { title: string; viewAll: string };
  challengeSent: string;
  copied: string;
  copyUrl: string;
  editProfile: string;
  errorDesc: string;
  errorTitle: string;
  home: string;
  lastSeen: string;
  loginToChallenge: string;
  memberSince: string;
  metaDescription: string;
  metaTitle: string;
  metaTitleFallback: string;
  notFound: string;
  notFoundDesc: string;
  offline: string;
  online: string;
  privateProfile: string;
  privateProfileDesc: string;
  purpose: string;
  relativeDaysAgo: string;
  relativeHoursAgo: string;
  relativeJustNow: string;
  relativeMinutesAgo: string;
  selfPreview: string;
  share: string;
  stats: {
    achievements: string;
    battles: string;
    days: string;
    longestStreak: string;
    studyDays: string;
    streak: string;
    winRate: string;
    wins: string;
  };
  targetBand: string;
}

interface Props {
  achievementNames: Record<string, string>;
  userId: string;
  labels: PublicProfileLabels;
  locale: string;
}

export function PublicProfileClient({ achievementNames, userId, labels, locale }: Props) {
  const { accessToken } = useKeycloakAuth();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await learnerApiFetchOptional(`/api/users/${userId}/profile`);
      if (res.status === 404) {
        setError("not_found");
        return;
      }
      if (!res.ok) {
        setError("error");
        return;
      }
      const data = await res.json();
      setProfile(data);
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) return <ProfileSkeleton />;
  if (error === "not_found") return <ProfileNotFound labels={labels} locale={locale} />;
  if (error) return <ProfileError labels={labels} />;
  if (!profile) return null;

  const isSelf = profile.relationship === "self";
  const isPrivate = profile.privacyLevel === "private" && profile.relationship !== "friend" && !isSelf;
  const profileUrl = typeof window !== "undefined" ? `${window.location.origin}/${locale}/u/${userId}` : "";

  return (
    <div className="min-h-screen bg-paper pb-24">
      {/* Self-viewing banner */}
      {isSelf && (
        <SelfProfileBanner url={profileUrl} labels={labels} locale={locale} />
      )}

      {/* Cover */}
      <div className="relative h-48 sm:h-56 md:h-64 overflow-hidden rounded-b-3xl">
        {profile.coverUrl ? (
          <img
            src={profile.coverUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent/20 via-accent/10 to-surface" />
        )}
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-paper/80 via-transparent to-transparent" />
      </div>

      {/* Profile Header */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 -mt-16 relative z-10">
        {/* Avatar + Online */}
        <div className="flex items-end gap-4">
          <div className="relative">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-paper shadow-lg overflow-hidden bg-surface">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted bg-surface">
                  {profile.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <OnlineIndicator
              label={profile.online ? labels.online : labels.offline}
              online={profile.online}
              className="absolute bottom-1 right-1 w-5 h-5 border-[3px] border-paper"
            />
          </div>

          {/* Name + Status */}
          <div className="flex-1 pb-2">
            <h1 className="text-xl sm:text-2xl font-bold text-ink leading-tight">
              {profile.displayName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm font-medium ${profile.online ? "text-leaf" : "text-muted"}`}>
                {profile.online ? labels.online : labels.offline}
              </span>
              {!profile.online && profile.lastSeenAt && (
                <span className="text-xs text-muted">
                  · {labels.lastSeen} {formatRelativeTime(profile.lastSeenAt, labels)}
                </span>
              )}
            </div>
          </div>

          {/* Share button */}
          <ShareButton url={`${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/u/${userId}`} labels={labels} />
        </div>

        {/* Meta row: BJT target + Member since */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {profile.targetBjtBand && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {labels.targetBand}: {profile.targetBjtBand}
            </span>
          )}
          <span className="text-sm text-muted">
            {labels.memberSince} {new Date(profile.memberSince).toLocaleDateString()}
          </span>
        </div>

        {/* Learning Purpose */}
        {profile.learningPurpose && (
          <p className="mt-3 text-sm text-muted/80 italic">
            {labels.purpose}: {profile.learningPurpose}
          </p>
        )}

        {/* Private Profile Wall */}
        {isPrivate ? (
          <div className="mt-8 text-center py-12 rounded-2xl bg-surface border border-muted/10">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="text-lg font-semibold text-ink">{labels.privateProfile}</h2>
            <p className="text-sm text-muted mt-1">{labels.privateProfileDesc}</p>
          </div>
        ) : (
          <>
            {/* Actions (Challenge / Add Friend) */}
            <ProfileActions
              profile={profile}
              labels={labels}
              locale={locale}
              isAuthenticated={!!accessToken}
            />

            {/* Stats Grid */}
            {profile.stats && (
              <ProfileStats stats={profile.stats} labels={labels.stats} />
            )}

            {/* Achievements Showcase */}
            {profile.achievements && profile.achievements.length > 0 && (
              <ProfileAchievements
                achievements={profile.achievements.map((achievement) => ({
                  ...achievement,
                  name: achievementNames[achievement.name] ?? achievement.name,
                }))}
                labels={labels.achievements}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-paper animate-pulse">
      <div className="h-48 sm:h-56 bg-surface rounded-b-3xl" />
      <div className="max-w-2xl mx-auto px-4 -mt-16">
        <div className="flex items-end gap-4">
          <div className="w-28 h-28 rounded-full bg-muted/20 border-4 border-paper" />
          <div className="flex-1 pb-2">
            <div className="h-6 w-40 bg-muted/20 rounded-lg" />
            <div className="h-4 w-24 bg-muted/10 rounded-lg mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted/10 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileNotFound({ labels, locale }: { labels: PublicProfileLabels; locale: string }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">👤</div>
        <h1 className="text-xl font-bold text-ink">{labels.notFound}</h1>
        <p className="text-sm text-muted mt-2">{labels.notFoundDesc}</p>
        <a
          href={`/${locale}`}
          className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-accent text-white font-semibold text-sm shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-150"
        >
          {labels.home}
        </a>
      </div>
    </div>
  );
}

function ProfileError({ labels }: { labels: PublicProfileLabels }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-ink">{labels.errorTitle}</h1>
        <p className="text-sm text-muted mt-2">{labels.errorDesc}</p>
      </div>
    </div>
  );
}

function formatRelativeTime(isoString: string, labels: PublicProfileLabels): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return labels.relativeJustNow;
  if (diffMin < 60) return labels.relativeMinutesAgo.replace("{count}", String(diffMin));
  if (diffHr < 24) return labels.relativeHoursAgo.replace("{count}", String(diffHr));
  if (diffDay < 7) return labels.relativeDaysAgo.replace("{count}", String(diffDay));
  return date.toLocaleDateString();
}

function ShareButton({ url, labels }: { url: string; labels: PublicProfileLabels }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShare = async () => {
    // Use Web Share API on mobile if available
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // User cancelled or API failed — fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Final fallback for insecure contexts
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`
        inline-flex items-center justify-center w-10 h-10 rounded-full
        transition-all duration-150 active:scale-90
        focus-visible:ring-2 focus-visible:ring-accent/35
        ${copied
          ? "bg-leaf/10 text-leaf"
          : "bg-surface text-muted hover:bg-accent/10 hover:text-accent shadow-sm hover:shadow-md"
        }
      `}
      aria-label={labels.share}
      title={copied ? labels.copied : labels.share}
    >
      {copied ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      )}
    </button>
  );
}

function SelfProfileBanner({ url, labels, locale }: { url: string; labels: PublicProfileLabels; locale: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="sticky top-0 z-50 bg-accent/5 border-b border-accent/15 backdrop-blur-sm">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="text-sm text-ink/70 truncate">
            {labels.selfPreview}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              transition-all duration-150 active:scale-95
              focus-visible:ring-2 focus-visible:ring-accent/35
              ${copied
                ? "bg-leaf/10 text-leaf border border-leaf/20"
                : "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20"
              }
            `}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {labels.copied}
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                </svg>
                {labels.copyUrl}
              </>
            )}
          </button>
          <a
            href={`/${locale}/me`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface text-muted hover:text-ink border border-muted/15 hover:border-muted/30 transition-all duration-150 active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {labels.editProfile}
          </a>
        </div>
      </div>
    </div>
  );
}
