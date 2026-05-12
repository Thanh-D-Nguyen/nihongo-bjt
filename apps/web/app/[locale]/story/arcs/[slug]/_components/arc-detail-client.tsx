"use client";

import { Card } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { storyArcDetail } from "../../../../../../src/features/career-rpg/api";
import { NpcRelationCard } from "../../../../../../src/features/career-rpg/components/npc-relation-card";
import { useCareerRpg } from "../../../../../../src/features/career-rpg/store";
import type { CareerRpgLabels } from "../../../../../../src/features/career-rpg/i18n";
import type { MissionArc, MissionChapter, NpcRelation, StoryNpc } from "../../../../../../src/features/career-rpg/types";

interface Props {
  labels: CareerRpgLabels;
  locale: string;
  slug: string;
}

export function ArcDetailClient({ labels, locale, slug }: Props) {
  const { npcRelations: fallbackRelations } = useCareerRpg();
  const [arc, setArc] = useState<MissionArc | null>(null);
  const [chapters, setChapters] = useState<MissionChapter[]>([]);
  const [npcRelations, setNpcRelations] = useState<NpcRelation[]>(fallbackRelations);
  const [npcs, setNpcs] = useState<StoryNpc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void storyArcDetail(slug)
      .then((detail) => {
        if (!alive) return;
        setArc(detail.arc);
        setChapters(detail.chapters);
        setNpcRelations(detail.npcRelations);
        setNpcs(detail.npcs);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load arc details");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-[#4B5563]">Loading…</div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (!arc) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-[#4B5563]">
        Arc not found: <code>{slug}</code>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        className="inline-flex w-fit min-h-8 items-center text-xs font-medium text-[#4B5563] transition-colors hover:text-[#111827]"
        href={`/${locale}/story/arcs`}
      >
        ← {labels.arcDetail.backLink}
      </Link>

      <header className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#6B7280]">
          {labels.arcs.eyebrow}
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-[#111827]">{arc.titleJa}</h1>
        <p className="text-sm text-[#4B5563]">{arc.titleVi}</p>
        <div className="h-1.5 w-32 rounded-full" style={{ background: arc.artAccent }} />
      </header>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
          {labels.arcDetail.synopsisTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#111827]">{arc.synopsisVi}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
          {labels.arcDetail.npcsTitle}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {arc.npcSlugs.map((slug) => {
            const npc = npcs.find((n) => n.slug === slug);
            const relation = npcRelations.find((r) => r.npcSlug === slug);
            if (!npc || !relation) return null;
            return (
              <li key={slug}>
                <NpcRelationCard labels={labels.career} npc={npc} relation={relation} />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
          {labels.arcDetail.chaptersTitle}
        </h2>
        <ol className="space-y-3">
          {chapters.map((ch, idx) => {
            const isCompleted = idx < arc.completedChapters;
            const isLocked = idx > arc.completedChapters;
            return (
              <li key={ch.id}>
                <ChapterRow
                  chapter={ch}
                  done={isCompleted}
                  labels={labels.arcDetail}
                  locale={locale}
                  locked={isLocked}
                />
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function ChapterRow({
  chapter,
  done,
  labels,
  locale,
  locked
}: {
  chapter: MissionChapter;
  done: boolean;
  labels: CareerRpgLabels["arcDetail"];
  locale: string;
  locked: boolean;
}) {
  if (!chapter) return null;
  const number = String(chapter.displayOrder).padStart(2, "0");

  const inner = (
    <Card className="flex items-center gap-4 p-4">
      <div
        className={`grid h-12 w-12 place-items-center rounded-full text-sm font-semibold ${
          done
            ? "bg-[#ECFDF5] text-[#047857]"
            : locked
              ? "bg-[#F1F5F9] text-[#9CA3AF]"
              : "bg-[#1B2A4A] text-white"
        }`}
      >
        {chapter.isBoss ? "★" : number}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {chapter.isBoss ? (
            <span className="rounded-full bg-[#9F1239] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
              {labels.bossLabel}
            </span>
          ) : null}
          <h3 className="truncate text-sm font-semibold text-[#111827]">{chapter.titleJa}</h3>
        </div>
        <p className="truncate text-xs text-[#4B5563]">{chapter.titleVi}</p>
        <p className="text-[11px] text-[#6B7280]">
          {labels.chapterMinutes.replace("{n}", String(chapter.estimatedMinutes))}
        </p>
      </div>
      <span
        className={`whitespace-nowrap text-xs font-semibold ${
          done ? "text-[#047857]" : locked ? "text-[#9CA3AF]" : "text-[#1B2A4A]"
        }`}
      >
        {done ? labels.chapterDone : locked ? labels.chapterLocked : `${labels.startChapter} →`}
      </span>
    </Card>
  );

  if (locked || done) return inner;
  return (
    <Link className="block" href={`/${locale}/story/chapters/${chapter.id}`}>
      {inner}
    </Link>
  );
}
