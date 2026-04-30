"use client";

import { Card, CardContent, PageHeader } from "@nihongo-bjt/ui";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";

type Q = {
  id: string;
  options: { optionKey: string; text: string }[];
  prompt: string;
  skillTag: string;
};

export type OnboardingLabels = {
  eyebrow: string;
  band: string;
  correct: string;
  error: string;
  loadState: string;
  resultTitle: string;
  score: string;
  startPlacement: string;
  stepWelcome: string;
  submit: string;
  subtitle: string;
  title: string;
  userId: string;
};

export function OnboardingClient({ labels }: { labels: OnboardingLabels }) {
  const { userId } = useKeycloakAuth();
  const [step, setStep] = useState<"form" | "placement" | "result">("form");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<{
    correctCount: number;
    estimatedBjtBand: string | null;
    estimatedScore?: number;
  } | null>(null);

  const loadState = useCallback(async () => {
    const uid = userId;
    if (!uid) {
      return;
    }
    setError(null);
    try {
      const r = await learnerApiFetch(`/api/learner/onboarding?userId=${encodeURIComponent(uid)}`);
      if (!r.ok) {
        throw new Error("load");
      }
      const row = (await r.json()) as { currentStep: string };
      if (row.currentStep === "completed") {
        setStep("result");
        setSummary({ correctCount: 0, estimatedBjtBand: null });
      }
    } catch {
      setError(labels.error);
    }
  }, [labels.error, userId]);

  async function startPlacement() {
    const uid = userId;
    if (!uid) {
      return;
    }
    setError(null);
    try {
      const r = await learnerApiFetch("/api/learner/placement/start", {
        body: JSON.stringify({ userId: uid }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!r.ok) {
        throw new Error("start");
      }
      const data = (await r.json()) as { questions: Q[]; sessionId: string };
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setAnswers({});
      setStep("placement");
    } catch {
      setError(labels.error);
    }
  }

  async function submitPlacement(e: FormEvent) {
    e.preventDefault();
    const uid = userId;
    if (!uid || !sessionId) {
      return;
    }
    setError(null);
    try {
      const r = await learnerApiFetch("/api/learner/placement/submit", {
        body: JSON.stringify({ answers, sessionId, userId: uid }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!r.ok) {
        throw new Error("submit");
      }
      const data = (await r.json()) as {
        alreadyCompleted?: boolean;
        correctCount: number;
        estimatedBjtBand: string;
        estimatedScore?: number;
      };
      setSummary({
        correctCount: data.correctCount,
        estimatedBjtBand: data.estimatedBjtBand,
        estimatedScore: data.estimatedScore
      });
      setStep("result");
    } catch {
      setError(labels.error);
    }
  }

  useEffect(() => {
    void loadState();
  }, [loadState]);

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader description={labels.subtitle} eyebrow={labels.eyebrow} title={labels.title} />
      <Card className="border-ink/10 shadow-sm">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-end gap-3">
            <button
              className="rounded-xl border border-ink/15 bg-paper px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5"
              type="button"
              onClick={() => void loadState()}
            >
              {labels.loadState}
            </button>
            <button
              className="rounded-xl border border-ink/15 bg-ink px-4 py-2 text-sm font-semibold text-surface hover:bg-ink/90 disabled:opacity-50"
              disabled={!userId}
              onClick={() => void startPlacement()}
              type="button"
            >
              {labels.startPlacement}
            </button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
          {step === "form" ? <p>{labels.stepWelcome}</p> : null}
          {step === "placement" && sessionId ? (
            <form className="review-card" onSubmit={submitPlacement}>
              {questions.map((q) => (
                <div className="placement-block" key={q.id}>
                  <p className="eyebrow">{q.skillTag}</p>
                  <p>{q.prompt}</p>
                  <div className="result-list">
                    {q.options.map((o) => (
                      <label
                        className="secondary-button"
                        key={o.optionKey}
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          checked={answers[q.id] === o.optionKey}
                          name={`q-${q.id}`}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.optionKey }))}
                          type="radio"
                          value={o.optionKey}
                        />{" "}
                        {o.optionKey}. {o.text}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button className="primary" type="submit">
                {labels.submit}
              </button>
            </form>
          ) : null}
          {step === "result" && summary ? (
            <article className="review-card">
              <h2>{labels.resultTitle}</h2>
              <p>
                {labels.correct}: {summary.correctCount}
              </p>
              {summary.estimatedBjtBand ? (
                <p>
                  {labels.band}: {summary.estimatedBjtBand}
                </p>
              ) : null}
              {summary.estimatedScore !== undefined ? (
                <p>
                  {labels.score}: {summary.estimatedScore}
                </p>
              ) : null}
            </article>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
