# BJT Content Quality Rubric

Version: 1.0.0 (2026-09-17)
Applies to: BJT questions (practice level files + official full-simulation mock forms), lessons, flashcards, and authored learning content.

Quality priority order (from the product owner):

**correctness > pedagogical value > authenticity > consistency > visual usefulness > quantity**

## Decisions

Every audited item ends with exactly one recommended action:

| Action | Meaning | Evidence bar |
| --- | --- | --- |
| KEEP | No change required | No issues, or only cosmetic non-blocking issues |
| EDIT | Safe, well-understood fix | The defect is objective (structure, metadata, typo, broken reference) OR the semantic finding is high-confidence with a proposedFix |
| HUMAN_REVIEW | Evidence insufficient to decide | Semantic finding is medium/low confidence, or fixing requires content authoring judgment |
| REMOVE | Content unusable and unrepairable | Requires **multiple independent, high-severity findings** — never a single soft judgment |

Decision preference order: KEEP > EDIT > HUMAN_REVIEW > REMOVE.

## Layer A — Deterministic (static) checks

Deterministic checks are repeatable and never invoke an LLM. Each check reports
`rule`, `severity` (`error` | `warn`), and a message.

| Rule | Severity | Description |
| --- | --- | --- |
| A01 prompt-empty | error | Question prompt missing or whitespace |
| A02 option-count | error | Not exactly 4 options |
| A03 option-duplicate-text | error | Two or more options share identical text |
| A04 answer-count | error | Number of options with isCorrect !== false must be exactly 1 |
| A05 answer-key-format | error | Option keys must be A/B/C/D, unique, in order |
| A06 explanation-empty | error | explanationVi missing/empty |
| A07 explanation-length | warn | Explanation shorter than 40 chars — likely too thin to teach |
| A08 scenario-empty | warn | scenario null/empty for a section whose mediaHint implies a scene (photo/illustration) |
| A09 scenario-foreign | warn | Scenario written in non-Japanese script (Vietnamese/ASCII) in Japanese-learning data |
| A10 explanation-language | warn | explanationVi does not appear to be Vietnamese (target learner language) |
| A11 skilltag-missing | error | skillTag missing |
| A12 difficulty-invalid | error | difficulty not in easy/standard/hard |
| A13 section-code-unknown | error | Section code not in SECTION_SPEC |
| A14 mediahint-invalid | error | mediaHint not a valid MediaHint value |
| A15 mediahint-prompt-mismatch | warn | Question has imagePrompt but mediaHint says no visual, or vice versa |
| A16 image-reference-dangling | error | imageUrl/imagePrompt references content that does not exist |
| A17 duplicate-prompt-exact | error | Exact prompt duplicated across dataset |
| A18 duplicate-prompt-near | warn | Normalized prompt (hiragana collapsed, punctuation & digits stripped) duplicates another question |
| A19 option-answer-leak | warn | An option's text is a near-substring of the prompt or explanation |
| A20 prompt-foreign | warn | Prompt contains substantial Latin/Vietnamese text |
| A21 stable-id-missing | error | Item cannot be addressed by a stable id (slug + section code + index) |
| A22 option-empty | error | Any option text empty |
| A23 explanation-contradiction | warn | Explanation does not align with the correct option's key content |

## Layer B — Semantic (LLM judge) checks

Static rules cannot judge Japanese naturalness or exam quality. Layer B is an
LLM semantic judge invoked with a versioned rubric and structured JSON output.
The contract lives in `scripts/audit/semantic-judge-contract.ts`.

Each semantic dimension is scored 1-5 with rationale:

| Dimension | Question asked |
| --- | --- |
| B01 japanese-naturalness | Is the Japanese natural and grammatical for its register? |
| B02 business-authenticity | Does the scenario resemble real Japanese workplace communication? |
| B03 level-fit | Does the item match its claimed BJT level (J5...J1+)? |
| B04 single-best-answer | Is exactly one option clearly best? |
| B05 distractor-plausibility | Are distractors plausible but clearly wrong? |
| B06 distractor-no-second-correct | Could a knowledgeable learner justify a second option? |
| B07 explanation-quality | Does explanationVi correctly explain the Japanese/business reasoning? |
| B08 pedagogical-value | Does the item teach something useful? |
| B09 artificiality | Does it sound machine-generated rather than exam-authentic? |
| B10 keigo-register | Do keigo/register/terminology match the situation? |
| B11 bjt-skill-alignment | Does it resemble what BJT actually tests? |

Scoring:

- Any dimension <= 2 → high-severity semantic issue.
- Dimension = 3 → medium (EDIT candidate if judge proposes a concrete fix).
- Dimensions >= 4 → fine.

Combining layers:

- Any A-level `error` that cannot be auto-fixed → EDIT (or HUMAN_REVIEW if the fix needs authoring judgment).
- Semantic score <= 2 with confidence >= 0.7 → EDIT with proposedFix; confidence < 0.7 → HUMAN_REVIEW.
- >= 2 independent high-severity findings → REMOVE.
- A single soft finding never produces REMOVE.

## Output schema

One JSON record per question (see `scripts/audit/bjt-audit-types.ts`):

```jsonc
{
  "questionId": "bjt-j3-practice-v3:RC_VOCAB_GRAMMAR:0042",
  "sourceFile": "database/scripts/seeds/bjt/bjt-questions/j3.ts",
  "level": "J3",
  "dataset": "practice",
  "staticChecks": [{ "rule": "A06", "severity": "error", "message": "..." }],
  "semanticChecks": { "B01": { "score": 4, "confidence": 0.8, "rationale": "..." } },
  "issues": ["explanation-empty"],
  "severity": "high",
  "confidence": 1.0,
  "recommendedAction": "KEEP | EDIT | HUMAN_REVIEW | REMOVE",
  "proposedFix": { "field": "explanationVi", "value": "..." }
}
```

## Audit scope

- BJT questions (all 723): full Layer A + Layer B.
- Lessons, flashcards, daily/magazine/radar: inventory + risk-rank first; Layer A everywhere, Layer B on risk-ranked samples.
- Dictionary/lexemes (252,175): integrity/format/duplicate checks only.