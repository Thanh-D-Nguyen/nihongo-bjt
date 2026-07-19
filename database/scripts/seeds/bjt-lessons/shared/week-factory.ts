import type {
  FocusSeed,
  GrammarSeed,
  Relationship,
  StimulusType,
  VocabularySeed,
  WeekSeed
} from "../types.js";

const WEEK_META: Record<
  number,
  {
    businessTopic: string;
    relationship: Relationship;
    stimulusType: StimulusType;
    skillTags: string[];
  }
> = {
  1: {
    businessTopic: "workplace-relations",
    relationship: "senior-junior",
    stimulusType: "dialogue",
    skillTags: ["relationship", "register", "self-positioning"]
  },
  2: {
    businessTopic: "task-instruction",
    relationship: "manager-staff",
    stimulusType: "memo",
    skillTags: ["instruction", "confirmation", "scope"]
  },
  3: {
    businessTopic: "progress-management",
    relationship: "manager-staff",
    stimulusType: "report",
    skillTags: ["progress", "deadline", "evidence"]
  },
  4: {
    businessTopic: "horenso",
    relationship: "senior-junior",
    stimulusType: "internal_chat",
    skillTags: ["report", "contact", "consult"]
  },
  5: {
    businessTopic: "business-phone",
    relationship: "company-partner",
    stimulusType: "telephone",
    skillTags: ["telephone", "message-taking", "handoff"]
  },
  6: {
    businessTopic: "business-email",
    relationship: "company-partner",
    stimulusType: "email",
    skillTags: ["email", "request", "written-register"]
  },
  7: {
    businessTopic: "meeting",
    relationship: "manager-staff",
    stimulusType: "meeting",
    skillTags: ["meeting", "opinion", "facilitation"]
  },
  8: {
    businessTopic: "planning-deadline",
    relationship: "colleague-colleague",
    stimulusType: "table",
    skillTags: ["schedule", "priority", "dependency"]
  },
  9: {
    businessTopic: "incident-risk",
    relationship: "manager-staff",
    stimulusType: "report",
    skillTags: ["incident", "root-cause", "risk"]
  },
  10: {
    businessTopic: "customer-complaint",
    relationship: "employee-customer",
    stimulusType: "complaint",
    skillTags: ["customer", "apology", "recovery"]
  },
  11: {
    businessTopic: "proposal-negotiation",
    relationship: "company-partner",
    stimulusType: "proposal",
    skillTags: ["proposal", "negotiation", "decision"]
  },
  12: {
    businessTopic: "integrated-business",
    relationship: "executive-stakeholder",
    stimulusType: "table",
    skillTags: ["integrated", "judgment", "accountability"]
  }
};

export function defineWeek(input: {
  week: number;
  themeJa: string;
  themeVi: string;
  objectiveVi: string;
  scenarioJa: string;
  scenarioVi: string;
  problemVi: string;
  desiredOutcomeVi: string;
  vocabulary: VocabularySeed[];
  grammar: GrammarSeed[];
  focuses: FocusSeed[];
  relationship?: Relationship;
  stimulusType?: StimulusType;
  businessTopic?: string;
  skillTags?: string[];
}): WeekSeed {
  const meta = WEEK_META[input.week];
  if (!meta) throw new Error(`Missing week metadata for week ${input.week}`);
  return {
    ...input,
    relationship: input.relationship ?? meta.relationship,
    stimulusType: input.stimulusType ?? meta.stimulusType,
    businessTopic: input.businessTopic ?? meta.businessTopic,
    skillTags: input.skillTags ?? meta.skillTags
  };
}
