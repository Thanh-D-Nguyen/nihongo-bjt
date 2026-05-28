/**
 * Production-grade quiz option distribution utility.
 *
 * Ensures balanced correct-answer position distribution using Fisher-Yates shuffle.
 * Used across all quiz systems (BJT, Exercise, Magazine) to prevent position bias.
 *
 * Design principles (matching professional quiz platforms like ETS, JLPT official):
 * - Options shuffled per-serving so same question appears differently each time
 * - Keys (A/B/C/D) reassigned AFTER shuffle based on new position
 * - Cryptographically-inspired randomness via Math.random (sufficient for non-security use)
 * - Batch-level balance validation available for content generation
 */
const OPTION_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];
/**
 * Fisher-Yates shuffle — unbiased in-place permutation.
 */
export function shuffleArray(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
/**
 * Shuffle quiz options and assign positional keys (A/B/C/D) AFTER shuffle.
 * This is the core function that prevents position bias.
 *
 * @param options Array of options with correct flag
 * @returns Shuffled options with positional keys assigned
 */
export function shuffleQuizOptions(options) {
    const shuffled = shuffleArray(options);
    return shuffled.map((opt, i) => ({
        key: OPTION_KEYS[i] ?? String(i + 1),
        text: opt.text,
        isCorrect: opt.isCorrect,
        ...(opt.meta ? { meta: opt.meta } : {}),
    }));
}
/**
 * Shuffle options given as string[] + correctAnswer text.
 * Returns shuffled options with positional keys and correct key.
 * Used for magazine quiz and similar systems that store options as string arrays.
 */
export function shuffleStringOptions(options, correctAnswer) {
    const tagged = options.map((text) => ({ text, isCorrect: text === correctAnswer }));
    const shuffled = shuffleQuizOptions(tagged);
    const correctKey = shuffled.find((o) => o.isCorrect)?.key ?? "A";
    return {
        shuffledOptions: shuffled.map((o) => ({ key: o.key, text: o.text })),
        correctKey,
    };
}
/**
 * For batch question generation: assign correct answer positions with balanced distribution.
 * Ensures no single position gets more than ceil(total/numPositions) + 1 correct answers.
 *
 * @param totalQuestions Number of questions in the batch
 * @param numOptions Number of options per question (default 4 for A/B/C/D)
 * @returns Array of correct position indices (0-based), one per question
 */
export function generateBalancedPositions(totalQuestions, numOptions = 4) {
    // Create a balanced base: distribute evenly
    const positions = [];
    for (let i = 0; i < totalQuestions; i++) {
        positions.push(i % numOptions);
    }
    // Shuffle to remove predictable patterns while maintaining distribution
    return shuffleArray(positions);
}
/**
 * Validate that a batch of questions has acceptable answer distribution.
 * Used for quality gates on generated/imported content.
 *
 * @param correctPositions Array of 0-based correct answer positions
 * @param numOptions Number of options per question
 * @param maxBiasPercent Maximum allowed percentage for any single position (default 35%)
 * @returns Validation result with distribution stats
 */
export function validateAnswerDistribution(correctPositions, numOptions = 4, maxBiasPercent = 35) {
    const total = correctPositions.length;
    if (total === 0)
        return { valid: true, distribution: {} };
    const counts = {};
    for (let i = 0; i < numOptions; i++) {
        counts[OPTION_KEYS[i] ?? String(i)] = 0;
    }
    for (const pos of correctPositions) {
        const key = OPTION_KEYS[pos] ?? String(pos);
        counts[key] = (counts[key] ?? 0) + 1;
    }
    const maxAllowed = Math.ceil(total * maxBiasPercent / 100);
    const distribution = {};
    let biasedKey;
    for (const [key, count] of Object.entries(counts)) {
        const percent = Math.round((count / total) * 100);
        distribution[key] = percent;
        if (count > maxAllowed) {
            biasedKey = key;
        }
    }
    if (biasedKey) {
        return {
            valid: false,
            distribution,
            message: `Position "${biasedKey}" has ${distribution[biasedKey]}% of correct answers (max allowed: ${maxBiasPercent}%)`,
        };
    }
    return { valid: true, distribution };
}
/**
 * Generate a session-level exam shuffle map with:
 * 1. Balanced distribution — each position gets ≈ equal correct answers
 * 2. Anti-consecutive — no 3+ consecutive correct answers at the same position
 * 3. Full permutation — all options shuffled (not just correct placement)
 *
 * This is the production algorithm used by major exam platforms.
 *
 * @param questions Ordered array of question metadata (in serving order)
 * @returns ExamShuffleMap keyed by questionId
 */
export function generateExamShuffleMap(questions) {
    const total = questions.length;
    if (total === 0)
        return {};
    const numOptions = questions[0].optionKeys.length;
    // Step 1: Generate balanced correct-answer positions with anti-consecutive constraint
    const correctPositions = generateBalancedAntiConsecutive(total, numOptions);
    // Step 2: For each question, build a full permutation placing correct at target position
    const map = {};
    for (let i = 0; i < total; i++) {
        const q = questions[i];
        const targetPos = correctPositions[i];
        map[q.questionId] = buildPermutation(q.optionKeys, q.correctKey, targetPos);
    }
    return map;
}
/**
 * Generate balanced positions with anti-consecutive constraint.
 * No position appears 3+ times consecutively.
 * Distribution is within ±1 of perfect balance (total/numOptions).
 */
function generateBalancedAntiConsecutive(total, numOptions) {
    const maxAttempts = 50;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const positions = generateBalancedPositions(total, numOptions);
        if (passesAntiConsecutive(positions, 3)) {
            return positions;
        }
    }
    // Fallback: greedy construction with anti-consecutive enforcement
    return greedyAntiConsecutive(total, numOptions);
}
/**
 * Check if positions array has no run of `maxRun` or more consecutive same values.
 */
