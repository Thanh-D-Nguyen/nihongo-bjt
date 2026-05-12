"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { learnerApiFetchOptional } from "../../../../../lib/learner-api";

type Tab = "lessons" | "vocabulary" | "kanji" | "grammar";

interface LevelDef {
  code: string;
  nameJa: string;
  nameVi: string;
  scoreMin: number;
  scoreMax: number;
  jlptEquiv: string;
  descriptionVi: string;
  descriptionJa: string;
  color: string;
}

interface LessonSummary {
  id: string;
  slug: string;
  sortOrder: number;
  titleVi: string;
  titleJa: string;
  descriptionVi: string | null;
  descriptionJa: string | null;
  vocabCount: number;
  kanjiCount: number;
  grammarCount: number;
}

interface Labels {
  back: string;
  tabVocabulary: string;
  tabKanji: string;
  tabGrammar: string;
  tabLessons: string;
  searchPlaceholder: string;
  noResults: string;
  loading: string;
  notFound: string;
  error: string;
  loadMore: string;
  practiceQuiz: string;
  lessonLabel: string;
  vocabShort: string;
  grammarShort: string;
  kanjiShort: string;
  noLessons: string;
  lessonCompleted: string;
  lessonProgress: string;
}

/* ── localStorage helpers ── */
function getCompletedLessons(): Set<string> {
  try {
    const raw = localStorage.getItem("bjt_lesson_completed");
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

export function LevelDetailClient({ code, labels, locale }: { code: string; labels: Labels; locale: string }) {
  const [level, setLevel] = useState<LevelDef | null>(null);
  const [tab, setTab] = useState<Tab>("lessons");
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [items, setItems] = useState<unknown[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState(false);
  const PAGE = 30;

  // Load level definition + lessons
  useEffect(() => {
    void (async () => {
      try {
        const [lvRes, lessonsRes] = await Promise.all([
          learnerApiFetchOptional(`/api/levels/${code}`),
          learnerApiFetchOptional(`/api/levels/${code}/lessons`)
        ]);
        if (lvRes.ok) setLevel(await lvRes.json());
        else setError(true);
        if (lessonsRes.ok) setLessons(await lessonsRes.json());
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  // Load tab content (vocabulary/kanji/grammar)
  const loadTab = useCallback(async (t: Tab, q: string, off: number, append: boolean) => {
    if (t === "lessons") return;
    setTabLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(off) });
      if (q) params.set("q", q);
      const res = await learnerApiFetchOptional(`/api/levels/${code}/${t}?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems((prev) => append ? [...prev, ...data] : data);
      }
    } catch { /* non-critical */ } finally {
      setTabLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (tab === "lessons") return;
    setOffset(0);
    const t = setTimeout(() => void loadTab(tab, query, 0, false), 300);
    return () => clearTimeout(t);
  }, [tab, query, loadTab]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="h-8 w-64 animate-pulse rounded bg-[#F3F4F6]" />
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-[#F3F4F6]" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => <div className="h-20 animate-pulse rounded-xl bg-[#F3F4F6]" key={i} />)}
        </div>
      </div>
    );
  }

  if (error || !level) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <p className="text-sm text-[#6B7280]">{labels.notFound}</p>
        <Link className="mt-2 inline-block text-sm font-medium text-[#3B82F6]" href={`/${locale}/levels`}>
          ← {labels.back}
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "lessons", label: labels.tabLessons },
    { key: "vocabulary", label: labels.tabVocabulary },
    { key: "kanji", label: labels.tabKanji },
    { key: "grammar", label: labels.tabGrammar }
  ];
  const lessonItemCount = lessons.reduce((sum, lesson) => sum + lesson.vocabCount + lesson.kanjiCount + lesson.grammarCount, 0);
  const firstLesson = lessons[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
        <Link className="hover:text-[#3B82F6]" href={`/${locale}/levels`}>{labels.back}</Link>
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
        <span className="font-medium text-[#4B5563]">{level.code}</span>
      </nav>

      {/* Level header */}
      <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[#D7DFEA] bg-white shadow-sm">
        <div className="h-2" style={{ background: level.color }} />
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black tracking-tight text-[#111827]">{level.code}</h1>
              <span className="text-sm font-bold text-[#475569]">{level.nameVi}</span>
              <span className="rounded-full bg-[#F8FAFC] px-2.5 py-1 text-[10px] font-bold text-[#64748B] ring-1 ring-[#E2E8F0]">
                {level.scoreMin}–{level.scoreMax} · ≈ {level.jlptEquiv}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#334155]">{level.descriptionVi}</p>
            <p className="mt-1 text-sm text-[#64748B]">{level.descriptionJa}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {firstLesson ? (
                <Link
                  className="inline-flex items-center rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90"
                  href={`/${locale}/levels/${code}/lessons/${firstLesson.slug}`}
                  style={{ background: level.color }}
                >
                  {labels.tabLessons} 1 →
                </Link>
              ) : null}
              <Link
                className="inline-flex items-center rounded-lg bg-[#101827] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0F172A]"
                href={`/${locale}/quiz`}
              >
                {labels.practiceQuiz} →
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 self-center sm:grid-cols-4 lg:grid-cols-2">
            <LevelMetric label={labels.tabLessons} value={lessons.length} />
            <LevelMetric label={labels.vocabShort} value={lessons.reduce((sum, lesson) => sum + lesson.vocabCount, 0)} />
            <LevelMetric label={labels.kanjiShort} value={lessons.reduce((sum, lesson) => sum + lesson.kanjiCount, 0)} />
            <LevelMetric label={labels.grammarShort} value={lessons.reduce((sum, lesson) => sum + lesson.grammarCount, 0)} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 grid grid-cols-4 gap-1 rounded-xl bg-[#F3F4F6] p-1">
        {tabs.map((t) => (
          <button
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              tab === t.key
                ? "bg-white text-[#111827] shadow-sm"
                : "text-[#6B7280] hover:text-[#111827]"
            }`}
            key={t.key}
            onClick={() => { setTab(t.key); setQuery(""); }}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-4">
        {tab === "lessons" ? (
          <LessonsList lessons={lessons} labels={labels} locale={locale} levelCode={code} totalItems={lessonItemCount} />
        ) : (
          <>
            {/* Search (only for flat content tabs) */}
            <input
              className="mb-4 w-full rounded-xl border border-[#D1D5DB] px-4 py-2.5 text-sm outline-none placeholder:text-[#9CA3AF] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              onChange={(e) => setQuery(e.target.value)}
              placeholder={labels.searchPlaceholder}
              type="search"
              value={query}
            />

            {tabLoading && items.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div className="h-14 animate-pulse rounded-xl bg-[#F3F4F6]" key={i} />)}
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#6B7280]">{labels.noResults}</p>
            ) : (
              <>
                {tab === "vocabulary" ? <VocabList items={items} locale={locale} /> : null}
                {tab === "kanji" ? <KanjiGrid items={items} locale={locale} /> : null}
                {tab === "grammar" ? <GrammarList items={items} locale={locale} /> : null}

                {items.length >= offset + PAGE ? (
                  <button
                    className="mt-4 w-full rounded-xl border border-[#E5E7EB] bg-white py-2.5 text-sm font-medium text-[#4B5563] hover:bg-[#F9FAFB]"
                    disabled={tabLoading}
                    onClick={() => {
                      const next = offset + PAGE;
                      setOffset(next);
                      void loadTab(tab, query, next, true);
                    }}
                    type="button"
                  >
                    {tabLoading ? "..." : labels.loadMore}
                  </button>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Lessons list ────────────────────────────── */

function LessonsList({ lessons, labels, locale, levelCode, totalItems }: {
  lessons: LessonSummary[];
  labels: Labels;
  locale: string;
  levelCode: string;
  totalItems: number;
}) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  useEffect(() => { setCompleted(getCompletedLessons()); }, []);

  if (lessons.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F6]">
          <span className="text-xl">📚</span>
        </div>
        <p className="text-sm text-[#6B7280]">{labels.noLessons}</p>
      </div>
    );
  }

  const doneCount = lessons.filter((l) => completed.has(l.slug)).length;

  return (
    <>
      <div className="mb-4 grid gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">{labels.tabLessons}</p>
          <p className="mt-1 text-sm text-[#334155]">
            {lessons.length} {labels.tabLessons.toLowerCase()} · {totalItems} items
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0] sm:w-56">
          <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${Math.max(8, doneCount / lessons.length * 100)}%` }} />
        </div>
      </div>
      {/* Progress bar */}
      {doneCount > 0 ? (
        <div className="mb-4 rounded-xl bg-[#F9FAFB] p-3">
          <div className="flex items-center justify-between text-xs text-[#6B7280]">
            <span>{labels.lessonProgress.replace("{done}", String(doneCount)).replace("{total}", String(lessons.length))}</span>
            <span className="font-semibold text-[#10B981]">{Math.round(doneCount / lessons.length * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
            <div className="h-full rounded-full bg-[#10B981] transition-all" style={{ width: `${doneCount / lessons.length * 100}%` }} />
          </div>
        </div>
      ) : null}

      <ol className="space-y-3">
        {lessons.map((lesson) => {
          const totalItems = lesson.vocabCount + lesson.kanjiCount + lesson.grammarCount;
          const isDone = completed.has(lesson.slug);
          return (
            <li key={lesson.id}>
              <Link
                className={`group flex gap-4 rounded-2xl border bg-white p-4 transition-all hover:shadow-md ${
                  isDone ? "border-[#10B981]/30 bg-[#F0FDF4]" : "border-[#E5E7EB] hover:border-[#3B82F6]/30"
                }`}
                href={`/${locale}/levels/${levelCode}/lessons/${lesson.slug}`}
              >
                {/* Lesson number badge — shows checkmark if completed */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
                  isDone
                    ? "bg-[#10B981] text-white"
                    : "bg-[#F3F4F6] text-[#4B5563] group-hover:bg-[#3B82F6] group-hover:text-white"
                }`}>
                  {isDone ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} /></svg>
                  ) : lesson.sortOrder}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[#111827] leading-snug">
                      {lesson.titleVi}
                    </h3>
                    {isDone ? (
                      <span className="inline-flex items-center rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-medium text-[#065F46]">
                        {labels.lessonCompleted}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-[#6B7280] leading-relaxed" lang="ja">
                    {lesson.titleJa}
                  </p>
                  {lesson.descriptionVi ? (
                    <p className="mt-1.5 text-xs text-[#9CA3AF] line-clamp-2">{lesson.descriptionVi}</p>
                  ) : null}

                  {/* Content counts */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lesson.vocabCount > 0 ? (
                      <span className="inline-flex items-center rounded-md bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-medium text-[#1D4ED8]">
                        {lesson.vocabCount} {labels.vocabShort}
                      </span>
                    ) : null}
                    {lesson.kanjiCount > 0 ? (
                      <span className="inline-flex items-center rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-medium text-[#92400E]">
                        {lesson.kanjiCount} {labels.kanjiShort}
                      </span>
                    ) : null}
                    {lesson.grammarCount > 0 ? (
                      <span className="inline-flex items-center rounded-md bg-[#EDE9FE] px-2 py-0.5 text-[10px] font-medium text-[#6D28D9]">
                        {lesson.grammarCount} {labels.grammarShort}
                      </span>
                    ) : null}
                    <span className="text-[10px] text-[#9CA3AF]">
                      {totalItems} items
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center text-[#D1D5DB] transition-colors group-hover:text-[#3B82F6]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                  </svg>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function LevelMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
      <p className="text-2xl font-black tracking-tight text-[#111827]">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
    </div>
  );
}

/* ── Sub-renderers ──────────────────────────── */

function VocabList({ items, locale }: { items: unknown[]; locale: string }) {
  const rows = items as Array<{ id: string; headword: string; reading: string | null; shortMeaningVi: string | null; senses: Array<{ meaningVi: string | null }> }>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            className="flex items-baseline gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 transition-all hover:border-[#3B82F6]/30 hover:shadow-sm"
            href={`/${locale}/dictionary/${r.id}`}
          >
            <span className="font-semibold text-[#111827]">{r.headword}</span>
            {r.reading ? <span className="text-xs text-[#9CA3AF]">{r.reading}</span> : null}
            <span className="ml-auto truncate text-xs text-[#6B7280]">
              {r.senses?.[0]?.meaningVi ?? r.shortMeaningVi ?? ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function KanjiGrid({ items, locale }: { items: unknown[]; locale: string }) {
  const rows = items as Array<{ id: string; character: string; meaningVi: string | null; onyomi: string | null }>;
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {rows.map((r) => (
        <Link
          className="flex flex-col items-center rounded-xl border border-[#E5E7EB] bg-white p-2.5 transition-all hover:border-[#3B82F6]/30 hover:shadow-sm"
          href={`/${locale}/kanji/${r.id}`}
          key={r.id}
        >
          <span className="text-2xl font-bold text-[#111827]">{r.character}</span>
          <span className="mt-0.5 truncate text-[10px] text-[#6B7280]">{r.meaningVi}</span>
        </Link>
      ))}
    </div>
  );
}

function GrammarList({ items, locale }: { items: unknown[]; locale: string }) {
  const rows = items as Array<{ id: string; pattern: string; meaningVi: string | null; jlptLevel: string | null }>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            className="flex items-baseline gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 transition-all hover:border-[#8B5CF6]/30 hover:shadow-sm"
            href={`/${locale}/grammar/${r.id}`}
          >
            <span className="font-semibold text-[#111827]">{r.pattern}</span>
            <span className="ml-auto truncate text-xs text-[#6B7280]">{r.meaningVi}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
