"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

import { learnerApiFetchOptional } from "../../../../../../../lib/learner-api";

/* ── Types ─────────────────────────────────── */

interface LessonNav { slug: string; titleVi: string; sortOrder: number }

interface LessonData {
  id: string;
  slug: string;
  levelCode: string;
  sortOrder: number;
  titleVi: string;
  titleJa: string;
  descriptionVi: string | null;
  descriptionJa: string | null;
  prevLesson: LessonNav | null;
  nextLesson: LessonNav | null;
  contents: Array<{
    sortOrder: number;
    contentType: string;
    content: VocabItem | KanjiItem | GrammarItem;
  }>;
}

interface VocabItem {
  id: string;
  headword: string;
  reading: string | null;
  shortMeaningVi: string | null;
  senses: Array<{ meaningVi: string | null; pos: string | null }>;
}

interface KanjiItem {
  id: string;
  character: string;
  meaningVi: string | null;
  onyomi: string | null;
  kunyomi: string | null;
  components: Array<{ component: string; meaningVi: string | null }>;
  examples: Array<{ word: string; reading: string | null; meaningVi: string | null }>;
}

interface GrammarItem {
  id: string;
  pattern: string;
  meaningVi: string | null;
  details: Array<{ explanationVi: string | null }>;
}

interface Labels {
  pageTitle: string;
  backToLevel: string;
  vocabSection: string;
  kanjiSection: string;
  grammarSection: string;
  notFound: string;
  loading: string;
  error: string;
  meaningLabel: string;
  readingLabel: string;
  examplesLabel: string;
  nextLesson: string;
  prevLesson: string;
  practiceQuiz: string;
  itemsInLesson: string;
  breadcrumbLevels: string;
  collapseSection: string;
  expandSection: string;
  completed: string;
  markComplete: string;
  close: string;
  posLabel: string;
  onyomiLabel: string;
  kunyomiLabel: string;
}

/* ── localStorage helpers for lesson progress ── */

