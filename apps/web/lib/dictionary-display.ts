const DUPLICATED_PAREN_PREFIX = /^[(（]\s*([^()（）]+?)\s*[-‐ー]?\s*[)）]\s*(.+)$/;

/**
 * Some imported dictionary readings repeat the reading inside a parenthesized prefix,
 * e.g. "(たいらしょうねじ-)たいらしょうねじ". Show the reading once in that exact case;
 * legitimate context such as "(ベクトルの)せーぶん" is left untouched.
 */
export function displayLexemeReading(reading: string | null | undefined): string | null {
  if (!reading) return reading ?? null;
  const match = reading.match(DUPLICATED_PAREN_PREFIX);
  if (match && match[1] === match[2].trim()) return match[2].trim();
  return reading;
}
