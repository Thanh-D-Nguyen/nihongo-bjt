"use client";

import { Card } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { careerMe, careerRanks } from "../../../../src/features/career-rpg/api";
import { CareerRankCard } from "../../../../src/features/career-rpg/components/career-rank-card";
import { CareerSkillRadar } from "../../../../src/features/career-rpg/components/career-skill-radar";
import { NpcRelationCard } from "../../../../src/features/career-rpg/components/npc-relation-card";
import { mockStoryNpcs } from "../../../../src/features/career-rpg/mock-data";
import { useCareerRpg } from "../../../../src/features/career-rpg/store";
import type { CareerRpgLabels } from "../../../../src/features/career-rpg/i18n";
import type { CareerRank, NpcRelation, StoryNpc, UserCareerState } from "../../../../src/features/career-rpg/types";

interface Props {
  labels: CareerRpgLabels;
  locale: string;
}

export function CareerPageClient({ labels, locale }: Props) {
  const { career: fallbackCareer, npcRelations: fallbackRelations } = useCareerRpg();
  const [career, setCareer] = useState<UserCareerState>(fallbackCareer);
  const [npcRelations, setNpcRelations] = useState<NpcRelation[]>(fallbackRelations);
  const [npcs, setNpcs] = useState<StoryNpc[]>(mockStoryNpcs);
  const [ranks, setRanks] = useState<CareerRank[]>([]);

  useEffect(() => {
    let alive = true;
    void Promise.all([careerMe(), careerRanks()])
      .then(([careerResponse, ranksResponse]) => {
        if (!alive) return;
        setCareer(careerResponse.state);
        setNpcRelations(careerResponse.npcRelations);
        setNpcs(careerResponse.npcs);
        setRanks(ranksResponse);
      })
      .catch(() => {
        if (!alive) return;
        setCareer(fallbackCareer);
        setNpcRelations(fallbackRelations);
        setNpcs(mockStoryNpcs);
        setRanks([]);
      });
    return () => {
      alive = false;
    };
  }, [fallbackCareer, fallbackRelations]);

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

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
            {labels.career.skillsTitle}
          </p>
          <p className="text-sm text-[#4B5563]">{labels.career.skillsSubtitle}</p>
          <div className="mt-4 flex justify-center">
            <CareerSkillRadar axisLabels={labels.career.skillsAxisLabels} state={career} />
          </div>
        </Card>
        <CareerRankCard labels={labels.career} state={career} />
      </section>

      <section className="space-y-3">
        <header>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
            {labels.career.relationsTitle}
          </p>
          <p className="text-sm text-[#4B5563]">{labels.career.relationsSubtitle}</p>
        </header>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {npcRelations.map((rel) => {
            const npc = npcs.find((n) => n.slug === rel.npcSlug) ?? mockStoryNpcs.find((n) => n.slug === rel.npcSlug);
            if (!npc) return null;
            return (
              <li key={rel.npcSlug}>
                <NpcRelationCard labels={labels.career} npc={npc} relation={rel} />
              </li>
            );
          })}
        </ul>
      </section>

      {ranks.length > 0 ? (
        <section className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-xs text-[#4B5563] shadow-sm">
          {ranks.map((rank) => rank.titleJa).join(" → ")}
        </section>
      ) : null}
    </div>
  );
}
