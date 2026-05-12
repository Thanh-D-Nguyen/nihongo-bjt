"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  completeCurrentChapterAttempt,
  startChapterAttempt,
  storyChapter
} from "../../../../../../src/features/career-rpg/api";
import { BjtStyleQuestionCard } from "../../../../../../src/features/career-rpg/components/bjt-style-question-card";
import { ChapterBriefingPanel } from "../../../../../../src/features/career-rpg/components/chapter-briefing-panel";
import { ChapterCompleteScreen } from "../../../../../../src/features/career-rpg/components/chapter-complete-screen";
import { NpcReactionOverlay } from "../../../../../../src/features/career-rpg/components/npc-reaction-overlay";
import { RankUpOverlay } from "../../../../../../src/features/career-rpg/components/rank-up-overlay";
import { WorkplaceScenarioCard } from "../../../../../../src/features/career-rpg/components/workplace-scenario-card";
import {
  findRank,
  findNextRank
} from "../../../../../../src/features/career-rpg/mock-data";
import { useCareerRpg } from "../../../../../../src/features/career-rpg/store";
import type { CareerRpgLabels } from "../../../../../../src/features/career-rpg/i18n";
import type { CareerRank, ChapterResult, MissionChapter, RiskOutcomePreview } from "../../../../../../src/features/career-rpg/types";

interface Props {
  chapterId: string;
  labels: CareerRpgLabels;
  locale: string;
}

type Phase = "briefing" | "scenario" | "reacted" | "rankup" | "complete";

export function ChapterPlayerClient({ chapterId, labels, locale }: Props) {
  const { applyChapterResult, career } = useCareerRpg();
  const [phase, setPhase] = useState<Phase>("briefing");
  const [outcome, setOutcome] = useState<RiskOutcomePreview | null>(null);
  const [chapter, setChapter] = useState<MissionChapter | null>(null);
  const [loadingChapter, setLoadingChapter] = useState(true);
  const [result, setResult] = useState<ChapterResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rankUpState, setRankUpState] = useState<{
    oldRank: CareerRank;
    newRank: CareerRank;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    void storyChapter(chapterId)
      .then((detail) => {
        if (!alive) return;
        setLoadingChapter(false);
        if (alive) setChapter(detail.chapter);
      })
      .catch((err) => {
        if (!alive) return;
        setLoadingChapter(false);
        setChapter(null);
      });
    return () => {
      alive = false;
    };
  }, [chapterId]);

  const handleAnswer = useCallback((optionKey: string) => {
    if (!chapter) return;
    const scenario = chapter.scenarios[0];
    const opt = scenario?.question.options.find((o) => o.optionKey === optionKey);
    if (!opt) return;
    setOutcome(opt.outcome);
    setPhase("reacted");
  }, [chapter]);

  const handleContinue = useCallback(async () => {
    const oldRankCode = career.currentRankCode;
    try {
      await startChapterAttempt(chapterId);
      const completed = await completeCurrentChapterAttempt(chapterId);
      setResult(completed.result);
      if (completed.rankUp) {
        const oldRank = findRank(completed.rankUp.fromRankCode);
        const newRank = findRank(completed.rankUp.toRankCode);
        if (oldRank && newRank) {
          setRankUpState({ oldRank, newRank });
          setPhase("rankup");
          return;
        }
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to complete chapter");
      setPhase("complete");
    }
    setPhase("complete");
  }, [applyChapterResult, career, chapterId]);

  if (loadingChapter) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-[#4B5563]">
        {labels.chapter.briefingEyebrow}
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-[#4B5563]">
        Chapter not found: <code>{chapterId}</code>
      </div>
    );
  }

  const scenario = chapter.scenarios[0] ?? null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        className="inline-flex w-fit min-h-8 items-center text-xs font-medium text-[#4B5563] transition-colors hover:text-[#111827]"
        href={`/${locale}/story/arcs/${chapter.arcSlug}`}
      >
        ← {labels.chapter.backLink}
      </Link>

      {phase === "briefing" ? (
        <ChapterBriefingPanel
          chapter={chapter}
          labels={labels.chapter}
          onStart={() => setPhase("scenario")}
        />
      ) : null}

      {phase === "scenario" && scenario ? (
        <div className="space-y-5 motion-safe:animate-[fadeIn_300ms_ease-out]">
          <WorkplaceScenarioCard labels={labels.chapter} scenario={scenario} />
          <BjtStyleQuestionCard
            labels={labels.chapter}
            onSubmit={handleAnswer}
            question={scenario.question}
          />
        </div>
      ) : phase === "scenario" && !scenario ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-6 py-10 text-center">
          <p className="text-sm text-[#6B7280]">{labels.chapter.noScenarioYet ?? "このチャプターのシナリオは準備中です。"}</p>
          <Link
            className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#1B2A4A] px-5 text-sm font-medium text-white hover:bg-[#243560]"
            href={`/${locale}/story/arcs/${chapter.arcSlug}`}
          >
            ← {labels.chapter.backLink}
          </Link>
        </div>
      ) : null}

      {phase === "reacted" && outcome ? (
        <>
          {scenario ? (
            <div className="opacity-50 grayscale-[20%]">
              <WorkplaceScenarioCard labels={labels.chapter} scenario={scenario} />
            </div>
          ) : null}
          <NpcReactionOverlay
            continueLabel={labels.chapter.finishChapter}
            labels={labels.chapter}
            onContinue={handleContinue}
            outcome={outcome}
            reactionLabels={labels.reaction}
          />
        </>
      ) : null}

      {phase === "rankup" && rankUpState ? (
        <RankUpOverlay
          labels={labels.rankUp}
          newRank={rankUpState.newRank}
          oldRank={rankUpState.oldRank}
          onContinue={() => setPhase("complete")}
        />
      ) : null}

      {phase === "complete" ? (
        submitError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{submitError}</div>
        ) : result ? (
          <ChapterCompleteScreen
            axisLabels={labels.career.skillsAxisLabels}
            labels={labels.complete}
            locale={locale}
            result={result}
          />
        ) : null
      ) : null}

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
