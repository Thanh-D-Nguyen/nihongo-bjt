export type AdLearningContext = {
  planSlug?: string;
  sessionKind?: "default" | "flashcard_review" | "bjt_timed" | "quiz_active";
};

export interface AdDecision {
  /** When eligible, the winning campaign id (for impression/click correlation). */
  campaignId?: string;
  decisionKey: string;
  eligible: boolean;
  payload?: Record<string, unknown>;
}

export type AdDecideInput = {
  learningContext?: AdLearningContext;
  locale?: string;
  /** Effective plan slug for the user (optional; resolved server-side if omitted). */
  planSlug?: string;
  placementCode: string;
  userId: string;
};

export interface AdProvider {
  decide(input: AdDecideInput): Promise<AdDecision>;
}
