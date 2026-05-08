"use client";

import {
  Button,
  Card,
  CardContent,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  ProgressBar
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { learnerApiFetch } from "../../../../lib/learner-api";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Exercise {
  id: string;
  exerciseType: string;
  prompt: Record<string, unknown>;
  choices: Array<{ key: string; text: string }>;
  correctAnswer: Record<string, unknown>;
  explanation: string | null;
  level: string | null;
}

interface Session {
  id: string;
  status: string;
  totalQuestions: number;
  correctCount: number;
  score: number;
}

interface AnswerResult {
  isCorrect: boolean;
  correctAnswer: Record<string, unknown>;
  explanation: string | null;
}

type Phase = "setup" | "practicing" | "review" | "completed";

export interface ExercisesLabels {
  title: string;
  eyebrow: string;
  subtitle: string;
  generate: string;
  startSession: string;
  submitAnswer: string;
  nextQuestion: string;
  completeSession: string;
  correct: string;
  incorrect: string;
  score: string;
  history: string;
  noExercises: string;
  sessionComplete: string;
  types: Record<string, string>;
  levels: Record<string, string>;
  filterType: string;
  filterLevel: string;
  questionOf: string;
  timeSpent: string;
  error: string;
}

const EXERCISE_TYPES = ["meaning_match", "cloze", "word_order", "translation", "listening"] as const;
const LEVELS = ["all", "N5", "N4", "N3", "N2", "N1"] as const;

/* ── Component ─────────────────────────────────────────────────────────── */

export function ExercisesPageClient({
  labels,
  locale: _locale
}: {
  labels: ExercisesLabels;
  locale: string;
}) {
  void _locale;

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedType, setSelectedType] = useState<string>("meaning_match");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(0);

  /* ── Generate exercises ──────────────────────────────────────────────── */

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: selectedType, count: "10" });
      if (selectedLevel !== "all") params.set("level", selectedLevel);

      const res = await learnerApiFetch(`/api/exercises/generate?${params}`);
      if (!res.ok) throw new Error("Failed to generate");
      const data = await res.json();
      setExercises(data);

      // Start session
      const sessionRes = await learnerApiFetch("/api/exercises/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType: "practice_tab",
          exerciseType: selectedType,
          level: selectedLevel !== "all" ? selectedLevel : undefined
        })
      });
      if (!sessionRes.ok) throw new Error("Failed to start session");
      const sessionData = await sessionRes.json();
      setSession(sessionData);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setStartTime(Date.now());
      setPhase("practicing");
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedLevel, labels.error]);

  /* ── Submit answer ───────────────────────────────────────────────────── */

  const handleSubmit = useCallback(async () => {
    if (!session || !selectedAnswer || answerResult) return;
    const exercise = exercises[currentIndex];
    if (!exercise) return;

    const timeSpentMs = Date.now() - startTime;

    try {
      const res = await learnerApiFetch(`/api/exercises/sessions/${session.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: exercise.id,
          userAnswer: exercise.exerciseType === "word_order"
            ? { orderedTokens: selectedAnswer.split(",") }
            : { key: selectedAnswer },
          timeSpentMs
        })
      });
      if (!res.ok) throw new Error("Failed to submit");
      const result = await res.json();
      setAnswerResult(result);
    } catch {
      setError(labels.error);
    }
  }, [session, selectedAnswer, answerResult, exercises, currentIndex, startTime, labels.error]);

  /* ── Next question / Complete ────────────────────────────────────────── */

  const handleNext = useCallback(async () => {
    if (currentIndex >= exercises.length - 1) {
      // Complete session
      if (!session) return;
      try {
        const res = await learnerApiFetch(`/api/exercises/sessions/${session.id}/complete`, {
          method: "POST"
        });
        if (!res.ok) throw new Error("Failed to complete");
        const data = await res.json();
        setSession(data);
        setPhase("completed");
      } catch {
        setError(labels.error);
      }
      return;
    }

    setCurrentIndex((i) => i + 1);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setStartTime(Date.now());
  }, [currentIndex, exercises.length, session, labels.error]);

  /* ── Render ──────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-5">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-5">
      <PageHeader eyebrow={labels.eyebrow} title={labels.title} />

      {error && (
        <div className="my-4">
          <ErrorState title={error} action={<Button variant="secondary" onClick={() => setError(null)}>OK</Button>} />
        </div>
      )}

      {/* ── Setup Phase ──────────────────────────────────────────────── */}
      {phase === "setup" && (
        <div className="mt-6 space-y-6">
          {/* Type filter */}
          <div>
            <label className="mb-2 block text-sm font-medium text-ink/70">
              {labels.filterType}
            </label>
            <div className="flex flex-wrap gap-2">
              {EXERCISE_TYPES.map((t) => (
                <button
                  key={t}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    selectedType === t
                      ? "bg-accent text-white"
                      : "bg-surface text-ink/70 hover:bg-surface-hover"
                  }`}
                  onClick={() => setSelectedType(t)}
                >
                  {labels.types[t] ?? t}
                </button>
              ))}
            </div>
          </div>

          {/* Level filter */}
          <div>
            <label className="mb-2 block text-sm font-medium text-ink/70">
              {labels.filterLevel}
            </label>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    selectedLevel === l
                      ? "bg-accent text-white"
                      : "bg-surface text-ink/70 hover:bg-surface-hover"
                  }`}
                  onClick={() => setSelectedLevel(l)}
                >
                  {labels.levels[l] ?? l}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleGenerate} variant="primary" size="lg">
            {labels.generate}
          </Button>
        </div>
      )}

      {/* ── Practicing Phase ─────────────────────────────────────────── */}
      {phase === "practicing" && exercises.length > 0 && (
        <div className="mt-6 space-y-6">
          {/* Progress bar */}
          <div className="flex items-center justify-between text-sm text-ink/60">
            <span>
              {labels.questionOf
                .replace("{current}", String(currentIndex + 1))
                .replace("{total}", String(exercises.length))}
            </span>
            <span>{labels.types[selectedType] ?? selectedType}</span>
          </div>
          <ProgressBar
            value={((currentIndex + 1) / exercises.length) * 100}
          />

          {/* Question card */}
          <ExerciseCard
            exercise={exercises[currentIndex]}
            labels={labels}
            selectedAnswer={selectedAnswer}
            answerResult={answerResult}
            onSelect={setSelectedAnswer}
            onSubmit={handleSubmit}
            onNext={handleNext}
            isLast={currentIndex >= exercises.length - 1}
          />
        </div>
      )}

      {/* ── Completed Phase ──────────────────────────────────────────── */}
      {phase === "completed" && session && (
        <div className="mt-6 space-y-6 text-center">
          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-accent">
                {labels.sessionComplete}
              </h2>
              <div className="mt-4 flex items-center justify-center gap-8">
                <div>
                  <div className="text-4xl font-bold text-accent">
                    {session.correctCount}
                  </div>
                  <div className="text-sm text-ink/60">
                    / {session.totalQuestions} {labels.correct.replace("!", "")}
                  </div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-ink">
                    {session.score}
                  </div>
                  <div className="text-sm text-ink/60">{labels.score}</div>
                </div>
              </div>
              <div className="mt-6">
                <Button
                  onClick={() => {
                    setPhase("setup");
                    setExercises([]);
                    setSession(null);
                  }}
                  variant="primary"
                >
                  {labels.generate}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ── Exercise Card ─────────────────────────────────────────────────────── */

function ExerciseCard({
  exercise,
  labels,
  selectedAnswer,
  answerResult,
  onSelect,
  onSubmit,
  onNext,
  isLast
}: {
  exercise: Exercise;
  labels: ExercisesLabels;
  selectedAnswer: string | null;
  answerResult: AnswerResult | null;
  onSelect: (key: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const prompt = exercise.prompt;
  const isWordOrder = exercise.exerciseType === "word_order";

  return (
    <Card>
      <CardContent className="p-6">
        {/* Prompt */}
        <div className="mb-6">
          {prompt.maskedSentence ? (
            <div>
              <p className="text-lg font-medium text-ink">
                {String(prompt.maskedSentence as string)}
              </p>
              {prompt.hint ? (
                <p className="text-sm text-ink/60">{String(prompt.hint as string)}</p>
              ) : null}
            </div>
          ) : prompt.japaneseSentence ? (
            <div>
              <p className="text-lg font-medium text-ink">
                {String(prompt.japaneseSentence as string)}
              </p>
              {prompt.reading ? (
                <p className="text-sm text-ink/50">{String(prompt.reading as string)}</p>
              ) : null}
            </div>
          ) : isWordOrder ? (
            <div>
              <p className="mb-2 text-sm font-medium text-ink/60">
                {String((prompt.hint as string) ?? "")}
              </p>
              <WordOrderInput
                tokens={prompt.shuffledTokens as string[]}
                onSelect={onSelect}
                disabled={!!answerResult}
              />
            </div>
          ) : (
            <div>
              <p className="text-xl font-bold text-ink">
                {String((prompt.text as string) ?? "")}
              </p>
              {prompt.reading ? (
                <p className="text-sm text-ink/50">{String(prompt.reading as string)}</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Multiple choice options */}
        {!isWordOrder && Array.isArray(exercise.choices) && (
          <div className="space-y-3">
            {exercise.choices.map((choice) => {
              const isSelected = selectedAnswer === choice.key;
              const isCorrectChoice = answerResult && answerResult.correctAnswer.key === choice.key;
              const isWrong = answerResult && isSelected && !answerResult.isCorrect;

              return (
                <button
                  key={choice.key}
                  className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    answerResult
                      ? isCorrectChoice
                        ? "border-green-500 bg-green-50 text-green-800"
                        : isWrong
                          ? "border-red-400 bg-red-50 text-red-800"
                          : "border-transparent bg-surface text-ink/60"
                      : isSelected
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-transparent bg-surface text-ink hover:bg-surface-hover"
                  }`}
                  disabled={!!answerResult}
                  onClick={() => onSelect(choice.key)}
                >
                  <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-paper text-xs font-bold">
                    {choice.key}
                  </span>
                  {choice.text}
                </button>
              );
            })}
          </div>
        )}

        {/* Feedback */}
        {answerResult && (
          <div
            className={`mt-4 rounded-lg p-4 ${
              answerResult.isCorrect
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            <p className="font-bold">
              {answerResult.isCorrect ? labels.correct : labels.incorrect}
            </p>
            {answerResult.explanation && (
              <p className="mt-1 text-sm whitespace-pre-line">
                {answerResult.explanation}
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex justify-end gap-3">
          {!answerResult && (
            <Button
              onClick={onSubmit}
              variant="primary"
              disabled={!selectedAnswer}
            >
              {labels.submitAnswer}
            </Button>
          )}
          {answerResult && (
            <Button onClick={onNext} variant="primary">
              {isLast ? labels.completeSession : labels.nextQuestion}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Word Order Input ──────────────────────────────────────────────────── */

function WordOrderInput({
  tokens,
  onSelect,
  disabled
}: {
  tokens: string[];
  onSelect: (val: string) => void;
  disabled: boolean;
}) {
  const [ordered, setOrdered] = useState<string[]>([]);
  const remaining = tokens.filter((t) => !ordered.includes(t));

  useEffect(() => {
    setOrdered([]);
  }, [tokens]);

  useEffect(() => {
    if (ordered.length > 0) {
      onSelect(ordered.join(","));
    }
  }, [ordered, onSelect]);

  const addToken = (token: string) => {
    if (disabled) return;
    setOrdered((prev) => [...prev, token]);
  };

  const removeToken = (index: number) => {
    if (disabled) return;
    setOrdered((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Constructed sentence */}
      <div className="flex min-h-[48px] flex-wrap gap-2 rounded-xl border-2 border-dashed border-accent/30 p-3">
        {ordered.map((token, i) => (
          <button
            key={`${token}-${i}`}
            className="rounded-lg bg-accent/20 px-3 py-1.5 text-sm font-medium text-accent"
            onClick={() => removeToken(i)}
            disabled={disabled}
          >
            {token}
          </button>
        ))}
        {ordered.length === 0 && (
          <span className="text-sm text-ink/30">
            ↓ タップして文を組み立てる
          </span>
        )}
      </div>

      {/* Available tokens */}
      <div className="flex flex-wrap gap-2">
        {remaining.map((token, i) => (
          <button
            key={`${token}-${i}`}
            className="rounded-lg bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-hover"
            onClick={() => addToken(token)}
            disabled={disabled}
          >
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}
