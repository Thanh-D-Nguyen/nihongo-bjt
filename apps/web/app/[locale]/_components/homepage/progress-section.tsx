"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  LoadingSkeleton,
  SectionHeader,
} from "@nihongo-bjt/ui";
import { useEffect, useRef, useState } from "react";
import { DarumaMascot, getDarumaState } from "./illustrations/daruma";
import { ToriiGate } from "./illustrations/signin-gate";
import type { HomepageLabels, LearnerAnalytics } from "./types";

/** Count-up from 0 → target over 400ms ease-out, on first render. */
function useCountUp(target: number, durationMs = 400): number {
  const [value, setValue] = useState(0);
  const rendered = useRef(false);

  useEffect(() => {
    if (rendered.current || target <= 0) {
      setValue(target);
      return;
    }
    rendered.current = true;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(ease * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

/** Circular progress ring SVG */
function ProgressRing({
  value,
  max,
  color,
  size = 72,
  strokeWidth = 5,
  children,
}: {
  value: number;
  max: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  children: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/** Stat card with ring */
function RingStat({
  label,
  displayValue,
  numericValue,
  maxValue,
  ringColor,
  icon,
}: {
  label: string;
  displayValue: string;
  numericValue: number;
  maxValue: number;
  ringColor: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <ProgressRing value={numericValue} max={maxValue} color={ringColor}>
        <span className="text-slate-400">{icon}</span>
      </ProgressRing>
      <p className="text-xl font-black tabular-nums tracking-tight text-slate-800">{displayValue}</p>
      <p className="text-center text-[11px] font-medium leading-tight text-slate-500">{label}</p>
    </div>
  );
}

/* Inline icon components */
function FlameIcon() {
  return (
    <svg aria-hidden className="h-5 w-5" fill="none" viewBox="0 0 20 20">
      <path d="M10 2C10 2 6 7 6 11c0 2.2 1.8 4 4 4s4-1.8 4-4c0-4-4-9-4-9Z" fill="currentColor" opacity="0.9" />
      <path d="M10 9c0 0-2 2-2 4 0 1.1.9 2 2 2s2-.9 2-2c0-2-2-4-2-4Z" fill="white" opacity="0.4" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 20 20">
      <path d="M3 4h5a2 2 0 012 2v10a1 1 0 01-1-1H3V4ZM17 4h-5a2 2 0 00-2 2v10a1 1 0 011-1h6V4Z" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" />
      <circle cx="10" cy="10" r="4" />
      <circle cx="10" cy="10" fill="currentColor" r="1.5" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 20 20">
      <rect height="13" rx="2" width="14" x="3" y="5" />
      <path d="M7 3v4M13 3v4M3 10h14" />
    </svg>
  );
}
export function ProgressSection({
  analytics,
  analyticsLoading,
  labels,
  locale,
  isLoggedIn
}: {
  analytics: LearnerAnalytics | null;
  analyticsLoading?: boolean;
  labels: HomepageLabels;
  locale: string;
  isLoggedIn: boolean;
}) {
  const totals = analytics?.totals;
  const streakDays = totals?.streakDays ?? 0;
  const allReviewsDone = (totals?.reviewCount ?? 0) > 0 && streakDays >= 7;
  const darumaState = getDarumaState(streakDays, allReviewsDone);

  const animStreak = useCountUp(totals?.streakDays ?? 0);
  const animReviews = useCountUp(totals?.reviewCount ?? 0);
  const animAccuracy = useCountUp(totals?.bjtAccuracyPct ?? 0);
  const animSessions = useCountUp(totals?.completedBjtSessions ?? 0);

  if (!isLoggedIn) {
    return (
      <section>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[#1B2A4A] to-[#2563EB] p-6 shadow-lg">
          {/* Torii gate illustration */}
          <ToriiGate className="absolute -right-2 -top-2 h-24 w-24 text-white/[0.08]" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-blue-200">
              {labels.progressTitle}
            </div>
            <h2 className="mt-4 text-lg font-bold text-white">{labels.progressSignIn}</h2>
            <p className="mt-2 text-sm leading-relaxed text-blue-100/80">{labels.progressSignInSub}</p>
          </div>
          <Link
            href={`/${locale}/login`}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-[#1B2A4A] shadow-[0_4px_16px_rgba(255,255,255,0.2)] outline-none transition-all duration-200 hover:bg-blue-50 hover:shadow-[0_6px_24px_rgba(255,255,255,0.3)] focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {labels.progressSignInCta}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        title={labels.progressTitle}
        description={labels.progressSubtitle}
        actions={
          <Link
            href={`/${locale}/analytics`}
            className="text-sm font-semibold text-[#3B82F6] outline-none hover:text-[#2563EB] focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2"
          >
            {labels.sectionViewAll}
          </Link>
        }
      />

      {analyticsLoading ? (
        <div className="grid grid-cols-2 gap-3" aria-busy>
          {[1, 2, 3, 4].map((i) => (
            <LoadingSkeleton className="h-32" key={i} />
          ))}
          <p className="sr-only">{labels.sectionLoadingHint}</p>
        </div>
      ) : (
        <div className="relative rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/80 p-5 shadow-lg">
          {/* Daruma mascot — corner decoration */}
          <DarumaMascot
            className="absolute -right-1 -top-10 z-10 h-16 w-16 drop-shadow-md"
            state={darumaState}
          />

          <div className="grid grid-cols-2 gap-3">
            <RingStat
              label={labels.progressStreakLabel}
              displayValue={totals ? labels.progressStreak.replace("{n}", String(animStreak)) : "—"}
              numericValue={animStreak}
              maxValue={30}
              ringColor="#F59E0B"
              icon={<FlameIcon />}
            />
            <RingStat
              label={labels.progressReviews}
              displayValue={totals ? String(animReviews) : "—"}
              numericValue={animReviews}
              maxValue={Math.max(100, animReviews)}
              ringColor="#3B82F6"
              icon={<BookIcon />}
            />
            <RingStat
              label={labels.progressAccuracy}
              displayValue={totals ? `${animAccuracy}%` : "—"}
              numericValue={animAccuracy}
              maxValue={100}
              ringColor="#059669"
              icon={<TargetIcon />}
            />
            <RingStat
              label={labels.progressSessions}
              displayValue={totals ? String(animSessions) : "—"}
              numericValue={animSessions}
              maxValue={Math.max(20, animSessions)}
              ringColor="#0D9488"
              icon={<CalendarIcon />}
            />
          </div>

          <Link
            href={`/${locale}/analytics`}
            className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 py-2.5 text-sm font-semibold text-[#3B82F6] transition-colors hover:bg-blue-50 hover:text-[#2563EB]"
          >
            {labels.sectionViewAll}
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </Link>
        </div>
      )}

      {analytics?.insight ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
          {analytics.insight}
        </div>
      ) : null}

    </section>
  );
}
