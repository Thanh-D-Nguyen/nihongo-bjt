"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { learnerApiFetchOptional } from "../../../../lib/learner-api";

interface LevelItem {
  code: string;
  nameJa: string;
  nameVi: string;
  scoreMin: number;
  scoreMax: number;
  jlptEquiv: string;
  descriptionVi: string;
  descriptionJa: string;
  color: string;
  vocabCount: number;
  kanjiCount: number;
  grammarCount: number;
}

interface Labels {
  title: string;
  subtitle: string;
  scoreRange: string;
  vocab: string;
  kanji: string;
  grammar: string;
  loading: string;
  error: string;
}

export function LevelsClient({ labels, locale }: { labels: Labels; locale: string }) {
  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await learnerApiFetchOptional("/api/levels");
        if (res.ok) setLevels(await res.json());
        else setError(true);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-[#F3F4F6]" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div className="h-44 animate-pulse rounded-2xl bg-[#F3F4F6]" key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <p className="text-sm text-red-500">{labels.error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-[#111827]">{labels.title}</h1>
      <p className="mt-1 text-sm text-[#6B7280]">{labels.subtitle}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {levels.map((lv) => (
          <Link
            className="group relative overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm transition-all hover:shadow-lg"
            href={`/${locale}/levels/${lv.code}`}
            key={lv.code}
          >
            <div
              className="h-2"
              style={{ background: lv.color }}
            />
            <div className="space-y-3 p-5">
              <div>
                <h2 className="text-lg font-bold text-[#111827]">{lv.code}</h2>
                <p className="text-xs text-[#6B7280]">{lv.nameVi}</p>
              </div>
              <p className="text-xs leading-relaxed text-[#4B5563]">{lv.descriptionVi}</p>
              <div className="flex items-center gap-1 text-[10px] text-[#9CA3AF]">
                <span className="rounded bg-[#F3F4F6] px-1.5 py-0.5">{labels.scoreRange}: {lv.scoreMin}–{lv.scoreMax}</span>
                <span className="rounded bg-[#F3F4F6] px-1.5 py-0.5">≈ {lv.jlptEquiv}</span>
              </div>
              <div className="flex gap-3 text-xs text-[#6B7280]">
                <span>{lv.vocabCount} {labels.vocab}</span>
                <span>{lv.kanjiCount} {labels.kanji}</span>
                <span>{lv.grammarCount} {labels.grammar}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
