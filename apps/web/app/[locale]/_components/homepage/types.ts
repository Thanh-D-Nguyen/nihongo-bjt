/** Shared types for homepage section components */

export interface HomepageLabels {
  heroGreeting: string;
  /** When user is logged in and display name is known: `{name}`, `{timeOfDay}` */
  heroGreetingNamed: string;
  morningGreeting: string;
  afternoonGreeting: string;
  eveningGreeting: string;
  cockpitEyebrow: string;
  cockpitPrimaryDue: string;
  cockpitPrimaryCalm: string;
  cockpitCtaReviewNow: string;
  cockpitCtaQuizPrimary: string;
  cockpitSecondaryToQuiz: string;
  cockpitSecondaryToFlashcards: string;
  quickActionsSectionLabel: string;
  quickFlashcards: string;
  quickBjt: string;
  quickBattle: string;
  quickSearch: string;
  quickFlashcardsSub: string;
  quickBjtSub: string;
  quickBattleSub: string;
  quickSearchSub: string;
  newsTitle: string;
  newsSubtitle: string;
  newsReadMore: string;
  newsCreateFlashcard: string;
  newsDeckCreateCancel: string;
  newsDeckCreateDescription: string;
  newsDeckCreateSubmit: string;
  newsDeckCreateTitle: string;
  newsDeckNameAutoHint: string;
  newsDeckNameLabel: string;
  newsDeckNamePlaceholder: string;
  newsEasy: string;
  newsEmpty: string;
  newsError: string;
  newsNormal: string;
  newsViewAll: string;
  newsTimeAgo: string;
  newsMinutesAgo: string;
  newsHoursAgo: string;
  newsDaysAgo: string;
  dailyTitle: string;
  dailySubtitle: string;
  dailyViewAll: string;
  progressTitle: string;
  progressSubtitle: string;
  progressStreak: string;
  /** Label under streak stat card (value uses progressStreak with {n}). */
  progressStreakLabel: string;
  progressReviews: string;
  progressAccuracy: string;
  progressSessions: string;
  progressSignIn: string;
  progressSignInSub: string;
  progressSignInCta: string;
  lifeTitle: string;
  lifeSubtitle: string;
  recommendTitle: string;
  recommendSubtitle: string;
  recommendViewAll: string;
  recommendSectionCount: string;
  recommendDeckCardCount: string;
  recommendEmpty: string;
  recommendPrimary: string;
  recommendReasonBjt: string;
  recommendReasonDeck: string;
  recommendReasonLevel: string;
  recommendStart: string;
  sectionViewAll: string;
  sectionLoadingHint: string;
  newsFlashcardCreated: string;
  newsFlashcardExists: string;
  newsFlashcardError: string;
}

export interface NhkArticle {
  id: string;
  title: string;
  titleWithRuby?: string | null;
  publishedAt: string;
  imageUrl: string | null;
  difficulty: string | null;
  url: string;
  sourceType?: "easy" | "normal";
  sourceLabel?: string;
}

export interface DailyWidget {
  config: { id: string; widgetKind: string };
  item: DailyContentItem | null;
}

export interface DailyContentItem {
  id: string;
  title: string;
  japaneseText: string | null;
  readingText: string | null;
  explanationText: string | null;
  imageUrl?: string | null;
  widgetKind: string;
}

export interface LearnerAnalytics {
  insight: string;
  totals: {
    bjtAccuracyPct: number;
    completedBjtSessions: number;
    reviewCount: number;
    streakDays: number;
  };
}