function getCompletedLessons(): Set<string> {
  try {
    const raw = localStorage.getItem("bjt_lesson_completed");
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function toggleLessonComplete(slug: string): boolean {
  const set = getCompletedLessons();
  if (set.has(slug)) { set.delete(slug); } else { set.add(slug); }
  localStorage.setItem("bjt_lesson_completed", JSON.stringify([...set]));
  return set.has(slug);
}

/* ── Main Component ────────────────────────── */

export function LessonDetailClient({ slug, levelCode, labels, locale }: {
  slug: string;
  levelCode: string;
  labels: Labels;
  locale: string;
}) {
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<{ type: string; content: VocabItem | KanjiItem | GrammarItem } | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await learnerApiFetchOptional(`/api/levels/lessons/${slug}`);
        if (res.ok) setLesson(await res.json());
        else setError(true);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
    setIsCompleted(getCompletedLessons().has(slug));
  }, [slug]);

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleToggleComplete = useCallback(() => {
    setIsCompleted(toggleLessonComplete(slug));
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="h-6 w-48 animate-pulse rounded bg-[#F3F4F6]" />
        <div className="mt-4 h-32 animate-pulse rounded-2xl bg-[#F3F4F6]" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <div className="h-16 animate-pulse rounded-xl bg-[#F3F4F6]" key={i} />)}
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <p className="text-sm text-[#6B7280]">{labels.notFound}</p>
        <Link className="mt-2 inline-block text-sm font-medium text-[#3B82F6]" href={`/${locale}/levels/${levelCode}`}>
          ← {labels.backToLevel}
        </Link>
      </div>
    );
  }

  const vocabs = lesson.contents.filter((c) => c.contentType === "vocabulary");
  const kanjis = lesson.contents.filter((c) => c.contentType === "kanji");
  const grammars = lesson.contents.filter((c) => c.contentType === "grammar");
  const totalItems = lesson.contents.length;

  const sections: Array<{ key: string; icon: string; iconBg: string; label: string; count: number; items: typeof lesson.contents }> = [];
  if (vocabs.length > 0) sections.push({ key: "vocabulary", icon: "📖", iconBg: "bg-[#DBEAFE]", label: labels.vocabSection, count: vocabs.length, items: vocabs });
  if (kanjis.length > 0) sections.push({ key: "kanji", icon: "漢", iconBg: "bg-[#FEF3C7]", label: labels.kanjiSection, count: kanjis.length, items: kanjis });
  if (grammars.length > 0) sections.push({ key: "grammar", icon: "文", iconBg: "bg-[#EDE9FE]", label: labels.grammarSection, count: grammars.length, items: grammars });

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
          <Link className="hover:text-[#3B82F6]" href={`/${locale}/levels`}>{labels.breadcrumbLevels}</Link>
          <ChevronRight />
          <Link className="hover:text-[#3B82F6]" href={`/${locale}/levels/${levelCode}`}>{levelCode}</Link>
          <ChevronRight />
          <span className="font-medium text-[#4B5563]">{labels.pageTitle} {lesson.sortOrder}</span>
        </nav>

        {/* ── Lesson header ── */}
        <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[#D7DFEA] bg-white shadow-sm">
          <div className="h-2 bg-[#2563EB]" />
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-base font-black text-white">
                {lesson.sortOrder}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-black tracking-tight text-[#111827]">{lesson.titleVi}</h1>
                <p className="mt-0.5 text-sm text-[#6B7280]" lang="ja">{lesson.titleJa}</p>
                {lesson.descriptionVi ? (
                  <p className="mt-3 text-sm leading-6 text-[#334155]">{lesson.descriptionVi}</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="grid grid-cols-3 gap-2">
                <LessonMetric label={labels.vocabSection} value={vocabs.length} />
                <LessonMetric label={labels.kanjiSection} value={kanjis.length} />
                <LessonMetric label={labels.grammarSection} value={grammars.length} />
              </div>
              <button
                className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                  isCompleted
                    ? "bg-[#D1FAE5] text-[#065F46]"
                    : "border border-[#CBD5E1] bg-white text-[#475569] hover:border-[#10B981] hover:text-[#065F46]"
                }`}
                onClick={handleToggleComplete}
                type="button"
              >
                {isCompleted ? (
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
                {isCompleted ? labels.completed : labels.markComplete}
              </button>
              <div className="mt-3 flex items-center justify-between text-xs text-[#64748B]">
                <span>{totalItems} {labels.itemsInLesson}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#475569] ring-1 ring-[#E2E8F0]">
                {levelCode}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Collapsible Content Sections ── */}
        {sections.map((section) => (
          <section className="mt-6" key={section.key}>
            <button
              className="mb-3 flex w-full items-center gap-2 text-left text-sm font-semibold text-[#111827]"
              onClick={() => toggleSection(section.key)}
              type="button"
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-md ${section.iconBg} text-xs`}>{section.icon}</span>
              {section.label}
              <span className="text-xs font-normal text-[#9CA3AF]">{section.count}</span>
              <span className="ml-auto text-[10px] font-normal text-[#9CA3AF]">
                {collapsedSections.has(section.key) ? labels.expandSection : labels.collapseSection}
              </span>
              <svg className={`h-4 w-4 text-[#9CA3AF] transition-transform ${collapsedSections.has(section.key) ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>

            {!collapsedSections.has(section.key) ? (
              section.key === "kanji" ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {section.items.map((item) => {
                    const k = item.content as KanjiItem;
                    return (
                      <button
                        className="flex flex-col items-center rounded-xl border border-[#E5E7EB] bg-white p-4 transition-all hover:border-[#F59E0B]/30 hover:shadow-sm"
                        key={k.id}
                        onClick={() => setSelectedItem({ type: "kanji", content: k })}
                        type="button"
                      >
                        <span className="text-3xl font-bold text-[#111827]" lang="ja">{k.character}</span>
                        <span className="mt-1 text-xs text-[#4B5563]">{k.meaningVi}</span>
                        {k.onyomi ? <span className="mt-0.5 text-[10px] text-[#9CA3AF]" lang="ja">{k.onyomi}</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <ul className="space-y-2">
                  {section.items.map((item) => {
                    if (section.key === "vocabulary") {
                      const v = item.content as VocabItem;
                      return (
                        <li key={v.id}>
                          <button
                            className="block w-full rounded-xl border border-[#E5E7EB] bg-white p-4 text-left transition-all hover:border-[#3B82F6]/30 hover:shadow-sm"
                            onClick={() => setSelectedItem({ type: "vocabulary", content: v })}
                            type="button"
                          >
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-bold text-[#111827]" lang="ja">{v.headword}</span>
                              {v.reading ? <span className="text-sm text-[#9CA3AF]" lang="ja">{v.reading}</span> : null}
                            </div>
                            <p className="mt-1 text-sm text-[#4B5563]">{v.senses?.[0]?.meaningVi ?? v.shortMeaningVi ?? ""}</p>
                            {v.senses?.[0]?.pos ? (
                              <span className="mt-1 inline-block rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] text-[#6B7280]">{v.senses[0].pos}</span>
                            ) : null}
                          </button>
                        </li>
                      );
                    }
                    const g = item.content as GrammarItem;
                    return (
                      <li key={g.id}>
                        <button
                          className="block w-full rounded-xl border border-[#E5E7EB] bg-white p-4 text-left transition-all hover:border-[#8B5CF6]/30 hover:shadow-sm"
                          onClick={() => setSelectedItem({ type: "grammar", content: g })}
                          type="button"
                        >
                          <span className="text-base font-semibold text-[#111827]" lang="ja">{g.pattern}</span>
                          <p className="mt-1 text-sm text-[#4B5563]">{g.meaningVi}</p>
                          {g.details?.[0]?.explanationVi ? (
                            <p className="mt-1 text-xs text-[#9CA3AF] line-clamp-2">{g.details[0].explanationVi}</p>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : null}
          </section>
        ))}

        {/* ── Prev / Next lesson nav ── */}
        <div className="mt-8 grid grid-cols-2 gap-3 border-t border-[#E5E7EB] pt-6">
          {lesson.prevLesson ? (
            <Link
              className="group flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white p-3 transition-all hover:border-[#3B82F6]/30 hover:shadow-sm"
              href={`/${locale}/levels/${levelCode}/lessons/${lesson.prevLesson.slug}`}
            >
              <svg className="h-4 w-4 shrink-0 text-[#9CA3AF] group-hover:text-[#3B82F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
              <div className="min-w-0">
                <p className="text-[10px] text-[#9CA3AF]">{labels.prevLesson}</p>
                <p className="truncate text-xs font-medium text-[#111827]">{lesson.prevLesson.titleVi}</p>
              </div>
            </Link>
          ) : <div />}
          {lesson.nextLesson ? (
            <Link
              className="group flex items-center justify-end gap-2 rounded-xl border border-[#E5E7EB] bg-white p-3 text-right transition-all hover:border-[#3B82F6]/30 hover:shadow-sm"
              href={`/${locale}/levels/${levelCode}/lessons/${lesson.nextLesson.slug}`}
            >
              <div className="min-w-0">
                <p className="text-[10px] text-[#9CA3AF]">{labels.nextLesson}</p>
                <p className="truncate text-xs font-medium text-[#111827]">{lesson.nextLesson.titleVi}</p>
              </div>
              <svg className="h-4 w-4 shrink-0 text-[#9CA3AF] group-hover:text-[#3B82F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </Link>
          ) : <div />}
        </div>
      </div>

      {/* ── Sticky bottom bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E7EB] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            <span className="font-medium text-[#111827]">{labels.pageTitle} {lesson.sortOrder}</span>
            <span>·</span>
            <span>{totalItems} {labels.itemsInLesson}</span>
            {isCompleted ? (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-medium text-[#065F46]">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                {labels.completed}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {lesson.nextLesson ? (
              <Link
                className="inline-flex items-center gap-1 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#2563EB]"
                href={`/${locale}/levels/${levelCode}/lessons/${lesson.nextLesson.slug}`}
              >
                {labels.nextLesson}
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
              </Link>
            ) : (
              <Link
                className="inline-flex items-center rounded-lg bg-[#1B2A4A] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0F172A]"
                href={`/${locale}/quiz`}
              >
                {labels.practiceQuiz} →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Inline content modal ── */}
      {selectedItem ? (
        <ContentModal
          item={selectedItem}
          labels={labels}
          locale={locale}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
    </>
  );
}

/* ── Breadcrumb chevron ── */
function ChevronRight() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
}

function LessonMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-center ring-1 ring-[#E2E8F0]">
      <p className="text-lg font-black text-[#111827]">{value}</p>
      <p className="mt-0.5 truncate text-[10px] font-semibold text-[#64748B]">{label}</p>
    </div>
  );
}

/* ── Content Modal (inline detail, no page navigation) ── */
function ContentModal({ item, labels, locale, onClose }: {
  item: { type: string; content: VocabItem | KanjiItem | GrammarItem };
  labels: Labels;
  locale: string;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl sm:m-4 max-h-[85vh] overflow-y-auto">
        <button
          className="absolute right-4 top-4 rounded-full p-1.5 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827]"
          onClick={onClose}
          type="button"
          aria-label={labels.close}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
          </svg>
        </button>

        {item.type === "vocabulary" ? <VocabDetail v={item.content as VocabItem} labels={labels} locale={locale} /> : null}
        {item.type === "kanji" ? <KanjiDetail k={item.content as KanjiItem} labels={labels} locale={locale} /> : null}
        {item.type === "grammar" ? <GrammarDetail g={item.content as GrammarItem} labels={labels} locale={locale} /> : null}
      </div>
    </div>
  );
}

function VocabDetail({ v, labels, locale }: { v: VocabItem; labels: Labels; locale: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <h2 className="text-2xl font-bold text-[#111827]" lang="ja">{v.headword}</h2>
        {v.reading ? <span className="text-base text-[#9CA3AF]" lang="ja">{v.reading}</span> : null}
      </div>
      <div className="mt-4 space-y-3">
        {v.senses?.map((s, i) => (
          <div className="rounded-xl bg-[#F9FAFB] p-3" key={i}>
            <p className="text-sm font-medium text-[#111827]">{labels.meaningLabel}: <span className="font-normal text-[#4B5563]">{s.meaningVi}</span></p>
            {s.pos ? <p className="mt-1 text-xs text-[#9CA3AF]">{labels.posLabel}: {s.pos}</p> : null}
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-[#E5E7EB] pt-3">
        <Link className="text-xs font-medium text-[#3B82F6] hover:underline" href={`/${locale}/dictionary/${v.id}`}>
          {labels.readingLabel} →
        </Link>
      </div>
    </div>
  );
}

function KanjiDetail({ k, labels, locale }: { k: KanjiItem; labels: Labels; locale: string }) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#FEF3C7] text-4xl font-bold text-[#111827]" lang="ja">{k.character}</span>
        <div>
          <p className="text-sm font-medium text-[#111827]">{labels.meaningLabel}: <span className="font-normal text-[#4B5563]">{k.meaningVi}</span></p>
          {k.onyomi ? <p className="mt-1 text-xs text-[#6B7280]">{labels.onyomiLabel}: <span lang="ja">{k.onyomi}</span></p> : null}
          {k.kunyomi ? <p className="mt-0.5 text-xs text-[#6B7280]">{labels.kunyomiLabel}: <span lang="ja">{k.kunyomi}</span></p> : null}
        </div>
      </div>
      {k.examples?.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-[#6B7280]">{labels.examplesLabel}</p>
          <ul className="space-y-1.5">
            {k.examples.map((ex, i) => (
              <li className="rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm" key={i}>
                <span className="font-medium text-[#111827]" lang="ja">{ex.word}</span>
                {ex.reading ? <span className="ml-2 text-xs text-[#9CA3AF]" lang="ja">{ex.reading}</span> : null}
                {ex.meaningVi ? <span className="ml-2 text-xs text-[#4B5563]">— {ex.meaningVi}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-4 border-t border-[#E5E7EB] pt-3">
        <Link className="text-xs font-medium text-[#3B82F6] hover:underline" href={`/${locale}/kanji/${k.id}`}>
          {labels.readingLabel} →
        </Link>
      </div>
    </div>
  );
}

function GrammarDetail({ g, labels, locale }: { g: GrammarItem; labels: Labels; locale: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-[#111827]" lang="ja">{g.pattern}</h2>
      <p className="mt-2 text-sm text-[#4B5563]">{g.meaningVi}</p>
      {g.details?.length > 0 ? (
        <div className="mt-4 space-y-2">
          {g.details.map((d, i) => (
            d.explanationVi ? (
              <div className="rounded-xl bg-[#F9FAFB] p-3 text-sm leading-relaxed text-[#4B5563]" key={i}>
                {d.explanationVi}
              </div>
            ) : null
          ))}
        </div>
      ) : null}
      <div className="mt-4 border-t border-[#E5E7EB] pt-3">
        <Link className="text-xs font-medium text-[#3B82F6] hover:underline" href={`/${locale}/grammar/${g.id}`}>
          {labels.readingLabel} →
        </Link>
      </div>
    </div>
  );
}
