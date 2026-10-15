"use client";

import { Card } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { careerMe, clockIn, storyArcs, storyChapter } from "../api";
import { timeOfDayBucket } from "../helpers";
import type { CareerRpgLabels } from "../i18n";
import type { MissionArc, MissionChapter, UserCareerState } from "../types";

import { CareerNameOnboarding, needsNameOnboarding } from "./career-name-onboarding";
import { CareerRankCard } from "./career-rank-card";

interface Props {
  labels: CareerRpgLabels;
  locale: string;
}

export function DailyStandupPage({ labels, locale }: Props) {
  const router = useRouter();
  const [career, setCareer] = useState<UserCareerState | null>(null);
  const [arcs, setArcs] = useState<MissionArc[]>([]);
  const [nextChapter, setNextChapter] = useState<MissionChapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [bucket, setBucket] = useState<"morning" | "afternoon" | "evening">("morning");
  const [showNamePicker, setShowNamePicker] = useState(false);

  useEffect(() => {
    setBucket(timeOfDayBucket());
  }, []);

  useEffect(() => {
    let alive = true;
    setCareer(null);
    setArcs([]);
    setNextChapter(null);
    setLoading(true);
    setLoadError(false);
    void Promise.all([careerMe(), storyArcs()])
      .then(async ([careerResponse, arcsResponse]) => {
        if (!alive) return;
        setCareer(careerResponse.state);
        setArcs(arcsResponse);
        if (needsNameOnboarding(careerResponse.state)) {
          setShowNamePicker(true);
        }
        // Find the first active arc with chapters and fetch next chapter detail
        const active = arcsResponse.find((a) => a.status === "active" && a.chapterIds.length > 0);
        const chId = active ? (active.chapterIds[active.completedChapters] ?? active.chapterIds[0]) : null;
        if (chId) {
          try {
            const detail = await storyChapter(chId);
            if (alive) setNextChapter(detail.chapter);
          } catch { /* chapter detail optional */ }
        }
        if (alive) setLoading(false);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        if (error instanceof Error && error.message.includes("401")) {
          setCareer(null);
          setArcs([]);
          setNextChapter(null);
          router.replace(`/${locale}/login?returnTo=${encodeURIComponent(`/${locale}/daily-standup`)}`);
          return;
        }
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [locale, router]);

  const greeting =
    bucket === "morning"
      ? labels.daily.morningGreeting
      : bucket === "afternoon"
        ? labels.daily.afternoonGreeting
        : labels.daily.eveningGreeting;
  const mentorMessage =
    bucket === "morning"
      ? labels.daily.mentorMessageMorning
      : bucket === "afternoon"
        ? labels.daily.mentorMessageAfternoon
        : labels.daily.mentorMessageEvening;

  const activeArc = arcs.find((a) => a.status === "active" && a.chapterIds.length > 0);
  const todayChapterId = activeArc ? (activeArc.chapterIds[activeArc.completedChapters] ?? activeArc.chapterIds[0]) : undefined;
  const todayTitleJa = nextChapter?.titleJa ?? activeArc?.titleJa;
  const todayTitleVi = nextChapter?.titleVi ?? activeArc?.titleVi;

  async function handleClockIn() {
    if (!todayChapterId || isClockingIn) return;
    setIsClockingIn(true);
    try {
      const response = await clockIn();
      setCareer(response.state);
      router.push(`/${locale}/story/chapters/${todayChapterId}`);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("401")) {
        setCareer(null);
        setArcs([]);
        setNextChapter(null);
        router.replace(`/${locale}/login?returnTo=${encodeURIComponent(`/${locale}/daily-standup`)}`);
      }
    } finally {
      setIsClockingIn(false);
    }
  }

  if (!career) {
    return (
      <main aria-busy={loading} className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading ? <p role="status" className="text-sm text-[#4B5563]">{labels.career.loading}</p> : null}
        {!loading && loadError ? (
          <section aria-live="polite" className="rounded-xl border border-[#FECACA] bg-white p-5" role="alert">
            <p className="text-sm text-[#991B1B]">{labels.career.loadError}</p>
            <Link className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-[#1B2A4A] underline" href={`/${locale}/login?returnTo=${encodeURIComponent(`/${locale}/daily-standup`)}`}>
              {labels.career.loginLink}
            </Link>
          </section>
        ) : null}
      </main>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      {showNamePicker ? (
        <CareerNameOnboarding
          labels={labels.onboarding}
          onComplete={(updated) => {
            setShowNamePicker(false);
            if (updated) setCareer(updated);
          }}
        />
      ) : null}
      <header className="flex flex-col gap-1">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#6B7280]">
          {labels.brand.companyJa}
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-[#111827]">
          {greeting.replace("{name}", career.jpWorkName)}
        </h1>
        <p className="text-sm text-[#4B5563]">
          {labels.daily.eyebrow}
          <span className="mx-2 text-[#CBD5E1]">·</span>
          <span className="text-[#111827]">
            {labels.daily.streakLabel
              .replace("{n}", String(career.streakDays))
              .replace("{suffix}", labels.daily.streakSuffix)}
          </span>
        </p>
      </header>

      <section className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1B2A4A] to-[#243560] text-white">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_60%_40%,rgba(255,255,255,0.18),transparent_60%)] sm:block" />
          <div className="relative space-y-5 p-6 sm:p-8">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">
                {labels.daily.todayTasks}
              </p>
              <h2 className="mt-1 text-xl font-semibold leading-snug">
                {labels.daily.todayTasksHint}
              </h2>
            </div>
            <ul className="space-y-2.5 text-sm text-white/90">
              {todayTitleJa && activeArc ? (
                <li className="flex items-start gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">
                    1
                    </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {todayTitleJa}
                    </p>
                    <p className="truncate text-[11px] text-white/70">
                      {activeArc.titleJa} · {todayTitleVi}
                    </p>
                  </div>
                </li>
              ) : null}
              <li className="flex items-start gap-3 rounded-xl bg-white/5 px-4 py-3">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{labels.inbox.title}</p>
                  <p className="text-[11px] text-white/70">{labels.inbox.subtitle}</p>
                </div>
              </li>
            </ul>
            <div className="flex flex-wrap gap-2">
              {todayChapterId ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-[#9F1239] px-5 text-sm font-semibold text-white shadow-lg shadow-[#9F1239]/30 transition-all hover:bg-[#B91C1C] focus-visible:ring-2 focus-visible:ring-white/40"
                  disabled={isClockingIn}
                  onClick={handleClockIn}
                  type="button"
                >
                  {isClockingIn ? labels.daily.clockIn : labels.daily.clockIn}
                </button>
              ) : null}
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                href={`/${locale}/story/arcs`}
              >
                {labels.daily.arcsLink} →
              </Link>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <CareerRankCard compact labels={labels.career} state={career} />
          <MentorCard message={mentorMessage} senpaiLabel="先輩" />
          <Link
            className="block rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-medium text-[#111827] shadow-sm transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
            href={`/${locale}/career`}
          >
            {labels.daily.careerSheetLink} →
          </Link>
          <Link
            className="block rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-medium text-[#111827] shadow-sm transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
            href={`/${locale}/review-inbox-preview`}
          >
            {labels.daily.reviewInboxLink} →
          </Link>
        </div>
      </section>
    </div>
  );
}

function MentorCard({ message, senpaiLabel }: { message: string; senpaiLabel: string }) {
  return (
    <Card className="border-[#A7F3D0]/60 bg-[#ECFDF5]/60 p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#047857]">{senpaiLabel}</p>
      <p className="mt-1 text-sm leading-relaxed text-[#065F46]">「{message}」</p>
    </Card>
  );
}
