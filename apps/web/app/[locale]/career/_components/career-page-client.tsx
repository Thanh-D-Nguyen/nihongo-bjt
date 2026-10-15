"use client";

import { Card } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { careerMe, careerRanks } from "../../../../src/features/career-rpg/api";
import { CareerRankCard } from "../../../../src/features/career-rpg/components/career-rank-card";
import { CareerSkillRadar } from "../../../../src/features/career-rpg/components/career-skill-radar";
import { NpcRelationCard } from "../../../../src/features/career-rpg/components/npc-relation-card";
import type { CareerRpgLabels } from "../../../../src/features/career-rpg/i18n";
import type { CareerRank, NpcRelation, StoryNpc, UserCareerState } from "../../../../src/features/career-rpg/types";

interface Props {
  labels: CareerRpgLabels;
  locale: string;
}

export function CareerPageClient({ labels, locale }: Props) {
  const [career, setCareer] = useState<UserCareerState | null>(null);
  const [npcRelations, setNpcRelations] = useState<NpcRelation[]>([]);
  const [npcs, setNpcs] = useState<StoryNpc[]>([]);
  const [ranks, setRanks] = useState<CareerRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    void Promise.all([careerMe(), careerRanks()])
      .then(([careerResponse, ranksResponse]) => {
        if (!alive) return;
        const currentRank = ranksResponse.find((rank) => rank.rankCode === careerResponse.state.currentRankCode);
        setCareer({ ...careerResponse.state, rankXpToNext: currentRank?.xpToNext ?? 0 });
        setNpcRelations(careerResponse.npcRelations);
        setNpcs(careerResponse.npcs);
        setRanks(ranksResponse);
      })
      .catch(() => {
        if (!alive) return;
        setCareer(null);
        setNpcRelations([]);
        setNpcs([]);
        setRanks([]);
        setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [retryKey]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#6B7280]">
            {labels.career.eyebrow}
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight text-[#111827]">
            {labels.career.title}
          </h1>
          <p className="text-sm text-[#4B5563]">{labels.career.subtitle}</p>
        </div>
        <Link
          className="inline-flex min-h-9 items-center justify-center rounded-[10px] border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#111827] shadow-sm transition-colors hover:bg-[#F8FAFC]"
          href={`/${locale}/daily-standup`}
        >
          ← {labels.career.backHome}
        </Link>
      </header>

      {loading ? <p role="status" className="text-sm text-[#4B5563]">{labels.career.loading}</p> : null}
      {!loading && (error || !career) ? (
        <section aria-live="polite" className="rounded-xl border border-[#FECACA] bg-white p-5" role="alert">
          <p className="text-sm text-[#991B1B]">{labels.career.loadError}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-[10px] bg-[#1B2A4A] px-4 text-sm font-semibold text-white"
              onClick={() => setRetryKey((current) => current + 1)}
              type="button"
            >
              {labels.career.retry}
            </button>
            <Link className="text-sm font-semibold text-[#1B2A4A] underline" href={`/${locale}/login?returnTo=${encodeURIComponent(`/${locale}/career`)}`}>
              {labels.career.loginLink}
            </Link>
          </div>
        </section>
      ) : null}

      {!loading && !error && career ? <>
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
            {labels.career.skillsTitle}
          </p>
          <p className="text-sm text-[#4B5563]">{labels.career.skillsSubtitle}</p>
          {career.skills.length > 0 ? (
            <div className="mt-4 flex justify-center">
              <CareerSkillRadar axisLabels={labels.career.skillsAxisLabels} state={career} />
            </div>
          ) : <p className="mt-4 text-sm text-[#6B7280]">{labels.career.skillsEmpty}</p>}
        </Card>
        <CareerRankCard labels={labels.career} ranks={ranks} state={career} />
      </section>

      <section className="space-y-3">
        <header>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
            {labels.career.relationsTitle}
          </p>
          <p className="text-sm text-[#4B5563]">{labels.career.relationsSubtitle}</p>
        </header>
        {npcRelations.length > 0 ? <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {npcRelations.map((rel) => {
            const npc = npcs.find((n) => n.slug === rel.npcSlug);
            if (!npc) return null;
            return (
              <li key={rel.npcSlug}>
                <NpcRelationCard labels={labels.career} npc={npc} relation={rel} />
              </li>
            );
          })}
        </ul> : <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-4 text-sm text-[#6B7280]">{labels.career.relationsEmpty}</p>}
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-xs text-[#4B5563] shadow-sm">
        {ranks.length > 0 ? ranks.map((rank) => rank.titleJa).join(" → ") : labels.career.ranksEmpty}
      </section>
      </> : null}
    </div>
  );
}
