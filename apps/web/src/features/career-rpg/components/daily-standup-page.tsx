"use client";

import { Card } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { careerMe, clockIn, storyArcs } from "../api";
import { findChapter, findArc, mockMissionArcs } from "../mock-data";
import { timeOfDayBucket } from "../helpers";
import { useCareerRpg } from "../store";
import type { CareerRpgLabels } from "../i18n";
import type { MissionArc, UserCareerState } from "../types";

import { CareerRankCard } from "./career-rank-card";

interface Props {
  labels: CareerRpgLabels;
  locale: string;
}

export function DailyStandupPage({ labels, locale }: Props) {
  const { career: fallbackCareer, reset } = useCareerRpg();
  const router = useRouter();
  const [career, setCareer] = useState<UserCareerState>(fallbackCareer);
  const [arcs, setArcs] = useState<MissionArc[]>(mockMissionArcs);
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [bucket, setBucket] = useState<"morning" | "afternoon" | "evening">("morning");

  useEffect(() => {
    setBucket(timeOfDayBucket());
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.all([careerMe(), storyArcs()])
      .then(([careerResponse, arcsResponse]) => {
        if (!alive) return;
        setCareer(careerResponse.state);
        setArcs(arcsResponse);
      })
      .catch(() => {
        if (!alive) return;
        setCareer(fallbackCareer);
        setArcs(mockMissionArcs);
      });
    return () => {
      alive = false;
    };
  }, [fallbackCareer]);

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

  const activeArc = arcs.find((a) => a.status === "active");
  const todayChapterId = activeArc?.chapterIds[activeArc.completedChapters] ?? activeArc?.chapterIds[0];
  const todayChapter = todayChapterId ? findChapter(todayChapterId) : undefined;
  const todayArc = todayChapter ? findArc(todayChapter.arcSlug) : activeArc;
  const todayTitleJa = todayChapter?.titleJa ?? activeArc?.titleJa;
  const todayTitleVi = todayChapter?.titleVi ?? activeArc?.titleVi;

  async function handleClockIn() {
    if (!todayChapterId || isClockingIn) return;
    setIsClockingIn(true);
    try {
      const response = await clockIn();
      setCareer(response.state);
    } catch {
      // Keep dev fallback usable if the API is unavailable.
    } finally {
      setIsClockingIn(false);
      router.push(`/${locale}/story/chapters/${todayChapterId}`);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
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
              {todayTitleJa && todayArc ? (
                <li className="flex items-start gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">
                    1
                    </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {todayTitleJa}
                    </p>
                    <p className="truncate text-[11px] text-white/70">
                      {todayArc.titleJa} · {todayTitleVi}
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

      <PrototypeFooter onReset={reset} />
    </div>
  );
}

function PrototypeFooter({ onReset }: { onReset: () => void }) {
  return (
    <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-[#E2E8F0] pt-4 text-[11px] text-[#9CA3AF]">
      <span className="uppercase tracking-[0.18em]">Career RPG · visual prototype</span>
      <button
        className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] font-medium text-[#4B5563] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
        onClick={() => {
          if (typeof window === "undefined") return;
          const ok = window.confirm(
            "Reset prototype state? This clears local rank XP, NPC trust and inbox."
          );
          if (ok) onReset();
        }}
        type="button"
      >
        Reset prototype state
      </button>
    </footer>
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
