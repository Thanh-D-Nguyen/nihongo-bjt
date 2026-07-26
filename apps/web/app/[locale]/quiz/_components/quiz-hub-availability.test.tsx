import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ExamCard,
  OfficialAvailabilityPanel,
  QuizModeSelector,
  type QuizLabels
} from "./quiz-client";

const labels = {
  filterTypeMock: "Targeted practice",
  filterTypeOfficial: "Exam simulation",
  formatGuideBullet1: "Official format",
  formatGuideBullet5: "Estimated learning result",
  modeDescription: "Choose a path first.",
  modeHeading: "How would you like to practise?",
  officialAvailabilityErrorDescription: "Targeted practice is still available.",
  officialAvailabilityErrorTitle: "We could not check simulation availability",
  officialAvailabilityLoading: "Checking available simulations",
  officialAvailabilityRetry: "Try again",
  officialModeCardDescription: "Complete one full-format test.",
  officialModeCardTitle: "Take a BJT-style simulation",
  officialModeClosedDescription: "Continue with targeted practice in the meantime.",
  officialModeClosedTitle: "Simulations are taking a short break",
  officialModeLockedDescription: "Your current plan does not include exam simulations.",
  officialModeLockedTitle: "Unlock the full simulation",
  officialModeNoTemplatesDescription: "No simulation is ready right now.",
  officialModeNoTemplatesTitle: "A new simulation is being prepared",
  officialModeUpgradeCta: "View upgrade options",
  officialReferenceLink: "BJT format reference",
  practiceModeCardDescription: "Build confidence toward your target.",
  practiceModeCardTitle: "Practise toward a J rank",
  templateTypeMock: "Practice",
  templateTypeOfficial: "Simulation"
} as QuizLabels;

const status = {
  availableTemplates: 2,
  enabled: true,
  entitled: true,
  entitlementKey: "quiz.official",
  featureFlag: "quiz_official_simulation",
  planSlug: "standard"
};

describe("quiz hub learner mode hierarchy", () => {
  it("presents one accessible mode choice without technical controls", () => {
    const html = renderToStaticMarkup(
      <QuizModeSelector labels={labels} mode="practice" onChange={() => undefined} />
    );

    expect(html).toContain("How would you like to practise?");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Practise toward a J rank");
    expect(html).toContain("Take a BJT-style simulation");
    expect(html).not.toContain("feature flag");
    expect(html).not.toContain("referral");
  });
});

describe("official simulation availability", () => {
  it("renders a calm skeleton while the server-authoritative gate is loading", () => {
    const html = renderToStaticMarkup(
      <OfficialAvailabilityPanel
        availability={{ phase: "loading" }}
        labels={labels}
        onRetry={() => undefined}
        onUpgrade={() => undefined}
      />
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Checking available simulations");
  });

  it("offers retry when availability cannot be checked", () => {
    const html = renderToStaticMarkup(
      <OfficialAvailabilityPanel
        availability={{ phase: "error" }}
        labels={labels}
        onRetry={() => undefined}
        onUpgrade={() => undefined}
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("We could not check simulation availability");
    expect(html).toContain("Try again");
  });

  it("keeps server details out of learner-facing unavailable states", () => {
    const html = renderToStaticMarkup(
      <OfficialAvailabilityPanel
        availability={{ phase: "ready", status: { ...status, enabled: false } }}
        labels={labels}
        onRetry={() => undefined}
        onUpgrade={() => undefined}
      />
    );

    expect(html).toContain("Simulations are taking a short break");
    expect(html).not.toContain(status.featureFlag);
    expect(html).not.toContain(status.entitlementKey);
    expect(html).not.toContain(status.planSlug);
    expect(html).not.toContain("referral");
  });

  it("shows only the upgrade action when the account is not entitled", () => {
    const html = renderToStaticMarkup(
      <OfficialAvailabilityPanel
        availability={{ phase: "ready", status: { ...status, entitled: false } }}
        labels={labels}
        onRetry={() => undefined}
        onUpgrade={() => undefined}
      />
    );

    expect(html).toContain("Unlock the full simulation");
    expect(html).toContain("View upgrade options");
    expect(html).not.toContain("invite");
  });

  it("yields to the published template list when the server allows access", () => {
    const html = renderToStaticMarkup(
      <OfficialAvailabilityPanel
        availability={{ phase: "ready", status }}
        labels={labels}
        onRetry={() => undefined}
        onUpgrade={() => undefined}
      />
    );

    expect(html).toBe("");
  });
});

describe("official simulation provenance", () => {
  it("links every canonical official form to the allow-listed BJT structure source", () => {
    const html = renderToStaticMarkup(
      <ExamCard
        labels={labels}
        locale="en"
        onStart={() => undefined}
        submitting={false}
        template={{
          _count: { sections: 9, sessions: 0 },
          blueprintMeta: {
            reference: {
              purpose: "exam-structure-reference-only",
              sourceName: "BJT Business Japanese Proficiency Test",
              sourceUrl: "https://www.kanken.or.jp/bjt/english/about/feature.html"
            }
          },
          description: "Original KotobaWorks practice content.",
          id: "official-a",
          level: null,
          slug: "bjt-full-simulation-a-v1",
          timeLimitSeconds: 6300,
          titleJa: "BJT総合模擬試験 A",
          titleVi: "Đề thi thử BJT toàn diện A",
          type: "official"
        }}
        userId="user-1"
      />
    );

    expect(html).toContain("BJT format reference");
    expect(html).toContain("https://www.kanken.or.jp/bjt/english/about/feature.html");
    expect(html).toContain('rel="noreferrer"');
  });

  it("does not render untrusted reference URLs", () => {
    const html = renderToStaticMarkup(
      <ExamCard
        labels={labels}
        locale="en"
        onStart={() => undefined}
        submitting={false}
        template={{
          _count: { sections: 9, sessions: 0 },
          blueprintMeta: {
            reference: {
              sourceUrl: "javascript:alert(document.domain)"
            }
          },
          description: null,
          id: "official-a",
          level: null,
          slug: "bjt-full-simulation-a-v1",
          timeLimitSeconds: 6300,
          titleJa: null,
          titleVi: "Official simulation A",
          type: "official"
        }}
        userId="user-1"
      />
    );

    expect(html).not.toContain("BJT format reference");
    expect(html).not.toContain("javascript:");
  });
});
