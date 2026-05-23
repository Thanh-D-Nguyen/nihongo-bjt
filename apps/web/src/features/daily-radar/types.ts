export type DailyRadarModule = {
  category: string;
  disclaimerJa: string | null;
  disclaimerVi: string | null;
  moduleKey: string;
  titleJa: string;
  titleVi: string;
};

export type DailyRadarCard = {
  badgeTextVi: string | null;
  category: string;
  ctaLabelJa: string | null;
  ctaLabelVi: string;
  descriptionVi: string;
  estimatedMinutes: number | null;
  id: string;
  isPinned: boolean;
  isSpotlight: boolean;
  levelLabel: string | null;
  module: DailyRadarModule;
  metadata?: Record<string, unknown> | null;
  moduleType: string;
  priority: number;
  recommendationReasonVi: string | null;
  slug: string;
  targetRoute: string | null;
  titleJa: string | null;
  titleVi: string;
  visualTheme: string | null;
  /** Widget-sourced Japanese learning fields (present when moduleType === "daily_widget") */
  japaneseText?: string | null;
  readingText?: string | null;
  bodyMd?: string | null;
  iconKey?: string | null;
  targetEntityId?: string | null;
};

export type DailyRadarHomePayload = {
  cards: DailyRadarCard[];
  categories: string[];
  modules: Array<DailyRadarModule & { isEnabled?: boolean; visualTheme?: string | null }>;
  spotlight: DailyRadarCard | null;
};

export type DailyRadarLabels = {
  all: string;
  categoryEntertainment: string;
  categoryFamily: string;
  categoryLife: string;
  categoryMoney: string;
  categoryNews: string;
  categoryProcedure: string;
  categorySafety: string;
  categoryStudy: string;
  categoryWork: string;
  comingSoon: string;
  ctaFallback: string;
  disclaimerBadge: string;
  empty: string;
  error: string;
  heading: string;
  minutes: string;
  placeholderBody: string;
  retry: string;
  showMore: string;
  subheading: string;
  viewAll: string;
};
