"use client";

import { Card, CardContent, PageHeader } from "@nihongo-bjt/ui";
import { FormEvent, useEffect, useState } from "react";

import { AnnotatedJapaneseText } from "../../../../components/reading-assist/annotated-japanese-text";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { QuizResultsBreakdown } from "./quiz-results-breakdown";

interface Template {
  id: string;
  titleVi: string;
}

interface SessionPayload {
  correctCount: number;
  estimatedBjtBand: string | null;
  estimatedScore: number | null;
  id: string;
  status: string;
  totalQuestions: number;
}

interface BreakdownResponse {
  sessionId: string;
  testId: string;
  testTitleVi: string;
  testTitleJa?: string | null;
  estimatedScore: number | null;
  estimatedBjtBand: string | null;
  breakdown: Array<{
    questionId: string;
    prompt: string;
    selectedOption: string;
    isCorrect: boolean;
    explanationVi: string;
    remediationCardId?: string | null;
  }>;
}

interface QuestionPayload {
  question?: {
    id: string;
    options: Array<{ optionKey: string; text: string }>;
    prompt: string;
    skillTag: string;
  };
  session: SessionPayload;
}

interface QuizLabels {
  eyebrow: string;
  anotherRound: string;
  estimatedScoreCaveat: string;
  bandLabel: string;
  coachJ1: string;
  coachJ2: string;
  coachJ3: string;
  coachJ4: string;
  coachJ5: string;
  completedTitle: string;
  correctSummary: string;
  empty: string;
  error: string;
  load: string;
  noQuestion: string;
  practiceModeBadge: string;
  placeholder: string;
  scoreLabel: string;
  start: string;
  subtitle: string;
  title: string;
  breakdown: {
    resultsTitle: string;
    estimatedScoreLabel: string;
    estimatedBandLabel: string;
    breakdownTitle: string;
    correctLabel: string;
    wrongLabel: string;
    explanationLabel: string;
    selectedOptionLabel: string;
    addToFlashcardAction: string;
    addToFlashcardSuccess: string;
    addToFlashcardError: string;
    loadingText: string;
    errorText: string;
  };
  readingAssist: {
    sectionTitle: string;
    annotated: {
      addCardAction: string;
      addCardError: string;
      addCardNoDeck: string;
      addCardSuccess: string;
      bottomSheetClose: string;
      errorHttp: string;
      errorNetwork: string;
      errorTimeout: string;
      furiganaLabel: string;
      lexemeLine: string;
      loadingText: string;
      meaningLabel: string;
      posLabel: string;
      retryAction: string;
      serviceUnavailable: string;
    };
  };
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function coachForBand(
  band: string | null,
  labels: Pick<QuizLabels, "coachJ1" | "coachJ2" | "coachJ3" | "coachJ4" | "coachJ5">
): string {
  switch (band) {
    case "J1": {
      return labels.coachJ1;
    }
    case "J2": {
      return labels.coachJ2;
    }
    case "J3": {
      return labels.coachJ3;
    }
    case "J4": {
      return labels.coachJ4;
    }
    default: {
      return labels.coachJ5;
    }
  }
}

export function QuizClient({ labels }: { labels: QuizLabels }) {
  const [error, setError] = useState(false);
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [results, setResults] = useState<SessionPayload | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownResponse | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const { userId } = useKeycloakAuth();

  useEffect(() => {
    void loadTemplates();
  }, []);

  useEffect(() => {
    if (results && userId && !breakdown) {
      void loadBreakdown(results.id, userId);
    }
  }, [results, userId, breakdown]);

  async function loadTemplates() {
    setError(false);
    try {
      const response = await fetch(`${apiBaseUrl}/api/quiz/templates`);
      if (!response.ok) {
        throw new Error("Template request failed");
      }
      setTemplates((await response.json()) as Template[]);
    } catch {
      setError(true);
    }
  }

  async function loadBreakdown(sessionId: string, uid: string) {
    setBreakdownLoading(true);
    try {
      const response = await learnerApiFetch(
        `/api/quiz/session/${sessionId}/results/breakdown?userId=${encodeURIComponent(uid)}`
      );
      if (!response.ok) {
        throw new Error("Breakdown request failed");
      }
      setBreakdown((await response.json()) as BreakdownResponse);
    } catch {
      setError(true);
    } finally {
      setBreakdownLoading(false);
    }
  }

  async function start(event: FormEvent<HTMLFormElement>, testId: string) {
    event.preventDefault();
    const uid = userId;
    if (!uid) {
      return;
    }
    setError(false);
    setResults(null);
    setBreakdown(null);
    try {
      const started = await learnerApiFetch("/api/quiz/start", {
        body: JSON.stringify({ testId, userId: uid }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!started.ok) {
        throw new Error("Start quiz failed");
      }
      const session = (await started.json()) as { id: string };
      const next = await learnerApiFetch(
        `/api/quiz/session/${session.id}/question?userId=${encodeURIComponent(uid)}`
      );
      setQuestion((await next.json()) as QuestionPayload);
    } catch {
      setError(true);
    }
  }

  async function answer(optionKey: string) {
    const uid = userId;
    if (!question?.question || !uid) {
      return;
    }

    setError(false);
    try {
      const response = await learnerApiFetch(`/api/quiz/session/${question.session.id}/answer`, {
        body: JSON.stringify({ optionKey, questionId: question.question.id, userId: uid }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        throw new Error("Answer request failed");
      }
      const data = (await response.json()) as { session: SessionPayload };
      if (data.session.status === "completed") {
        setResults(data.session);
        setQuestion(null);
        return;
      }
      const next = await learnerApiFetch(
        `/api/quiz/session/${data.session.id}/question?userId=${encodeURIComponent(uid)}`
      );
      setQuestion((await next.json()) as QuestionPayload);
    } catch {
      setError(true);
    }
  }

  return (
    <main className="w-full space-y-4 pb-10 sm:space-y-6 sm:pb-12">
      <PageHeader description={labels.subtitle} eyebrow={labels.eyebrow} title={labels.title} />
      <div className="flex items-center">
        <span className="inline-flex rounded-full border border-ink/15 bg-paper px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink sm:text-xs">
          {labels.practiceModeBadge}
        </span>
      </div>
      <Card className="border-ink/10 shadow-sm">
        <CardContent className="space-y-4 p-3 sm:space-y-6 sm:p-6">
          {error ? (
            <p className="text-sm text-sakura" role="alert">
              {labels.error}
            </p>
          ) : null}
          {templates.length === 0 ? <p className="text-sm text-muted">{labels.empty}</p> : null}
          <div className="flex flex-col gap-2.5 sm:gap-3">
            {templates.map((template) => (
              <form
                className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-paper/50 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                key={template.id}
                onSubmit={(event) => void start(event, template.id)}
              >
                <strong className="text-sm font-semibold text-ink">{template.titleVi}</strong>
                <button
                  className="w-full rounded-xl border border-ink/15 bg-ink px-3 py-2 text-sm font-semibold text-surface hover:bg-ink/90 disabled:opacity-50 sm:w-auto sm:px-4"
                  disabled={!userId}
                  type="submit"
                >
                  {labels.start}
                </button>
              </form>
            ))}
          </div>
          {results ? (
            <>
              <article className="rounded-xl border border-ink/10 bg-surface p-4">
                <h2 className="text-base font-semibold text-ink">{labels.completedTitle}</h2>
                <p className="mt-2 text-sm text-muted">
                  {labels.correctSummary
                    .replace("{correct}", String(results.correctCount))
                    .replace("{total}", String(results.totalQuestions))}
                </p>
                <p className="mt-2 text-sm">
                  {labels.scoreLabel} <strong>{results.estimatedScore ?? "—"}</strong>
                </p>
                <p className="mt-1 text-xs text-muted">{labels.estimatedScoreCaveat}</p>
                <p className="text-sm">
                  {labels.bandLabel} <strong>{results.estimatedBjtBand ?? "—"}</strong>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink" role="status">
                  {coachForBand(results.estimatedBjtBand, labels)}
                </p>
                <p className="mt-2 text-xs text-muted">{labels.anotherRound}</p>
              </article>
              {breakdownLoading ? (
                <p className="text-sm text-muted">{labels.breakdown.loadingText}</p>
              ) : breakdown ? (
                <QuizResultsBreakdown breakdown={breakdown} labels={labels.breakdown} userId={userId} />
              ) : null}
            </>
          ) : null}
          {question?.question ? (
            <QuizQuestionPanel labels={labels} onAnswer={answer} question={question} userId={userId} />
          ) : null}
          {question && !question.question && !results ? (
            <p className="text-sm text-muted" role="status">
              {labels.noQuestion}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

export function QuizQuestionPanel({
  labels,
  onAnswer,
  question,
  userId
}: {
  labels: QuizLabels;
  onAnswer: (optionKey: string) => void | Promise<void>;
  question: QuestionPayload;
  userId: string | null;
}) {
  if (!question.question) {
    return null;
  }

  return (
    <article className="rounded-xl border border-ink/10 bg-surface p-3 sm:p-4">
      <strong className="block text-base text-ink">{labels.readingAssist.sectionTitle}</strong>
      <div className="mt-2">
        {userId ? (
          <AnnotatedJapaneseText
            analyzePath="/api/reading-assist/analyze"
            analyticsPath="/api/reading-assist/analytics"
            displayMode="hover"
            labels={labels.readingAssist.annotated}
            quizSessionId={question.session.id}
            text={question.question.prompt}
            userId={userId}
          />
        ) : (
          <p className="text-sm text-ink">{question.question.prompt}</p>
        )}
      </div>
      <small className="mt-1 block text-xs text-muted">{question.question.skillTag}</small>
      <div className="mt-3 flex flex-col gap-2 sm:mt-4">
        {question.question.options.map((option) => (
          <button
            className="rounded-xl border border-ink/12 bg-paper/80 px-3 py-2 text-left text-sm text-ink hover:bg-paper sm:py-2.5"
            key={option.optionKey}
            onClick={() => void onAnswer(option.optionKey)}
            type="button"
          >
            {option.optionKey}. {option.text}
          </button>
        ))}
      </div>
    </article>
  );
}
