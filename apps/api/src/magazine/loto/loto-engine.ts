import {
  DEFAULT_LOTO_WEIGHTS,
  LOTO_GAME_SPECS,
  type LotoAlgorithmWeights,
  type LotoDrawInput,
  type LotoGame,
  type LotoGenerationInput,
} from "./loto-types.js";

type CandidateSet = {
  mainNumbers: number[];
  bonusNumbers: number[];
  score: number;
  explanation: Record<string, unknown>;
};

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string) {
  let state = hashString(seed) || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

function normalizeMap(values: Record<number, number>, maxNumber: number): Record<number, number> {
  const all = Array.from({ length: maxNumber }, (_, index) => values[index + 1] ?? 0);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(1, max - min);
  return Object.fromEntries(all.map((value, index) => [index + 1, (value - min) / span]));
}

function textNumbers(text: string | undefined, maxNumber: number): number[] {
  if (!text) return [];
  const tokens = text
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const raw = tokens.length ? tokens : [text];
  return Array.from(
    new Set(raw.map((token) => (hashString(token) % maxNumber) + 1)),
  ).slice(0, 12);
}

function dateNumbers(date: string, maxNumber: number): number[] {
  const digits = date.replace(/\D/gu, "").split("").map(Number);
  const sums = [
    digits.reduce((sum, value) => sum + value, 0),
    Number(date.slice(-2)),
    Number(date.slice(5, 7)),
  ].filter((value) => Number.isFinite(value) && value > 0);
  return Array.from(new Set(sums.map((value) => ((value - 1) % maxNumber) + 1)));
}

function buildPairMap(draws: LotoDrawInput[]): Record<string, number> {
  const pairs: Record<string, number> = {};
  for (const draw of draws) {
    for (let i = 0; i < draw.mainNumbers.length; i += 1) {
      for (let j = i + 1; j < draw.mainNumbers.length; j += 1) {
        const key = [draw.mainNumbers[i], draw.mainNumbers[j]].sort((a, b) => a - b).join("-");
        pairs[key] = (pairs[key] ?? 0) + 1;
      }
    }
  }
  return pairs;
}

function passesShape(numbers: number[], game: LotoGame, draws: LotoDrawInput[]): boolean {
  const spec = LOTO_GAME_SPECS[game];
  const odd = numbers.filter((n) => n % 2 === 1).length;
  if (odd === 0 || odd === spec.mainCount) return false;

  const low = numbers.filter((n) => n <= Math.floor(spec.maxNumber / 2)).length;
  if (low === 0 || low === spec.mainCount) return false;

  const sum = numbers.reduce((total, n) => total + n, 0);
  if (draws.length >= 10) {
    const sums = draws.map((draw) => draw.mainNumbers.reduce((total, n) => total + n, 0)).sort((a, b) => a - b);
    const lowBand = sums[Math.floor(sums.length * 0.1)] ?? 0;
    const highBand = sums[Math.floor(sums.length * 0.9)] ?? spec.maxNumber * spec.mainCount;
    if (sum < lowBand || sum > highBand) return false;
  }

  return true;
}

export function summarizeLotoDraws(game: LotoGame, draws: LotoDrawInput[]) {
  const spec = LOTO_GAME_SPECS[game];
  const frequencyMap: Record<number, number> = {};
  const lastSeen: Record<number, number> = {};
  for (let n = 1; n <= spec.maxNumber; n += 1) {
    frequencyMap[n] = 0;
    lastSeen[n] = draws.length + 1;
  }
  draws.forEach((draw, drawIndex) => {
    draw.mainNumbers.forEach((n) => {
      frequencyMap[n] = (frequencyMap[n] ?? 0) + 1;
      if (lastSeen[n] === draws.length + 1) lastSeen[n] = drawIndex;
    });
  });
  const byFrequency = Object.entries(frequencyMap)
    .map(([number, count]) => ({ number: Number(number), count }))
    .sort((a, b) => b.count - a.count || a.number - b.number);
  const byOverdue = Object.entries(lastSeen)
    .map(([number, age]) => ({ number: Number(number), age }))
    .sort((a, b) => b.age - a.age || a.number - b.number);
  return {
    frequencyMap,
    hotNumbers: byFrequency.slice(0, spec.mainCount).map((item) => item.number),
    coldNumbers: byFrequency.slice(-spec.mainCount).map((item) => item.number),
    overdueNumbers: byOverdue.slice(0, spec.mainCount).map((item) => item.number),
  };
}

export function generateLotoSets(input: LotoGenerationInput, draws: LotoDrawInput[]): CandidateSet[] {
  const spec = LOTO_GAME_SPECS[input.game];
  const sortedDraws = [...draws].sort((a, b) => b.drawDate.localeCompare(a.drawDate));
  const summary = summarizeLotoDraws(input.game, sortedDraws);
  const normalizedFrequency = normalizeMap(summary.frequencyMap, spec.maxNumber);
  const normalizedCold = Object.fromEntries(
    Object.entries(normalizedFrequency).map(([number, score]) => [Number(number), 1 - score]),
  );
  const lastSeen: Record<number, number> = {};
  for (let n = 1; n <= spec.maxNumber; n += 1) lastSeen[n] = sortedDraws.length + 1;
  sortedDraws.forEach((draw, index) => {
    draw.mainNumbers.forEach((n) => {
      if (lastSeen[n] === sortedDraws.length + 1) lastSeen[n] = index;
    });
  });
  const overdue = normalizeMap(lastSeen, spec.maxNumber);
  const recent = normalizeMap(
    Object.fromEntries(
      Array.from({ length: spec.maxNumber }, (_, index) => {
        const n = index + 1;
        return [n, sortedDraws.slice(0, 12).filter((draw) => draw.mainNumbers.includes(n)).length];
      }),
    ),
    spec.maxNumber,
  );
  const pairMap = buildPairMap(sortedDraws);
  const weatherNumbers = textNumbers(input.weatherText, spec.maxNumber);
  const dreamNumbers = textNumbers([input.dreamText, input.luckyText].filter(Boolean).join(" "), spec.maxNumber);
  const dateBiasNumbers = dateNumbers(input.targetDrawDate, spec.maxNumber);
  const weights: LotoAlgorithmWeights = { ...DEFAULT_LOTO_WEIGHTS, ...input.weights };
  const rng = seededRandom(`${input.seed ?? ""}:${input.game}:${input.targetDrawDate}`);
  const pinned = new Set(input.pinnedNumbers ?? []);
  const excluded = new Set(input.excludedNumbers ?? []);

  const scoreNumber = (n: number, selected: number[]) => {
    const pairAffinity = selected.length
      ? selected.reduce((sum, other) => {
          const key = [n, other].sort((a, b) => a - b).join("-");
          return sum + (pairMap[key] ?? 0);
        }, 0) / Math.max(1, selected.length * sortedDraws.length)
      : 0;
    return (
      weights.frequencyHot * (normalizedFrequency[n] ?? 0) +
      weights.frequencyCold * (normalizedCold[n] ?? 0) +
      weights.overdue * (overdue[n] ?? 0) +
      weights.recentMomentum * (recent[n] ?? 0) +
      weights.pairAffinity * pairAffinity +
      weights.weatherBias * (weatherNumbers.includes(n) ? 1 : 0) +
      weights.dreamTextBias * (dreamNumbers.includes(n) ? 1 : 0) +
      weights.dateNumerology * (dateBiasNumbers.includes(n) ? 1 : 0) +
      weights.randomEntropy * rng()
    );
  };

  const candidates: CandidateSet[] = [];
  let attempts = 0;
  while (candidates.length < Math.max(input.setCount * 8, 24) && attempts < 900) {
    attempts += 1;
    const selected = [...pinned].filter((n) => n >= 1 && n <= spec.maxNumber && !excluded.has(n));
    while (selected.length < spec.mainCount) {
      const scored = Array.from({ length: spec.maxNumber }, (_, index) => index + 1)
        .filter((n) => !selected.includes(n) && !excluded.has(n))
        .map((n) => ({ n, score: scoreNumber(n, selected) }))
        .sort((a, b) => b.score - a.score);
      const pickWindow = Math.min(scored.length, 8 + Math.floor(rng() * 8));
      selected.push(scored[Math.floor(rng() * pickWindow)]?.n ?? scored[0]!.n);
    }
    const mainNumbers = selected.sort((a, b) => a - b);
    if (!passesShape(mainNumbers, input.game, sortedDraws)) continue;
    const key = mainNumbers.join("-");
    if (candidates.some((candidate) => candidate.mainNumbers.join("-") === key)) continue;
    const score = mainNumbers.reduce((sum, n) => sum + scoreNumber(n, mainNumbers.filter((other) => other !== n)), 0);
    const bonusNumbers = Array.from({ length: spec.maxNumber }, (_, index) => index + 1)
      .filter((n) => !mainNumbers.includes(n))
      .sort(() => rng() - 0.5)
      .slice(0, spec.bonusCount)
      .sort((a, b) => a - b);
    candidates.push({
      mainNumbers,
      bonusNumbers,
      score: Number(score.toFixed(4)),
      explanation: {
        weights,
        signals: {
          hotNumbers: summary.hotNumbers,
          coldNumbers: summary.coldNumbers,
          overdueNumbers: summary.overdueNumbers,
          weatherNumbers,
          dreamNumbers,
          dateBiasNumbers,
        },
      },
    });
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, input.setCount)
    .map((candidate, index) => ({ ...candidate, explanation: { ...candidate.explanation, rank: index + 1 } }));
}
