/**
 * Career RPG — type contracts for the visual vertical slice.
 *
 * Shapes are kept close to the future API model so swapping mock data with
 * real endpoints later is mechanical (replace mock-data.ts imports with fetch
 * calls returning the same types).
 */

export type RankCode = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8";

export type SkillAxisCode =
  | "keigo"
  | "written"
  | "meeting"
  | "customer"
  | "chart"
  | "nuance";

export type ScenarioType =
  | "email"
  | "meeting"
  | "chat"
  | "complaint"
  | "deadline"
  | "report_chart";

export type ErrorTypeCode =
  | "keyword_trap"
  | "keigo_misunderstanding"
  | "business_context_error"
  | "implied_meaning_error"
  | "listening_detail_miss"
  | "relationship_mismatch"
  | "internal_external_tone_mismatch"
  | "action_item_miss"
  | "speaker_intention_miss"
  | "deadline_misread"
  | "responsibility_misread"
  | "chart_trend_misread"
  | "soft_refusal_misread"
  | "proposal_conclusion_misread"
  | "priority_misread";

export interface CareerRank {
  id?: string;
  rankCode: RankCode;
  titleJa: string;
  titleVi: string;
  bjtBandTarget: string;
  minSkillFloor: number;
  requiredArcCount?: number;
  rewardsPayload?: unknown;
  unlockedSceneTypes: ScenarioType[];
  displayOrder: number;
  xpToNext?: number;
}

export interface CareerSkillStat {
  axisCode: SkillAxisCode;
  value: number;
}

export interface UserCareerState {
  userId: string;
  jpWorkName: string;
  companyTheme: string;
  hireDate: string;
  currentRankCode: RankCode;
  rankXp: number;
  rankXpToNext: number;
  streakDays: number;
  lastClockInAt: string | null;
  skills: CareerSkillStat[];
}

export interface StoryNpc {
  slug: string;
  nameJa: string;
  roleJa: string;
  companyJa: string | null;
  defaultRelation: "uchi" | "soto";
  avatarInitial: string;
  avatarTint: string;
  bioVi: string;
}

export interface NpcRelation {
  npcSlug: string;
  trustScore: number;
  lastInteractionAt: string | null;
}

export interface BjtQuestionOption {
  optionKey: string;
  textJa: string;
  isCorrect: boolean;
  outcome: RiskOutcomePreview;
}

export interface RiskOutcomePreview {
  trustDelta: number;
  clarityScore: number;
  politenessScore: number;
  businessRiskDelta: number;
  satisfactionDelta: number;
  nextActionCorrect: boolean;
  npcReactionTag: "smile" | "nod" | "frown" | "silence" | "escalate";
  consequenceJa: string;
  consequenceVi: string;
  affectedNpcSlug: string;
  errorType: ErrorTypeCode | null;
}

export interface BjtStyleQuestion {
  id: string;
  promptJa: string;
  promptVi: string;
  skillTag: SkillAxisCode;
  difficulty: "easy" | "standard" | "hard";
  options: BjtQuestionOption[];
}

export interface ScenarioCharacter {
  npcSlug: string;
  roleInScene: "sender" | "recipient" | "observer" | "manager";
}

export interface WorkplaceScenarioPayload {
  /** Free-form structured per scenario type (email, meeting, chat, etc). */
  emailThread?: Array<{
    from: string;
    to: string;
    subjectJa: string;
    bodyJa: string;
    timestamp: string;
  }>;
  meetingTranscript?: Array<{ speaker: string; lineJa: string }>;
  chatLog?: Array<{ speaker: string; lineJa: string; timestamp: string }>;
  chartSummaryJa?: string;
  chartDataPoints?: Array<{ label: string; value: number }>;
}

export interface WorkplaceScenario {
  id: string;
  scenarioType: ScenarioType;
  titleJa: string;
  titleVi: string;
  contextSummaryVi: string;
  characters: ScenarioCharacter[];
  payload: WorkplaceScenarioPayload;
  goalJa: string;
  goalVi: string;
  question: BjtStyleQuestion;
}

export interface MissionChapter {
  id: string;
  arcSlug: string;
  slug: string;
  displayOrder: number;
  titleJa: string;
  titleVi: string;
  briefingJa: string;
  briefingVi: string;
  yourRoleVi: string;
  isBoss: boolean;
  scenarios: WorkplaceScenario[];
  estimatedMinutes: number;
}

export interface MissionArc {
  slug: string;
  titleJa: string;
  titleVi: string;
  rankCodeEntry: RankCode;
  synopsisVi: string;
  npcSlugs: string[];
  chapterIds: string[];
  status: "draft" | "active" | "completed" | "locked";
  totalChapters: number;
  completedChapters: number;
  bossChapterId: string | null;
  displayOrder: number;
  artAccent: string;
}

export interface ContextMemo {
  id: string;
  cardKind:
    | "expression_pair"
    | "keigo_register"
    | "scene_pattern"
    | "nuance_pattern"
    | "soft_refusal"
    | "discourse_marker";
  expressionJa: string;
  reading: string;
  surfaceMeaningVi: string;
  realIntentVi: string;
  sceneJa: string;
  toneVi: string;
  bjtTrapVi: string;
  fromNpcSlug: string;
  generatedAt: string;
  status: "unread" | "read";
}

export interface ChapterResult {
  chapterId: string;
  rankXpDelta: number;
  skillDeltas: Partial<Record<SkillAxisCode, number>>;
  npcTrustDeltas: Array<{ npcSlug: string; delta: number }>;
  contextMemoIds: string[];
  npcReactionMontage: Array<{
    npcSlug: string;
    quoteJa: string;
    sentiment: "positive" | "neutral" | "negative";
  }>;
  completedAt: string;
}

/** Bundle of all mock state used by the slice. Real API later returns these
 *  per-endpoint; mock combines them for convenience. */
export interface CareerRpgMockBundle {
  state: UserCareerState;
  ranks: CareerRank[];
  npcs: StoryNpc[];
  npcRelations: NpcRelation[];
  arcs: MissionArc[];
  chapters: MissionChapter[];
  inbox: ContextMemo[];
  sampleResult: ChapterResult;
}
