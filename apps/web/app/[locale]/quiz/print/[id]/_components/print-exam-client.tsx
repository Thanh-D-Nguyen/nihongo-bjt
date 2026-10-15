"use client";

import { useEffect, useState } from "react";
import type viMessages from "../../../../../../messages/vi.json";

interface PrintableOption {
  key: string;
  text: string;
}

interface PrintableQuestion {
  audioScript?: string | null;
  correctKey: string;
  explanationVi: string;
  id: string;
  imageAlt?: string | null;
  imageUrl?: string | null;
  number: number;
  options: PrintableOption[];
  prompt: string;
  scenario?: string | null;
}

interface PrintableSection {
  code: string;
  displayOrder: number;
  id: string;
  questions: PrintableQuestion[];
  titleJa?: string | null;
  titleVi: string;
}

interface PrintableExam {
  id: string;
  level?: string | null;
  sections: PrintableSection[];
  slug: string;
  timeLimitSeconds?: number | null;
  titleJa?: string | null;
  titleVi: string;
  totalQuestions: number;
  type: string;
}

type QuizLabels = typeof viMessages.quiz;

const BJT_PARTS = [
  { code: "LC", title: "officialPartListening", instruction: "officialSection1", timeMinutes: 45 },
  { code: "LR", title: "officialPartListeningReading", instruction: "officialSection2", timeMinutes: 30 },
  { code: "RC", title: "officialPartReading", instruction: "officialSection3", timeMinutes: 30 }
] as const;

const LEVEL_SCORE_TABLE = [
  { level: "J1+", range: "600–800" },
  { level: "J1", range: "530–599" },
  { level: "J2", range: "420–529" },
  { level: "J3", range: "320–419" },
  { level: "J4", range: "200–319" },
  { level: "J5", range: "0–199" }
] as const;