function passesAntiConsecutive(positions, maxRun) {
    let run = 1;
    for (let i = 1; i < positions.length; i++) {
        if (positions[i] === positions[i - 1]) {
            run++;
            if (run >= maxRun)
                return false;
        }
        else {
            run = 1;
        }
    }
    return true;
}
/**
 * Greedy construction: guaranteed balanced + anti-consecutive.
 * Fills positions one by one, choosing from available slots that don't violate constraints.
 */
function greedyAntiConsecutive(total, numOptions) {
    const baseCount = Math.floor(total / numOptions);
    const remainder = total % numOptions;
    // Budget: how many times each position can still be used
    const budget = Array.from({ length: numOptions }, (_, i) => i < remainder ? baseCount + 1 : baseCount);
    shuffleArrayInPlace(budget); // randomize which positions get the extra slot
    const result = [];
    for (let i = 0; i < total; i++) {
        // Find candidates that have budget AND don't violate anti-consecutive
        const lastTwo = result.length >= 2
            ? [result[result.length - 2], result[result.length - 1]]
            : [];
        const candidates = [];
        for (let p = 0; p < numOptions; p++) {
            if (budget[p] <= 0)
                continue;
            // Anti-consecutive: skip if last 2 are same as p
            if (lastTwo.length === 2 && lastTwo[0] === p && lastTwo[1] === p)
                continue;
            candidates.push(p);
        }
        if (candidates.length === 0) {
            // Shouldn't happen with proper budget, but fallback: pick any with budget
            const fallback = budget.findIndex((b) => b > 0);
            result.push(fallback);
            budget[fallback]--;
        }
        else {
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            result.push(pick);
            budget[pick]--;
        }
    }
    return result;
}
/**
 * Build a full permutation for a single question:
 * - Correct option placed at targetPosition
 * - Remaining options randomly distributed across other positions
 */
function buildPermutation(optionKeys, correctKey, targetPosition) {
    const incorrect = optionKeys.filter((k) => k !== correctKey);
    const shuffledIncorrect = shuffleArray(incorrect);
    const result = new Array(optionKeys.length);
    result[targetPosition] = correctKey;
    let idx = 0;
    for (let i = 0; i < result.length; i++) {
        if (i === targetPosition)
            continue;
        result[i] = shuffledIncorrect[idx++];
    }
    return result;
}
/** In-place Fisher-Yates (for internal budget array) */
function shuffleArrayInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
/**
 * Apply a shuffle map entry to reorder options for serving.
 * Returns options in the new display order with positional keys.
 *
 * @param originalOptions Options from DB sorted by optionKey ASC
 * @param permutation The permutation array from ExamShuffleMap (e.g. ["C","A","D","B"])
 */
