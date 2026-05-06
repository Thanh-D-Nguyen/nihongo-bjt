import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let capturedProps: Record<string, unknown> | null = null;

vi.mock("../../../../components/reading-assist/annotated-japanese-text", () => ({
  AnnotatedJapaneseText: (props: Record<string, unknown>) => {
    capturedProps = props;
    return <div data-testid="annotated" />;
  }
}));

import { QuizQuestionPanel, type QuizLabels } from "./quiz-client";

const labels = {
  anotherRound: "another",
  bandLabel: "band",
  coachJ1: "j1",
  coachJ2: "j2",
  coachJ3: "j3",
  coachJ4: "j4",
  coachJ5: "j5",
  completedTitle: "completed",
  correctSummary: "summary",
  emptyCtaHelp: "help",
  emptyCtaHome: "home",
  emptyPublicDescription: "empty desc",
  emptyPublicTitle: "empty title",
  error: "error",
  estimatedScoreCaveat: "estimated caveat",
  eyebrow: "eyebrow",
  formatGuideBullet1: "b1",
  formatGuideBullet2: "b2",
  formatGuideBullet3: "b3",
  formatGuideBullet4: "b4",
  formatGuideBullet5: "b5",
  formatGuideDisclaimer: "disc",
  formatGuideHelpLink: "help link",
  formatGuideIntro: "intro",
  formatGuideSummary: "summary fg",
  hubMetaLevel: "level {level}",
  hubMetaSections: "{n} sec",
  hubMetaTimed: "{n} min",
  hubMetaUntimed: "untimed",
  hubTemplatesDescription: "hub desc",
  hubTemplatesHeading: "hub title",
  hubTemplatesLoading: "loading hub",
  load: "load",
  noQuestion: "no question",
  placeholder: "placeholder",
  practiceModeBadge: "practice mode",
  scoreLabel: "score",
  sessionBadgeActive: "active",
  sessionProgress: "{current}/{total}",
  printExam: "print exam",
  start: "start",
  subtitle: "subtitle",
  title: "title",
  breakdown: {
    resultsTitle: "Results",
    estimatedScoreLabel: "Score:",
    estimatedBandLabel: "Band:",
    breakdownTitle: "Breakdown",
    correctLabel: "Correct",
    wrongLabel: "Wrong",
    explanationLabel: "Explanation:",
    selectedOptionLabel: "Your answer",
    addToFlashcardAction: "Add",
    addToFlashcardSuccess: "Added",
    addToFlashcardError: "Error",
    loadingText: "Loading",
    errorText: "Error"
  },
  readingAssist: {
    annotated: {
      addCardAction: "add",
      addCardError: "add error",
      addCardNoDeck: "no deck",
      addCardSuccess: "added",
      bottomSheetClose: "close",
      errorHttp: "http",
      errorNetwork: "network",
      errorTimeout: "timeout",
      furiganaLabel: "furi",
      lexemeLine: "lex",
      loadingText: "loading",
      meaningLabel: "meaning",
      posLabel: "pos",
      retryAction: "retry",
      serviceUnavailable: "service unavailable"
    },
    sectionTitle: "assist"
  },
  audio: {
    audioSection: "Listening",
    hideScript: "Hide script",
    listenAudio: "Listen",
    playCount: "{current}/{max}",
    showScript: "Show script",
    ttsNotice: "TTS"
  }
} satisfies QuizLabels;

const questionPayload = {
  question: {
    id: "question-1",
    options: [
      { optionKey: "A", text: "A option" },
      { optionKey: "B", text: "B option" }
    ],
    prompt: "念のため確認させてください。",
    skillTag: "reading"
  },
  session: {
    correctCount: 0,
    currentQuestionNo: 0,
    estimatedBjtBand: null,
    estimatedScore: null,
    id: "session-123",
    status: "in_progress",
    totalQuestions: 3
  }
};

describe("QuizQuestionPanel reading assist wiring", () => {
  it("binds quiz reading assist analyze to authoritative quiz session id", () => {
    capturedProps = null;

    renderToStaticMarkup(
      <QuizQuestionPanel
        labels={labels}
        onAnswer={() => undefined}
        question={questionPayload}
        userId="11111111-1111-4111-8111-111111111111"
      />
    );

    expect(capturedProps).toMatchObject({
      analyzePath: "/api/reading-assist/analyze",
      analyticsPath: "/api/reading-assist/analytics",
      quizSessionId: "session-123",
      text: "念のため確認させてください。"
    });
  });

  it("falls back to plain question text when learner id is unavailable", () => {
    capturedProps = null;

    const html = renderToStaticMarkup(
      <QuizQuestionPanel labels={labels} onAnswer={() => undefined} question={questionPayload} userId={null} />
    );

    expect(capturedProps).toBeNull();
    expect(html).toContain("念のため確認させてください。");
  });
});
