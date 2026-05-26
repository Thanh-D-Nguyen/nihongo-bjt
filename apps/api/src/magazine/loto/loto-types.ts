export type LotoGame = "loto6" | "loto7";

export type LotoGameSpec = {
  game: LotoGame;
  mainCount: number;
  maxNumber: number;
  bonusCount: number;
};

export const LOTO_GAME_SPECS: Record<LotoGame, LotoGameSpec> = {
  loto6: { game: "loto6", mainCount: 6, maxNumber: 43, bonusCount: 1 },
  loto7: { game: "loto7", mainCount: 7, maxNumber: 37, bonusCount: 2 },
};

export type LotoAlgorithmWeights = {
  frequencyHot: number;
  frequencyCold: number;
  overdue: number;
  recentMomentum: number;
  pairAffinity: number;
  weatherBias: number;
  dreamTextBias: number;
  dateNumerology: number;
  randomEntropy: number;
};

export const DEFAULT_LOTO_WEIGHTS: LotoAlgorithmWeights = {
  frequencyHot: 0.2,
  frequencyCold: 0.08,
  overdue: 0.16,
  recentMomentum: 0.14,
  pairAffinity: 0.12,
  weatherBias: 0.08,
  dreamTextBias: 0.08,
  dateNumerology: 0.06,
  randomEntropy: 0.08,
};

export type LotoGenerationInput = {
  game: LotoGame;
  targetDrawDate: string;
  setCount: number;
  seed?: string;
  weights?: Partial<LotoAlgorithmWeights>;
  weatherText?: string;
  dreamText?: string;
  luckyText?: string;
  pinnedNumbers?: number[];
  excludedNumbers?: number[];
};

export type LotoDrawInput = {
  game: LotoGame;
  drawNumber: number;
  drawDate: string;
  mainNumbers: number[];
  bonusNumbers: number[];
  carryoverAmount?: bigint;
  salesAmount?: bigint;
  sourceUrl?: string;
  sourceProvider?: string;
};

export type LotoData = {
  game: LotoGame;
  recentResults: number[][];
  frequencyMap: Record<number, number>;
  hotNumbers: number[];
  coldNumbers: number[];
  overdueNumbers: number[];
  lastDraw?: {
    drawNumber: number;
    drawDate: string;
    mainNumbers: number[];
    bonusNumbers: number[];
  };
  generatedSets?: Array<{
    mainNumbers: number[];
    bonusNumbers: number[];
    score: number;
  }>;
};