export function applyShufflePermutation(originalOptions, permutation) {
    const byKey = new Map(originalOptions.map((o) => [o.optionKey, o]));
    return permutation.map((origKey, i) => ({
        ...byKey.get(origKey),
        displayKey: OPTION_KEYS[i] ?? String.fromCharCode(65 + i),
    }));
}
/**
 * Reverse-map a submitted display key back to the original option key.
 * Used at answer submission time.
 *
 * @param permutation The permutation for this question from ExamShuffleMap
 * @param displayKey The key the user selected (A/B/C/D in display order)
 * @returns The original option key in the database
 */
export function reverseMapDisplayKey(permutation, displayKey) {
    const displayIndex = displayKey.charCodeAt(0) - 65; // "A"→0, "B"→1, etc.
    return permutation[displayIndex] ?? displayKey;
}
// ─────────────────────────────────────────────────────────────────────────────
// SEEDED PRNG — Deterministic shuffle for print/export (same seed = same result)
// Uses mulberry32: fast 32-bit PRNG with excellent distribution properties
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Convert a string seed into a 32-bit integer hash (FNV-1a).
 */
function hashSeed(seed) {
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
/**
 * Mulberry32 PRNG — returns a function that produces [0, 1) floats deterministically.
 */
function mulberry32(seed) {
    let s = seed | 0;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/**
 * Seeded Fisher-Yates shuffle — deterministic for same seed.
 */
function seededShuffleArray(arr, rng) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
/**
 * Seeded balanced anti-consecutive positions generation.
 */
function seededGreedyAntiConsecutive(total, numOptions, rng) {
    const baseCount = Math.floor(total / numOptions);
    const remainder = total % numOptions;
    const budget = Array.from({ length: numOptions }, (_, i) => i < remainder ? baseCount + 1 : baseCount);
    // Seeded shuffle of budget
    for (let i = budget.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [budget[i], budget[j]] = [budget[j], budget[i]];
    }
    const result = [];
    for (let i = 0; i < total; i++) {
        const lastTwo = result.length >= 2
            ? [result[result.length - 2], result[result.length - 1]]
            : [];
        const candidates = [];
        for (let p = 0; p < numOptions; p++) {
            if (budget[p] <= 0)
                continue;
            if (lastTwo.length === 2 && lastTwo[0] === p && lastTwo[1] === p)
                continue;
            candidates.push(p);
        }
        if (candidates.length === 0) {
            const fallback = budget.findIndex((b) => b > 0);
            result.push(fallback);
            budget[fallback]--;
        }
        else {
            const pick = candidates[Math.floor(rng() * candidates.length)];
            result.push(pick);
            budget[pick]--;
        }
    }
    return result;
}
/**
 * Seeded permutation builder for a single question.
 */
function seededBuildPermutation(optionKeys, correctKey, targetPosition, rng) {
    const incorrect = optionKeys.filter((k) => k !== correctKey);
    const shuffledIncorrect = seededShuffleArray(incorrect, rng);
    const result = new Array(optionKeys.length);
    result[targetPosition] = correctKey;
    let idx = 0;
    for (let i = 0; i < result.length; i++) {
        if (i === targetPosition)
            continue;
        result[i] = shuffledIncorrect[idx++];
    }
    return result;
}
/**
 * Generate a deterministic exam shuffle map using a string seed.
 * Same seed + same questions → identical output every time.
 * Used for print/PDF export where reproducibility is required.
 *
 * @param questions Ordered array of question metadata
 * @param seed String seed (typically exam ID or exam ID + version)
 * @returns ExamShuffleMap keyed by questionId
 */
export function generateSeededExamShuffleMap(questions, seed) {
    const total = questions.length;
    if (total === 0)
        return {};
    const numOptions = questions[0].optionKeys.length;
    const rng = mulberry32(hashSeed(seed));
    // Step 1: Balanced correct-answer positions with anti-consecutive (seeded)
    const correctPositions = seededGreedyAntiConsecutive(total, numOptions, rng);
    // Step 2: Build full permutation per question (seeded)
    const map = {};
    for (let i = 0; i < total; i++) {
        const q = questions[i];
        const targetPos = correctPositions[i];
        map[q.questionId] = seededBuildPermutation(q.optionKeys, q.correctKey, targetPos, rng);
    }
    return map;
}
