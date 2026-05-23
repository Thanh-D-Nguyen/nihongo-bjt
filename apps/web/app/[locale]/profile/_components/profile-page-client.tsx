"use client";

import { Button, Card, CardContent, CardHeader, CardTitle, ProgressBar } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { useProfileImageUpload } from "./use-profile-image-upload";

type ProfilePageLabels = {
  accuracyLabel: string;
  achievementsLabel: string;
  activityTitle: string;
  changeAvatar: string;
  changeCover: string;
  completionHint: string;
  dueCards: string;
  editSettings: string;
  eyebrow: string;
  levelLabel: string;
  memberSince: string;
  metaTitle: string;
  noActivity: string;
  noBadges: string;
  profileCompletion: string;
  removeAvatar: string;
  removeCover: string;
  reviewsLabel: string;
  shareProfile: string;
  signedIn: string;
  signedOut: string;
  streakLabel: string;
  subtitle: string;
  title: string;
  topBadges: string;
  uploadError: string;
  uploadingImage: string;
  viewAllAchievements: string;
};

type LearnerProfile = {
  avatarAssetId: string | null;
  coverAssetId: string | null;
  displayName: string | null;
  email: string | null;
  id: string;
  status: string;
  targetBjtBand?: string | null;
};

type ProfileResponse = {
  profile: LearnerProfile;
};

type AssetReadUrlResponse = {
  readUrl: string;
};

function completionFor(profile: LearnerProfile | null) {
  if (!profile) return 0;
  const fields = [profile.displayName, profile.email, profile.targetBjtBand];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function initialsFor(name: string | null | undefined) {
  const clean = name?.trim();
  if (!clean) return "NB";
  return clean.slice(0, 2).toUpperCase();
}

export function ProfilePageClient({
  labels,
  locale,
}: {
  labels: ProfilePageLabels;
  gamificationLabels: unknown;
  locale: string;
}) {
  const auth = useKeycloakAuth();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const uploader = useProfileImageUpload();
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!auth.accessToken) {
      setLoading(auth.loading);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const response = await learnerApiFetch("/api/auth/me");
      if (!response.ok) {
        throw new Error("profile_load_failed");
      }
      const body = (await response.json()) as ProfileResponse;
      setProfile(body.profile);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, auth.loading]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    let cancelled = false;

    async function loadAssetUrl(assetId: string | null, setter: (url: string | null) => void) {
      if (!assetId || !auth.accessToken) {
        setter(null);
        return;
      }
      try {
        const response = await learnerApiFetch(`/api/media/assets/${assetId}/read-url`);
        if (!response.ok) return;
        const body = (await response.json()) as AssetReadUrlResponse;
        if (!cancelled) setter(body.readUrl);
      } catch {
        if (!cancelled) setter(null);
      }
    }

    void loadAssetUrl(profile?.avatarAssetId ?? null, setAvatarUrl);
    void loadAssetUrl(profile?.coverAssetId ?? null, setCoverUrl);

    return () => {
      cancelled = true;
    };
  }, [auth.accessToken, profile?.avatarAssetId, profile?.coverAssetId]);

  const updateProfileImage = useCallback(
    async (field: "avatarAssetId" | "coverAssetId", assetId: string | null) => {
      setSaving(true);
      setError(false);
      try {
        const response = await learnerApiFetch("/api/auth/profile", {
          body: JSON.stringify({ [field]: assetId }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        });
        if (!response.ok) {
          throw new Error("profile_update_failed");
        }
        const body = (await response.json()) as ProfileResponse;
        setProfile(body.profile);
        await auth.reload();
      } catch {
        setError(true);
      } finally {
        setSaving(false);
      }
    },
    [auth]
  );

  const handleFile = useCallback(
    async (field: "avatarAssetId" | "coverAssetId", event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const assetId = await uploader.upload(file);
      if (assetId) {
        await updateProfileImage(field, assetId);
      }
    },
    [updateProfileImage, uploader]
  );

  const completion = completionFor(profile);
  const displayName = profile?.displayName ?? auth.displayName ?? labels.eyebrow;
  const isBusy = loading || auth.loading;
  const uploading = uploader.uploading || saving;

  if (isBusy) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-8">
        <div className="h-56 animate-pulse rounded-2xl bg-ink/5" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-2xl bg-ink/5" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8">
      <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
        <div
          className="relative min-h-44 bg-[linear-gradient(135deg,#0f766e,#1d4ed8_55%,#f59e0b)]"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
        >
          <div className="absolute inset-0 bg-ink/25" />
          <div className="absolute right-4 top-4 flex gap-2">
            <input
              ref={coverInputRef}
              accept="image/gif,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => void handleFile("coverAssetId", event)}
              type="file"
            />
            <Button
              disabled={uploading}
              onClick={() => coverInputRef.current?.click()}
              size="sm"
              type="button"
              variant="secondary"
            >
              {uploading ? labels.uploadingImage : labels.changeCover}
            </Button>
            {profile?.coverAssetId ? (
              <Button disabled={uploading} onClick={() => void updateProfileImage("coverAssetId", null)} size="sm" type="button" variant="ghost">
                {labels.removeCover}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="-mt-12 flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="relative flex items-end gap-4">
            <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-[#1B2A4A] text-2xl font-bold text-white shadow-sm">
              {avatarUrl ? <img alt="" className="h-full w-full object-cover" src={avatarUrl} /> : initialsFor(displayName)}
            </div>
            <div className="pb-1">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">{labels.eyebrow}</p>
              <h1 className="text-2xl font-bold text-ink">{displayName}</h1>
              <p className="text-sm text-muted">{profile?.email ?? auth.email ?? labels.signedOut}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={avatarInputRef}
              accept="image/gif,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => void handleFile("avatarAssetId", event)}
              type="file"
            />
            <Button disabled={uploading} onClick={() => avatarInputRef.current?.click()} type="button" variant="secondary">
              {uploading ? labels.uploadingImage : labels.changeAvatar}
            </Button>
            {profile?.avatarAssetId ? (
              <Button disabled={uploading} onClick={() => void updateProfileImage("avatarAssetId", null)} type="button" variant="ghost">
                {labels.removeAvatar}
              </Button>
            ) : null}
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-[10px] bg-[#1B2A4A] px-4 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#243560]"
              href={`/${locale}/settings`}
            >
              {labels.editSettings}
            </Link>
          </div>
        </div>
      </section>

      {error || uploader.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {labels.uploadError}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label={labels.levelLabel} value={profile?.targetBjtBand ?? "-"} />
        <MetricCard label={labels.streakLabel} value="-" />
        <MetricCard label={labels.reviewsLabel} value="-" />
        <MetricCard label={labels.accuracyLabel} value="-" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{labels.profileCompletion}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProgressBar value={completion} />
            <p className="text-sm text-muted">{labels.completionHint}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{labels.topBadges}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">{labels.noBadges}</p>
            <Link className="text-sm font-semibold text-[#1D4ED8] hover:underline" href={`/${locale}/achievements`}>
              {labels.viewAllAchievements}
            </Link>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{labels.activityTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">{labels.noActivity}</p>
        </CardContent>
      </Card>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">{label}</p>
        <p className="text-2xl font-bold text-ink">{value}</p>
      </CardContent>
    </Card>
  );
}
