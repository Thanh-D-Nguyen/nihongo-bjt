/**
 * Career RPG label contract. Server passes a `CareerRpgLabels` prop down,
 * sourced from messages/{vi,ja,en}.json under the `careerRpg` key.
 */
import type { SkillAxisCode } from "./types";

export interface CareerRpgLabels {
  brand: {
    companyJa: string;
    companyVi: string;
    tagline: string;
  };
  daily: {
    eyebrow: string;
    morningGreeting: string;
    afternoonGreeting: string;
    eveningGreeting: string;
    todayTasks: string;
    clockIn: string;
    streakLabel: string;
    streakSuffix: string;
    todayTasksHint: string;
    reviewInboxLink: string;
    careerSheetLink: string;
    arcsLink: string;
    mentorMessageMorning: string;
    mentorMessageAfternoon: string;
    mentorMessageEvening: string;
  };
  career: {
    eyebrow: string;
    title: string;
    subtitle: string;
    rankBadgeStamp: string;
    nextRankLabel: string;
    rankProgressLabel: string;
    skillsTitle: string;
    skillsSubtitle: string;
    skillsAxisLabels: Record<SkillAxisCode, string>;
    relationsTitle: string;
    relationsSubtitle: string;
    trustLabel: string;
    relationUchi: string;
    relationSoto: string;
    timelineTitle: string;
    timelineEmpty: string;
    backHome: string;
  };
  arcs: {
    eyebrow: string;
    title: string;
    subtitle: string;
    statusActive: string;
    statusCompleted: string;
    statusLocked: string;
    rankRequired: string;
    chaptersProgress: string;
    enterArc: string;
    notUnlocked: string;
  };
  arcDetail: {
    backLink: string;
    synopsisTitle: string;
    npcsTitle: string;
    chaptersTitle: string;
    bossLabel: string;
    chapterMinutes: string;
    startChapter: string;
    chapterLocked: string;
    chapterDone: string;
  };
  chapter: {
    backLink: string;
    briefingEyebrow: string;
    yourRoleLabel: string;
    estimatedLabel: string;
    startCta: string;
    scenarioEyebrow: string;
    scenarioGoal: string;
    questionEyebrow: string;
    selectAnswer: string;
    submitAnswer: string;
    consequenceTitle: string;
    nextScenario: string;
    finishChapter: string;
    politenessAxis: string;
    clarityAxis: string;
    riskAxis: string;
    satisfactionAxis: string;
    nextActionLabel: string;
    nextActionYes: string;
    nextActionNo: string;
  };
  reaction: {
    smile: string;
    nod: string;
    frown: string;
    silence: string;
    escalate: string;
  };
  rankUp: {
    eyebrow: string;
    sealStamp: string;
    oldRankLabel: string;
    newRankLabel: string;
    unlocksTitle: string;
    continueCta: string;
  };
  complete: {
    eyebrow: string;
    chapterClearedTitle: string;
    npcMontageTitle: string;
    deltasTitle: string;
    rankXpLabel: string;
    skillDeltasLabel: string;
    npcTrustLabel: string;
    memosDroppedLabel: string;
    nextChapterCta: string;
    reviewInboxCta: string;
    backToStandupCta: string;
  };
  inbox: {
    eyebrow: string;
    title: string;
    subtitle: string;
    fromLabel: string;
    surfaceLabel: string;
    realIntentLabel: string;
    sceneLabel: string;
    toneLabel: string;
    bjtTrapLabel: string;
    statusUnread: string;
    statusRead: string;
    feelUseful: string;
    feelStillFuzzy: string;
    feelLost: string;
    markReadCta: string;
    reviewCompleteCta: string;
    cardKindLabels: Record<
      | "expression_pair"
      | "keigo_register"
      | "scene_pattern"
      | "nuance_pattern"
      | "soft_refusal"
      | "discourse_marker",
      string
    >;
  };
  onboarding: {
    title: string;
    explanation: string;
    explanationDetail: string;
    nameLabel: string;
    namePlaceholder: string;
    suggestionsLabel: string;
    confirmCta: string;
    skipCta: string;
    saving: string;
    error: string;
  };
}

/** Slim utility: pick the right messages file given a locale string. */
export function selectLabels<T extends { careerRpg: CareerRpgLabels }>(
  messages: Record<string, T>,
  locale: string,
  fallback: keyof typeof messages
): CareerRpgLabels {
  return (messages[locale] ?? messages[fallback as string]).careerRpg;
}
