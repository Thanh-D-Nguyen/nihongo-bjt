export interface BjtQuestionStableIdentity {
  audioScript: string | null;
  id: string;
  prompt: string;
  scenario: string | null;
  sectionCode: string;
  skillTag: string;
  testSlug: string;
}

export function buildBjtQuestionStableWhere(identity: BjtQuestionStableIdentity) {
  return {
    audioScript: identity.audioScript,
    prompt: identity.prompt,
    scenario: identity.scenario,
    section: {
      code: identity.sectionCode,
      test: { slug: identity.testSlug }
    },
    skillTag: identity.skillTag
  };
}

export function selectBjtProductionQuestionId(
  identity: BjtQuestionStableIdentity,
  sameIdMatch: { id: string } | null,
  stableMatches: Array<{ id: string }>
): { id: string; matchedBy: "id" | "stable-content" } {
  if (sameIdMatch) return { id: sameIdMatch.id, matchedBy: "id" };
  if (stableMatches.length === 1) {
    return { id: stableMatches[0]!.id, matchedBy: "stable-content" };
  }

  const locator = `${identity.testSlug}/${identity.sectionCode}/${identity.id}`;
  if (stableMatches.length === 0) {
    throw new Error(`No production BJT question matches ${locator}`);
  }
  throw new Error(
    `Ambiguous production BJT question match for ${locator}: ${stableMatches.length} rows`
  );
}
