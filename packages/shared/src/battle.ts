const mulberry32 = (seed: number) => {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export function hashSeedToUint32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffleDeterministic<T>(items: T[], seedString: string): T[] {
  const seed = hashSeedToUint32(seedString);
  const random = mulberry32(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

export type BattleBotProfile = {
  correctProbability: number;
  labelI18nKey: string;
  maxDelayMs: number;
  minDelayMs: number;
};

export const BATTLE_BOT_PROFILES: Record<string, BattleBotProfile> = {
  bot_j2: {
    correctProbability: 0.4,
    labelI18nKey: "battle.bots.j2",
    maxDelayMs: 2400,
    minDelayMs: 450
  },
  bot_j3: {
    correctProbability: 0.55,
    labelI18nKey: "battle.bots.j3",
    maxDelayMs: 2000,
    minDelayMs: 350
  },
  bot_j4: {
    correctProbability: 0.68,
    labelI18nKey: "battle.bots.j4",
    maxDelayMs: 1800,
    minDelayMs: 280
  }
};

export const DEFAULT_BATTLE_BOT_KEY = "bot_j3";

export function getBattleBotProfile(botKey: string): BattleBotProfile {
  return (
    BATTLE_BOT_PROFILES[botKey] ??
    BATTLE_BOT_PROFILES[DEFAULT_BATTLE_BOT_KEY] ??
    BATTLE_BOT_PROFILES["bot_j3"]!
  );
}

export function decideBotOption(input: {
  correctOptionKey: string;
  optionKeys: string[];
  correctProbability: number;
  /** Returns [0,1) */
  random: () => number;
}): { optionKey: string } {
  const { correctOptionKey, correctProbability, optionKeys, random } = input;
  if (optionKeys.length === 0) {
    return { optionKey: correctOptionKey };
  }
  if (random() < correctProbability) {
    return { optionKey: correctOptionKey };
  }
  const wrong = optionKeys.filter((k) => k !== correctOptionKey);
  if (wrong.length === 0) {
    return { optionKey: correctOptionKey };
  }
  return { optionKey: wrong[Math.floor(random() * wrong.length)]! };
}

export function randomBetween(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
