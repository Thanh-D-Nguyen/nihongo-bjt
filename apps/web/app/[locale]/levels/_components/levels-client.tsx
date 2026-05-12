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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <section className="overflow-hidden rounded-[1.5rem] border border-[#D7DFEA] bg-[#101827] text-white shadow-sm">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#93C5FD]">BJT Path</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{labels.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#CBD5E1]">{labels.subtitle}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 self-end rounded-2xl border border-white/10 bg-white/5 p-3">
            <Metric value={String(levels.reduce((sum, lv) => sum + lv.vocabCount, 0))} label={labels.vocab} />
            <Metric value={String(levels.reduce((sum, lv) => sum + lv.kanjiCount, 0))} label={labels.kanji} />
            <Metric value={String(levels.reduce((sum, lv) => sum + lv.grammarCount, 0))} label={labels.grammar} />
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {levels.map((lv) => (
          <Link
            className="group relative overflow-hidden rounded-2xl border border-[#DDE5EF] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#94A3B8] hover:shadow-lg"
            href={`/${locale}/levels/${lv.code}`}
            key={lv.code}
          >
            <div
              className="h-2"
              style={{ background: lv.color }}
            />
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-[#111827]">{lv.code}</h2>
                  <p className="text-xs font-semibold text-[#6B7280]">{lv.nameVi}</p>
                </div>
                <span className="rounded-full bg-[#F8FAFC] px-2.5 py-1 text-[10px] font-bold text-[#475569] ring-1 ring-[#E2E8F0]">
                  {lv.scoreMin}–{lv.scoreMax}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[#4B5563]">{lv.descriptionVi}</p>
              <div className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-3 py-2 text-[10px] font-semibold text-[#64748B]">
                <span>{labels.scoreRange}: {lv.scoreMin}–{lv.scoreMax}</span>
                <span>≈ {lv.jlptEquiv}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-[#64748B]">
                <Count value={lv.vocabCount} label={labels.vocab} />
                <Count value={lv.kanjiCount} label={labels.kanji} />
                <Count value={lv.grammarCount} label={labels.grammar} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-3 text-center">
      <p className="text-lg font-black">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#CBD5E1]">{label}</p>
    </div>
  );
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-2">
      <p className="font-black text-[#111827]">{value}</p>
      <p className="mt-0.5 truncate">{label}</p>
    </div>
  );
}
