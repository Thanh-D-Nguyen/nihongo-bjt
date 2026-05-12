"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { learnerApiFetchOptional } from "../../../../lib/learner-api";

interface LevelItem {
  code: string;
  nameVi: string;
  color: string;
  vocabCount: number;
  kanjiCount: number;
  grammarCount: number;
}

interface Labels {
  sectionTitle: string;
  viewAll: string;
  vocab: string;
  kanji: string;
  grammar: string;
}

export function BjtLevelsSection({ labels, locale }: { labels: Labels; locale: string }) {
  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void learnerApiFetchOptional("/api/levels")
      .then(async (res) => {
        if (res.ok) setLevels(await res.json());
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready || levels.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-slate-800">{labels.sectionTitle}</h2>
        <Link className="text-sm font-semibold text-blue-600 hover:text-blue-700" href={`/${locale}/levels`}>
          {labels.viewAll} →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {levels.map((lv) => (
          <Link
            className="group flex min-w-[140px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            href={`/${locale}/levels/${lv.code}`}
            key={lv.code}
          >
            {/* Color accent bar */}
            <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${lv.color}, ${lv.color}80)` }} />
            <div className="p-4">
              <span className="text-base font-extrabold text-slate-800">{lv.code}</span>
              <span className="ml-2 text-xs font-medium text-slate-500">{lv.nameVi}</span>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm font-bold tabular-nums text-slate-700">{lv.vocabCount}</p>
                  <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">{labels.vocab}</p>
                </div>
                <div>
                  <p className="text-sm font-bold tabular-nums text-slate-700">{lv.kanjiCount}</p>
                  <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">{labels.kanji}</p>
                </div>
                <div>
                  <p className="text-sm font-bold tabular-nums text-slate-700">{lv.grammarCount}</p>
                  <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">{labels.grammar}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
