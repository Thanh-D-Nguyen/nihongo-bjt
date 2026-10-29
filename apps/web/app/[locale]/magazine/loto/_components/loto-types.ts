export type LotoGame = "loto6" | "loto7";

export interface LotoVocabItem {
  wordJp: string;
  reading: string;
  meaningVi: string;
}

export interface LotoSentence {
  textJp: string;
  reading: string;
  textVi: string;
  level?: string;
  grammar?: string;
  vocabItems: LotoVocabItem[];
}

export interface LotoSet {
  mainNumbers: number[];
  bonusNumbers: number[];
  score: number;
}

export interface LotoFeedItem {
  id: string;
  drawNumber: number | null;
  drawDate: string;
  drawDayJp?: string;
  drawTime?: string;
  game: LotoGame;
  kind?: "published" | "backtest" | "result";
  sets: LotoSet[];
  result: { mainNumbers: number[]; bonusNumbers: number[] } | null;
  hitCount: number;
  bonusHit: boolean;
  matched?: number[];
  jpSentence: LotoSentence | null;
}

export interface LotoNextDraw {
  id: string;
  drawNumber: number | null;
  drawNumberEstimated?: boolean;
  drawDate: string;
  drawDayJp?: string;
  drawTime?: string;
  scheduleJp?: string;
  scheduleVi?: string;
  scheduleEn?: string;
  game: LotoGame;
  sets: LotoSet[];
  jpSentence: LotoSentence | null;
  vocabItems: LotoVocabItem[];
  confidence: number | null;
  daysUntil: number;
  totalCombinations?: number;
}

export interface LotoNumberStat {
  number: number;
  count: number;
  recent: number;
  gap: number;
}

export interface LotoRecentDraw {
  drawNumber: number;
  drawDate: string;
  drawDayJp?: string;
  mainNumbers: number[];
  bonusNumbers: number[];
}

export interface LotoAccuracy {
  samples: number;
  publishedSamples?: number;
  backtestSamples?: number;
  avgHits: number;
  baselineHits: number;
  bestHits: number;
  bestDrawNumber?: number | null;
  bonusHits?: number;
  distribution: number[];
  expectedDistribution: number[];
}

export interface LotoStats {
  game: LotoGame;
  totalDraws: number;
  latestDraw?: string;
  earliestDraw?: string;
  spec: {
    mainCount: number;
    bonusCount: number;
    maxNumber: number;
    totalCombinations: number;
    drawTime?: string;
    scheduleJp?: string;
    scheduleVi?: string;
  };
  frequency: LotoNumberStat[];
  recentWindow?: number;
  hotNumbers: number[];
  coldNumbers: number[];
  overdueNumbers: number[];
  oddDistribution?: number[];
  sum?: { min: number; max: number; average: number; p10: number; p90: number };
  recentDraws: LotoRecentDraw[];
  accuracy: LotoAccuracy;
  officialVerificationUrl?: string;
}

export interface LotoLabels {
  title?: string;
  subtitle?: string;
  nextDraw?: string;
  drawNumber?: string;
  countdown?: string;
  history?: string;
  prediction?: string;
  result?: string;
  hitCount?: string;
  pending?: string;
  loadMore?: string;
  jpSentence?: string;
  vocab?: string;
  viewDetail?: string;
  confidence?: string;
  confidenceHint?: string;
  loginRequired?: string;
  set?: string;
  bonus?: string;
  loto6?: string;
  loto7?: string;
  tabLoto6?: string;
  tabLoto7?: string;
  disclaimer?: string;
  empty?: string;
  error?: string;
  retry?: string;
  collapse?: string;
  tabPredictions?: string;
  tabLab?: string;
  today?: string;
  estimatedNumber?: string;
  showReading?: string;
  hideReading?: string;
  grammar?: string;
  kindPublished?: string;
  kindBacktest?: string;
  kindResult?: string;
  bonusMatched?: string;
  statsTitle?: string;
  statsSubtitle?: string;
  loadingStats?: string;
  statsError?: string;
  totalDraws?: string;
  latestDraw?: string;
  jackpotOdds?: string;
  resultsTitle?: string;
  heatmapTitle?: string;
  heatmapHint?: string;
  heatmapAll?: string;
  heatmapRecent?: string;
  hot?: string;
  cold?: string;
  overdue?: string;
  gapDraws?: string;
  parityTitle?: string;
  parityHint?: string;
  parityRow?: string;
  accuracyTitle?: string;
  accuracyIntro?: string;
  accuracyAvg?: string;
  accuracyBaseline?: string;
  accuracySamples?: string;
  accuracyObserved?: string;
  accuracyExpected?: string;
  accuracyNote?: string;
  accuracyEmpty?: string;
  hitsLabel?: string;
  lessonTitle?: string;
  lessonOdds?: string;
  lessonIndependent?: string;
  lessonRegression?: string;
  verifyOfficial?: string;
}
