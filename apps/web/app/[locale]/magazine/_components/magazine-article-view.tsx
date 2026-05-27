"use client";

import { BackNavigation } from "../../_components/back-navigation";
import { VocabExpressionList, type VocabExpression } from "../../_components/vocab-expression-list";
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

  const generatedSets = content.generatedSets as
    | { mainNumbers: number[]; bonusNumbers?: number[]; score?: number }[]
    | undefined;
  if (generatedSets?.length) {
    const sentence = content.japaneseSentence as { textJp?: string; textVi?: string; reading?: string } | undefined;
    return (
      <div className="space-y-4">
        <div className="grid gap-3">
          {generatedSets.map((set, index) => (
            <div key={index} className="rounded-2xl border border-border/30 bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                {set.mainNumbers.map((number) => (
                  <span key={number} className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
                    {number}
                  </span>
                ))}
                {set.bonusNumbers?.length ? (
                  <span className="text-xs text-muted-foreground">+ {set.bonusNumbers.join(", ")}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {sentence?.textJp && (
          <div className="rounded-2xl border border-border/30 bg-accent/20 p-4">
            <p className="text-base leading-[1.8] text-foreground">{sentence.textJp}</p>
            {sentence.reading && <p className="mt-1 text-xs text-muted-foreground">{sentence.reading}</p>}
            {sentence.textVi && <p className="mt-2 text-sm italic text-muted-foreground">{sentence.textVi}</p>}
          </div>
        )}
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

  // Convert VocabItems to VocabExpression format for shared component
  const expressions: VocabExpression[] = vocabItems.map((item) => ({
    word: item.wordJp,
    reading: item.reading ?? "",
    meaning: item.meaningVi,
    jlptLevel: item.jlptLevel,
    example: item.exampleJp,
    exampleMeaning: item.exampleVi,
  }));

  const expressionLabels = {
    addToFlashcard: t.addToFlashcard ?? "Thêm flashcard",
    addedToFlashcard: t.addedToFlashcard ?? "Đã thêm!",
    example: t.example ?? "Ví dụ",
    exampleMeaning: t.exampleMeaning ?? "Nghĩa",
    listenPronunciation: t.listenPronunciation ?? "Nghe phát âm",
    meaning: t.meaning ?? "Nghĩa",
    reading: t.reading ?? "Đọc",
    tapToExpand: t.tapToExpand ?? "Nhấn để mở rộng",
    usageNote: t.usageNote ?? "Ghi chú",
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5 px-4 pb-28 pt-6 sm:px-6">
      <article className="mx-auto max-w-3xl">
        <BackNavigation href={`/${locale}/magazine`} label="Magazine" />

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
        {expressions.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-base">📚</span>
                {t.vocabSection}
              </h2>
              <span className="text-xs font-medium text-muted-foreground">{expressionLabels.tapToExpand}</span>
            </div>
            <VocabExpressionList
              expressions={expressions}
              gradient="from-indigo-500 to-purple-600"
              labels={expressionLabels}
            />
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
