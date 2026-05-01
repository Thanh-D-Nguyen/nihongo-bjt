# BJT Assessment Format Standard

## Purpose

NihonGo BJT assessment admin must model BJT preparation, not generic quiz management.

Use this file whenever implementing or reviewing:

- `/assessment/quiz-templates`
- `/assessment/question-bank`
- `/assessment/mock-exams`
- `/assessment/quiz-sessions`
- `/assessment/remediation`
- `/bjt`

## Source References

- Official BJT overview: https://www.kanken.or.jp/bjt/english/about/
- Official BJT features/test structure: https://www.kanken.or.jp/bjt/english/about/feature.html
- Official sample Part I: https://www.kanken.or.jp/bjt/english/sample/sample01.html
- Official sample Part II: https://www.kanken.or.jp/bjt/english/sample/sample02.html
- Official sample Part III: https://www.kanken.or.jp/bjt/english/sample/sample03.html

## Product Interpretation

- `Mock Exams` are the closest representation of full BJT exam simulations.
- `Quiz Templates` are reusable practice generators. They may target BJT parts/sections, skills, timing, level, topic mix, and difficulty mix, but they are not necessarily full exams.
- `Question Bank` is the canonical item repository. It must support creating and editing BJT-style items, importing/bulk operations, validation, tagging, publishing/archive lifecycle, and review suggestions.
- `Quiz Sessions` are learner attempts and operator interventions.
- `Remediation Rules` map attempt signals to follow-up practice/content.

If a screen treats BJT as a generic quiz without BJT part/section/timing/media/scoring metadata, keep it non-PASS.

## Official BJT Structure Baseline

The official BJT is a three-part test:

1. Listening Comprehension, approximately 45 minutes.
2. Listening and Reading Comprehension, approximately 30 minutes.
3. Reading Comprehension, approximately 30 minutes.

Official BJT uses four-option multiple choice and reports a scaled 0-800 score with levels J5 through J1+.

Minimum admin metadata for BJT-style content:

- `bjtPart`: `listening` | `listening_reading` | `reading`
- `bjtSection`: one of the section codes below
- `level`: BJT-J5 | BJT-J4 | BJT-J3 | BJT-J2 | BJT-J1 | BJT-J1+
- `businessSituation`: meeting, phone, presentation, negotiation, complaint, report/document, email/chat, schedule, chart/table, HR/interview, sales/customer, internal coordination, other
- `stimulusKind`: audio, photo, illustration, chart, table, document, email, memo, conversation, text
- `skillTag`: operational skill, not a vague label
- `timeLimitSec` or per-section timing
- `answerOptions`: exactly four options for official-style items unless the item is explicitly a non-official practice variant
- `correctOptionKey`
- explanation and source/provenance fields

## BJT Parts And Sections

Part I: Listening Comprehension

- `LC_SCENE`: scene understanding with photo/context.
- `LC_STATEMENT`: utterance/expression understanding in business context.
- `LC_INTEGRATED`: integrated listening with illustration/conversation.

Part II: Listening and Reading Comprehension

- `LR_SITUATION`: situation understanding using audio plus visual/text.
- `LR_DOCUMENT`: document/listening comprehension using chart/table/ad/material.
- `LR_INTEGRATED`: integrated listening-reading with multiple information streams.

Part III: Reading Comprehension

- `RC_VOCAB_GRAMMAR`: vocabulary/grammar in business context.
- `RC_EXPRESSION`: expression/reading comprehension.
- `RC_INTEGRATED`: integrated reading using document/chart/table/text.

## Admin Workflow Requirements

### Quiz Templates

Must let admins create/edit templates with:

- BJT part and section coverage.
- target level and skill tags.
- question count and timing.
- difficulty mix.
- topic/business-situation mix.
- stimulus/media requirements.
- preview of generated section allocation.
- publish/archive/duplicate/delete lifecycle with audit reason.

### Mock Exams

Must let admins create/edit full or sectional exam simulations with:

- sections matching the BJT part/section baseline.
- section timing.
- total time validation.
- scoring strategy and pass/level interpretation.
- publish/archive/duplicate/delete lifecycle with audit reason.

### Question Bank

Must let admins:

- create a new BJT-style question.
- edit prompt/scenario/explanation/options/tags/section/media.
- validate exactly one correct option for official-style four-choice items.
- bulk publish/archive/tag/untag/import.
- suggest edits through review flow.
- inspect item history/audit and linked sessions/answers.

Question Bank is not production-ready if it only supports bulk actions on existing rows and has no create/edit path.

## JPT Clarification

If the task says "JPT" while the product scope is NihonGo BJT, treat it as a likely typo for BJT unless the human explicitly asks to support the separate JPT exam. Do not mix JPT/JLPT/BJT formats in the same admin workflow without a product decision.
