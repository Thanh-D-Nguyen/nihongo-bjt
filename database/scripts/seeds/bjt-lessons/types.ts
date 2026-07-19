export const BJT_LEVELS = ["J5", "J4", "J3", "J2", "J1", "J1+"] as const;
export type BjtLevel = (typeof BJT_LEVELS)[number];

export const UNIT_TYPES = ["lesson", "review", "checkpoint"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const ANSWER_KEYS = ["A", "B", "C", "D"] as const;
export type AnswerKey = (typeof ANSWER_KEYS)[number];

export const ACTIVITY_TYPES = [
  "best_expression",
  "fill_phrase",
  "role_response",
  "politeness_check",
  "mini_case_inference",
  "sentence_order",
  "error_correction",
  "reading_comprehension",
  "speaker_intent",
  "context_match"
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const STIMULUS_TYPES = [
  "dialogue",
  "email",
  "internal_chat",
  "memo",
  "telephone",
  "meeting",
  "announcement",
  "report",
  "table",
  "policy",
  "proposal",
  "complaint"
] as const;
export type StimulusType = (typeof STIMULUS_TYPES)[number];

export type Relationship =
  | "colleague-colleague"
  | "senior-junior"
  | "manager-staff"
  | "employee-customer"
  | "company-partner"
  | "executive-stakeholder";

export interface VocabularySeed {
  japanese: string;
  reading: string;
  meaningVi: string;
}

export interface GrammarSeed {
  pattern: string;
  explanationVi: string;
}

export interface FocusSeed {
  phraseJa: string;
  meaningVi: string;
  intentVi: string;
  nuanceVi: string;
}

export interface WeekSeed {
  week: number;
  themeJa: string;
  themeVi: string;
  objectiveVi: string;
  scenarioJa: string;
  scenarioVi: string;
  problemVi: string;
  desiredOutcomeVi: string;
  relationship: Relationship;
  stimulusType: StimulusType;
  businessTopic: string;
  skillTags: string[];
  vocabulary: VocabularySeed[];
  grammar: GrammarSeed[];
  focuses: FocusSeed[];
}

export interface LevelBlueprint {
  level: BjtLevel;
  difficulty:
    | "foundation"
    | "elementary"
    | "intermediate"
    | "upper-intermediate"
    | "advanced"
    | "executive";
  register: string;
  speakerRoleJa: string;
  counterpartRoleJa: string;
  acknowledgementJa: string;
  closingJa: string;
  weeks: WeekSeed[];
}

export interface LessonExample {
  japanese: string;
  vietnamese: string;
  noteVi: string;
}

export interface ActivityOption {
  key: AnswerKey;
  text: string;
  isCorrect: boolean;
  rationaleVi: string;
}

export interface LessonActivity {
  id: string;
  questionType: ActivityType;
  stimulusType: StimulusType;
  scenarioJa: string;
  scenarioVi: string;
  stimulusText: string;
  audioScript: string | null;
  audioAssetStatus: "not_required" | "tts_ready" | "generated";
  audioUrl: string | null;
  audioProvider: string | null;
  audioVoice: string | null;
  audioVersion: string | null;
  prompt: string;
  promptVi: string;
  options: ActivityOption[];
  answer: AnswerKey;
  explanationJa: string;
  explanationVi: string;
  skillTag: string;
  difficulty: LevelBlueprint["difficulty"];
  businessTopic: string;
  relationship: Relationship;
}

export interface LessonDocument {
  schemaVersion: "bjt-lesson-document-v1";
  learningObjectives: string[];
  workplaceScenario: {
    who: string;
    counterpart: string;
    relationship: Relationship;
    goalVi: string;
    problemVi: string;
    desiredOutcomeVi: string;
    contextJa: string;
    contextVi: string;
  };
  knowledgePoints: string[];
  vocabulary: VocabularySeed[];
  grammar: GrammarSeed[];
  businessUsageVi: string;
  examples: LessonExample[];
  nuanceNotesVi: string[];
  politenessHierarchyVi: string;
  vietnameseLearnerPitfalls: string[];
  activities: LessonActivity[];
  summaryVi: string[];
  analytics: {
    recommendationTopics: string[];
    skillTags: string[];
    expectedMinutes: number;
    assessmentMode: "guided" | "review" | "checkpoint";
  };
}

export interface ProductionLessonUnit {
  id: string;
  seedKey: string;
  levelCode: BjtLevel;
  weekNumber: number;
  unitType: UnitType;
  unitOrder: number;
  sortOrder: number;
  slug: string;
  titleVi: string;
  titleJa: string;
  descriptionVi: string;
  descriptionJa: string;
  estimatedDurationMin: number;
  difficulty: LevelBlueprint["difficulty"];
  skillTags: string[];
  businessTopics: string[];
  prerequisiteKeys: string[];
  lessonContent: LessonDocument;
  contentVersion: string;
  contentHash: string;
  status: "active";
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  level?: BjtLevel;
  seedKey?: string;
}

export interface ValidationReport {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  levels: Record<string, LevelValidationSummary>;
}

export interface LevelValidationSummary {
  weeks: number;
  coreLessons: number;
  reviews: number;
  checkpoints: number;
  totalLearningUnits: number;
  exerciseCount: number;
  questionCount: number;
  ttsActivityCount: number;
  answerDistribution: Record<AnswerKey, number>;
  skillCoverage: Record<string, number>;
  topicCoverage: Record<string, number>;
  validation: { errors: number; warnings: number };
}
