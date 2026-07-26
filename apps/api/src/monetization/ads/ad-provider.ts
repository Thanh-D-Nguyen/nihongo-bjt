export type AdLearningContext = {
  /** Legacy client hint. Providers must resolve the effective plan server-side. */
  planSlug?: string;
  sessionKind?: "default" | "flashcard_review" | "bjt_timed" | "quiz_active";
};

export interface AdDecision {
  /** When eligible, the winning campaign id (for impression/click correlation). */
  campaignId?: string;
  /** Short-lived server-signed proof required for impression/click recording. */
  decisionToken?: string;
  decisionKey: string;
  eligible: boolean;
  payload?: Record<string, unknown>;
}

export type AdDecideInput = {
  learningContext?: AdLearningContext;
  locale?: string;
  placementCode: string;
  /** Null for an anonymous viewer; authenticated ids always come from the verified token. */
  userId: string | null;
};

export interface AdProvider {
  decide(input: AdDecideInput): Promise<AdDecision>;
}