export function PrintExamClient({
  examId,
  labels,
  locale
}: {
  examId: string;
  labels: QuizLabels;
  locale: string;
}) {
  const [exam, setExam] = useState<PrintableExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const isJa = locale === "ja";
  const copy = labels.print;

  useEffect(() => {
    let cancelled = false;
    async function loadExam() {
      setLoading(true);
      setHasError(false);
      try {
        const response = await fetch(`/api/quiz/templates/${encodeURIComponent(examId)}/printable`, {
          cache: "no-store",
          credentials: "include"
        });
        if (!response.ok) throw new Error("printable exam unavailable");
        const result = (await response.json()) as PrintableExam;
        if (!cancelled) setExam(result);
      } catch {
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadExam();
    return () => {
      cancelled = true;
    };
  }, [examId, retryKey]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4" aria-busy="true">
        <p className="text-lg text-muted" role="status">{copy.loading}</p>
      </main>
    );
  }

  if (hasError || !exam) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-md text-base text-ink" role="alert">{copy.loadError}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button className="min-h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => setRetryKey((key) => key + 1)} type="button">
            {copy.retry}
          </button>
          <button className="min-h-11 rounded-xl border border-ink/15 px-5 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => window.history.back()} type="button">
            {copy.back}
          </button>
        </div>
      </main>
    );
  }

  const totalMinutes = exam.timeLimitSeconds ? Math.ceil(exam.timeLimitSeconds / 60) : 105;
  const questions = exam.sections.flatMap((section) => section.questions);
  const groupedParts = BJT_PARTS.map((part) => ({
    ...part,
    sections: exam.sections.filter((section) => section.code.startsWith(part.code))
  })).filter((part) => part.sections.length > 0);
  const ungroupedSections = exam.sections.filter(
    (section) => !BJT_PARTS.some((part) => section.code.startsWith(part.code))
  );

  return (
    <>
      <nav className="print:hidden sticky top-0 z-50 flex items-center justify-between border-b border-ink/10 bg-surface px-4 py-3 shadow-sm" aria-label={copy.printButton}>
        <button className="min-h-11 rounded-lg px-2 text-sm font-medium text-muted hover:text-ink focus-visible:outline focus-visible:outline-2" onClick={() => window.history.back()} type="button">
          ← {copy.back}
        </button>
        <div className="flex items-center gap-3">
          <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
            <input checked={showAnswerKey} className="h-4 w-4 accent-ink" onChange={(event) => setShowAnswerKey(event.target.checked)} type="checkbox" />
            {copy.showAnswers}
          </label>
          <button className="min-h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-surface transition hover:bg-ink/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => window.print()} type="button">
            {copy.printButton}
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-[210mm] bg-surface text-ink print:mx-0 print:max-w-none">
        <section className="print:page-break-after-always px-6 py-10 text-center sm:px-8 sm:py-12">
          <div className="mx-auto max-w-lg rounded-2xl border-2 border-ink/75 p-6 sm:p-12">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted">{copy.coverKicker}</p>
            <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{copy.examTitle}</h1>
            <h2 className="mb-1 text-lg text-muted">{copy.practiceTitle}</h2>
            <p className="mb-6 text-lg font-semibold">
              {isJa ? exam.titleJa || exam.titleVi : exam.titleVi}
              {!isJa && exam.titleJa ? <span className="mt-1 block text-base font-normal text-muted">{exam.titleJa}</span> : null}
            </p>

            <dl className="space-y-2 border-t border-ink/15 pt-5 text-left text-sm">
              {exam.level ? <div className="flex justify-between gap-4"><dt className="font-medium">{copy.level}</dt><dd>{exam.level}</dd></div> : null}
              <div className="flex justify-between gap-4"><dt className="font-medium">{copy.questionCount}</dt><dd>{exam.totalQuestions} {copy.questionUnit}</dd></div>
              <div className="flex justify-between gap-4"><dt className="font-medium">{copy.timeLimit}</dt><dd>{totalMinutes} {copy.minuteUnit}</dd></div>
              <div className="flex justify-between gap-4"><dt className="font-medium">{copy.structure}</dt><dd>{exam.sections.length} {copy.sectionCount}</dd></div>
            </dl>
          </div>

          <div className="mx-auto mt-8 max-w-lg text-left">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">{copy.structure}</h3>
            <table className="w-full border border-ink/20 text-sm">
              <thead><tr className="bg-paper"><th className="border border-ink/15 px-3 py-2 text-left">{copy.part}</th><th className="border border-ink/15 px-3 py-2 text-left">{copy.section}</th><th className="border border-ink/15 px-3 py-2 text-center">{copy.questionCount}</th></tr></thead>
              <tbody>
                {exam.sections.map((section) => <tr key={section.id}><td className="border border-ink/15 px-3 py-2">{copy.partNames[section.code.slice(0, 2) as keyof typeof copy.partNames] ?? section.code.slice(0, 2)}</td><td className="border border-ink/15 px-3 py-2">{isJa ? section.titleJa || section.titleVi : section.titleVi}</td><td className="border border-ink/15 px-3 py-2 text-center">{section.questions.length}</td></tr>)}
                <tr className="bg-paper font-semibold"><td className="border border-ink/15 px-3 py-2" colSpan={2}>{copy.total}</td><td className="border border-ink/15 px-3 py-2 text-center">{exam.totalQuestions}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="mx-auto mt-6 max-w-lg space-y-2 text-left text-sm text-muted">
            <p className="font-semibold text-ink">{copy.instructions}:</p>
            <ul className="list-disc space-y-1 pl-5"><li>{copy.chooseAnswer}</li><li>{copy.independentNotice}</li><li>{copy.listeningNotice}</li></ul>
          </div>
        </section>

        {groupedParts.map((part) => (
          <section key={part.code}>
            <header className="print:page-break-before-always border-b-2 border-ink/75 px-6 pb-4 pt-8 sm:px-8">
              <div className="flex items-baseline justify-between gap-4"><h2 className="text-xl font-bold">{labels[part.title]}</h2><span className="text-sm text-muted">~{part.timeMinutes} {copy.minuteUnit}</span></div>
              <p className="mt-1 text-sm text-muted">{labels[part.instruction]}</p>
            </header>
            {part.sections.map((section) => (
              <div className="px-6 py-6 sm:px-8" key={section.id}>
                <div className="mb-4 border-b border-ink/15 pb-2"><h3 className="text-base font-semibold">{labels.sectionNameLabels[section.code as keyof typeof labels.sectionNameLabels] ?? (isJa ? section.titleJa || section.titleVi : section.titleVi)} <span className="ml-2 text-sm font-normal text-muted">({section.questions.length} {copy.questionUnit})</span></h3></div>
                {section.questions.map((question) => (
                  <article className="mb-6 break-inside-avoid print:break-inside-avoid" key={question.id}>
                    <div className="mb-2 flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-surface">{question.number}</span><div className="min-w-0 flex-1">{question.scenario ? <p className="mb-1 text-sm italic text-muted">{question.scenario}</p> : null}<p className="text-base leading-relaxed">{question.prompt}</p></div></div>
                    {question.imageUrl ? <img alt={question.imageAlt || ""} className="mb-3 ml-11 max-h-64 max-w-[calc(100%-2.75rem)] object-contain" src={question.imageUrl} /> : null}
                    {question.audioScript ? <p className="mb-3 ml-11 whitespace-pre-wrap rounded-lg bg-paper p-3 text-sm leading-relaxed">{question.audioScript}</p> : null}
                    <div className="ml-11 mt-2 grid grid-cols-1 gap-1.5">
                      {question.options.map((option) => <div className={`flex items-start gap-2 rounded px-2 py-1 text-sm ${showAnswerKey && question.correctKey === option.key ? "border border-positive/30 bg-positive/10" : ""}`} key={option.key}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink/30 text-xs font-medium">{option.key}</span><span className="leading-relaxed">{option.text}</span></div>)}
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </section>
        ))}

        {ungroupedSections.length ? <section className="print:page-break-before-always px-6 py-8 sm:px-8">{ungroupedSections.map((section) => <div key={section.id} className="mb-8"><h2 className="mb-4 border-b border-ink/15 pb-2 text-lg font-bold">{isJa ? section.titleJa || section.titleVi : section.titleVi}</h2>{section.questions.map((question) => <article className="mb-6 break-inside-avoid" key={question.id}><p className="mb-2 font-medium">{question.number}. {question.prompt}</p>{question.options.map((option) => <p className="ml-4 py-1 text-sm" key={option.key}>{option.key}. {option.text}</p>)}</article>)}</div>)}</section> : null}

        <section className="print:page-break-before-always px-6 py-8 sm:px-8">
          <h2 className="mb-4 border-b-2 border-ink/75 pb-2 text-xl font-bold">{copy.answerSheet}</h2>
          <p className="mb-6 text-sm text-muted">{copy.answerSheetHint}</p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5 sm:gap-4">
            {questions.map((question) => <div className="flex items-center gap-2 rounded border border-ink/15 px-2 py-1.5" key={question.id}><span className="w-7 text-right font-bold">{question.number}.</span><div className="flex gap-1.5">{["A", "B", "C", "D"].map((key) => <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${showAnswerKey && question.correctKey === key ? "border-positive bg-positive text-surface" : "border-ink/30"}`} key={key}>{key}</span>)}</div></div>)}
          </div>
        </section>

        <section className="print:page-break-before-always px-6 py-8 sm:px-8">
          <h2 className="mb-4 border-b-2 border-ink/75 pb-2 text-xl font-bold">{copy.scoreTitle}</h2>
          <p className="mb-4 text-sm text-muted">{copy.scoreDescription}</p>
          <table className="w-full border border-ink/20 text-sm">
            <thead><tr className="bg-paper"><th className="border border-ink/15 px-4 py-2 text-left">{copy.rank}</th><th className="border border-ink/15 px-4 py-2 text-left">{copy.scoreRange}</th><th className="border border-ink/15 px-4 py-2 text-left">{copy.description}</th></tr></thead>
            <tbody>{LEVEL_SCORE_TABLE.map((row) => <tr className={exam.level?.includes(row.level) ? "bg-accent/10 font-medium" : ""} key={row.level}><td className="border border-ink/15 px-4 py-2 font-semibold">{row.level}</td><td className="border border-ink/15 px-4 py-2">{row.range}</td><td className="border border-ink/15 px-4 py-2">{copy.levelDescriptions[row.level as keyof typeof copy.levelDescriptions]}</td></tr>)}</tbody>
          </table>
          <footer className="mt-6 text-center text-xs text-muted"><p>{copy.footerTitle}</p><p>{copy.footerDisclaimer}</p></footer>
        </section>
      </main>

      <style jsx global>{`@media print { body { font-size: 11pt; line-height: 1.5; color: #000; } .print\\:hidden { display: none !important; } .print\\:page-break-before-always { page-break-before: always; } .print\\:page-break-after-always { page-break-after: always; } .print\\:break-inside-avoid { break-inside: avoid; } .print\\:max-w-none { max-width: none; } .print\\:mx-0 { margin-left: 0; margin-right: 0; } @page { margin: 15mm 12mm; size: A4; } }`}</style>
    </>
  );
}
