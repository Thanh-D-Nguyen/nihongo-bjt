"use client";

import Link from "next/link";
import { MiniQuiz } from "./mini-quiz";

/* ─── Types ─── */

interface VocabItem {
  wordJp: string;
  reading?: string;
  meaningVi: string;
  jlptLevel?: string;
  exampleJp?: string;
  exampleVi?: string;
}

interface QuizOption {
  label: string;
  isCorrect: boolean;
}

interface QuizItem {
  questionJp: string;
  questionVi?: string;
  options: QuizOption[];
  explanationJp?: string;
  explanationVi?: string;
}

interface MagazineArticle {
  id: string;
  slug: string;
  widgetKind: string;
  titleJp: string;
  titleVi: string;
  summaryJp?: string;
  summaryVi?: string;
  jlptLevel?: string;
  publishDate: string;
  contentJson?: Record<string, unknown>;
  vocabItems?: VocabItem[];
  vocabWords?: { word: string; reading?: string; meaning?: string }[];
  quizzes?: QuizItem[];
}

interface MagazineTranslations {
  vocabSection: string;
  quizSection: string;
  quizProgress: string;
  quizNext: string;
  quizResult: string;
  quizComplete: string;
  quizScore: string;
  quizPerfect: string;
  quizGood: string;
  quizTryAgain: string;
  readMore: string;
  [key: string]: string;
}

/* ─── Helpers ─── */

function formatDateVi(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/* ─── Content Renderer ─── */

function ContentBody({ content, kind }: { content: Record<string, unknown>; kind: string }) {
  const paragraphsJp = content.paragraphsJp as string[] | undefined;
  const paragraphsVi = content.paragraphsVi as string[] | undefined;

  if (paragraphsJp?.length) {
    return (
      <div className="space-y-6">
        {paragraphsJp.map((jp, i) => (
          <div key={i} className="rounded-xl border border-border/30 bg-card/50 p-4 transition-colors hover:border-border/60">
            <p className="text-base leading-[1.85] text-foreground sm:text-lg">{jp}</p>
            {paragraphsVi?.[i] && (
              <p className="mt-2 border-t border-border/20 pt-2 text-sm italic leading-relaxed text-muted-foreground">
                {paragraphsVi[i]}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  const zodiacFortunes = content.zodiacFortunes as
    | { sign: string; fortuneJp: string; fortuneVi: string }[]
    | undefined;
  if (zodiacFortunes?.length) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {zodiacFortunes.map((z) => (
          <div
            key={z.sign}
            className="group rounded-2xl border border-border/30 bg-gradient-to-br from-violet-500/5 to-transparent p-4 transition-all duration-200 hover:border-border/60 hover:shadow-sm"
          >
            <span className="text-sm font-bold text-primary">{z.sign}</span>
            <p className="mt-2 text-sm leading-[1.8] text-foreground">{z.fortuneJp}</p>
            <p className="mt-1 text-xs italic text-muted-foreground">{z.fortuneVi}</p>
          </div>
        ))}
      </div>
    );
  }

  const luckyNumbers = content.luckyNumbers as number[] | undefined;
  if (luckyNumbers?.length) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">ラッキーナンバー:</span>
        {luckyNumbers.map((n, i) => (
          <span
            key={i}
            className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-lg font-bold text-primary shadow-sm"
          >
            {n}
          </span>
        ))}
      </div>
    );
  }

  const dialogue = content.dialogue as
    | { speaker: string; textJp: string; textVi?: string }[]
    | undefined;
  if (dialogue?.length) {
    return (
      <div className="space-y-4">
        {dialogue.map((line, i) => (
          <div key={i} className="rounded-2xl border border-border/30 bg-accent/20 p-4 transition-colors hover:border-border/50">
            <span className="inline-flex rounded-lg bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              {line.speaker}
            </span>
            <p className="mt-2 text-base leading-[1.8] text-foreground">{line.textJp}</p>
            {line.textVi && (
              <p className="mt-1 text-sm italic text-muted-foreground">{line.textVi}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return null;
}

/* ─── Main Component ─── */

export function MagazineArticleView({
  article,
  locale,
  t,
}: {
  article: MagazineArticle;
  locale: string;
  t: MagazineTranslations;
}) {
  const vocabItems: VocabItem[] =
    article.vocabItems ??
    (article.vocabWords?.map((w) => ({
      wordJp: w.word,
      reading: w.reading,
      meaningVi: w.meaning ?? "",
    })) ||
      []);

  const quizzes = article.quizzes ?? [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5 px-4 pb-28 pt-6 sm:px-6">
      <article className="mx-auto max-w-3xl">
        {/* Back nav */}
        <Link
          href={`/${locale}/magazine`}
          className="mb-6 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Magazine
        </Link>

        {/* ─── Header ─── */}
        <header className="mb-10 rounded-3xl bg-gradient-to-br from-primary/5 via-accent/5 to-transparent p-6 sm:p-8">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <time dateTime={article.publishDate}>{formatDateVi(article.publishDate)}</time>
            {article.jlptLevel && (
              <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
                {article.jlptLevel}
              </span>
            )}
          </div>

          <h1
            className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            style={{ lineHeight: 1.8 }}
          >
            {article.titleJp}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">{article.titleVi}</p>

          {article.summaryJp && (
            <div className="mt-5 rounded-2xl border border-border/30 bg-card/80 p-4 backdrop-blur-sm">
              <p className="text-sm leading-[1.85] text-foreground/90">{article.summaryJp}</p>
            </div>
          )}
        </header>

        {/* ─── Content Body ─── */}
        {article.contentJson && (
          <section className="mb-10">
            <ContentBody content={article.contentJson} kind={article.widgetKind} />
          </section>
        )}

        {/* ─── Vocabulary Section ─── */}
        {vocabItems.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-foreground">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-base">📚</span>
              {t.vocabSection}
            </h2>
            <div className="grid gap-3">
              {vocabItems.map((item, i) => (
                <div
                  key={i}
                  className="group rounded-2xl border border-border/30 bg-card p-4 transition-all duration-200 hover:border-border/60 hover:shadow-sm"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-foreground" style={{ lineHeight: 1.8 }}>
                      {item.wordJp}
                    </span>
                    {item.reading && (
                      <span className="text-sm text-muted-foreground">({item.reading})</span>
                    )}
                    {item.jlptLevel && (
                      <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {item.jlptLevel}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-foreground/80">{item.meaningVi}</p>
                  {item.exampleJp && (
                    <div className="mt-3 rounded-xl bg-accent/30 px-4 py-3">
                      <p className="text-sm leading-[1.8] text-foreground">{item.exampleJp}</p>
                      {item.exampleVi && (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          {item.exampleVi}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Mini Quiz Section ─── */}
        {quizzes.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-foreground">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-base">🧠</span>
              {t.quizSection}
            </h2>
            <MiniQuiz quizzes={quizzes} articleSlug={article.slug} t={t} />
          </section>
        )}
      </article>
    </main>
  );
}
