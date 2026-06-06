---
name: bjt-deck-flashcard-management
description: >-
  Implement, review, or polish Quizlet-like Deck and Flashcard Set management
  for Nihongo BJT Flutter mobile app: create deck/set, bulk card editor,
  import, card CRUD, deck detail, study/review/SRS integration, web parity,
  real API wiring, ja/vi typography, and production mobile UX.
---

# BJT Deck and Flashcard Management Skill

Use this skill to build or improve Deck / Flashcard Set management in `apps/mobile` with web parity and real backend wiring.

## When To Use This Skill

Use when task includes one or more:

- deck list/detail for mobile
- create/edit deck or flashcard set
- multi-card editor (Quizlet-like flow)
- bulk import terms/definitions
- flashcard CRUD in deck
- start study/review from deck
- deck to Review/SRS integration
- parity audit between web and mobile deck features

### Trigger Phrases

- "deck management"
- "flashcard set"
- "create set"
- "bulk card editor"
- "import flashcards"
- "deck detail"
- "mobile Quizlet-like"
- "deck CRUD"
- "deck to review"

### Do Not Use This Skill

Use another skill if user intent is:

- full exam flow or timed exam integrity only
- global app shell/nav routing overhaul
- auth/session/account only
- generic SRS hub without deck/set management
- backend-only API redesign without mobile deck UX

## Required Companion Skills

Always apply these baselines together:

- `bjt-mobile-foundation-quality-gate`
- `bjt-mobile-review-srs-hub` (when review integration touched)
- `bjt-mobile-reading-assist-layer` (when Japanese reading assist touched)
- `flutter-build-responsive-layout`
- `flutter-fix-layout-issues`
- `flutter-add-widget-test`

## Core Goal

Deliver production-grade, mobile-native deck/set management that is:

- fast to create and edit
- safe for unsaved user input
- parity-aligned with current web behavior
- fully wired to real APIs and models
- suitable for Japanese and Vietnamese learning content

Use Quizlet-style creation flow as UX benchmark only. Do not copy branding/UI.

## Hard Rules

- Never fake deck/card data or fake success states.
- Never invent API response shapes.
- Persistent domain data must be server-authoritative.
- Reuse web contracts and mobile repository/provider patterns.
- If parity requires backend/API/schema change, document evidence and scope before changing.
- Do not break existing Review/SRS flow or Flashcard reveal behavior.
- Review-owned routes must preserve Review tab ownership.
- Focus routes must hide bottom nav if nav causes CTA/touch conflict.
- Create/Edit forms must be keyboard-safe and must not lose input.
- Keep vi/ja localization aligned with web terminology.
- Add or update tests for each changed management action.
- Do not claim device QA passed unless actually executed.

## Product Terminology

Use web and l10n labels as source of truth. Do not invent user-facing labels.

Common entities:

- Deck / Flashcard Set / Study Set
- Card / Front / Back / Term / Definition
- Reading / Furigana / Example / Explanation
- Tag / Level / Category / Visibility

Typical card payload for ja/vi learning (if API supports):

- Japanese term or sentence
- reading/furigana/romaji
- Vietnamese meaning
- explanation
- example sentence
- tags, level, business scene
- audio/image

## Required Audit Before Coding

Inspect first, then implement.

### Web Audit Scope

- deck list/detail/create/edit pages
- card create/edit components
- import and bulk editor flows
- delete/archive/duplicate/share behavior
- search/filter/sort behavior
- study/review/SRS integration from deck
- API hooks/services/clients
- DTO/models/types/schemas and validation
- empty/loading/error states
- l10n copy

### Mobile Audit Scope

- existing deck/flashcard implementation
- Review/SRS and Flashcard reveal implementation
- router/AppShell/fullscreen patterns
- repositories/providers/cache usage
- shared form/input components
- l10n and design tokens
- existing tests

### Required Docs (create/update)

- `docs/mobile/DECK_FLASHCARD_WEB_PARITY_AUDIT.md`
- `docs/mobile/DECK_FLASHCARD_API_CONTRACT.md`
- `docs/mobile/DECK_FLASHCARD_CREATE_SET_UX_SPEC.md`
- `docs/mobile/DECK_FLASHCARD_BULK_EDITOR_SPEC.md`
- `docs/mobile/DECK_FLASHCARD_MOBILE_IMPLEMENTATION_PLAN.md`

No implementation before this audit package exists.

## Web Parity Matrix (Mandatory)

For each web feature, track:

- web route/file
- API/client/model
- observed web behavior
- current mobile status
- implementation decision
- risks and blockers
- mobile screens/components needed
- tests needed

Feature status must be one of:

- Implement now
- API exists, mobile adapter needed
- Mobile UX decision needed
- Not applicable on mobile
- Blocked with evidence

Do not mark "missing backend" without proof.

## Required Mobile Feature Coverage

Apply "if web/API supports" gate to each item.

### 1. Deck/Set List

- list, search, filter, sort
- recent / created-by-me / favorite where supported
- visibility and metadata chips
- create/import CTAs
- loading, empty, error, offline states

### 2. Deck/Set Detail

- title, description, owner/visibility, tags/level
- card count and card preview/list
- primary Study/Review CTA (single clear primary)
- edit/duplicate/delete/archive/share/export as supported
- card-level search/filter/sort if supported

### 3. Create Deck / Create Set

- required metadata fields by contract
- local draft UI state before submit
- required validation and inline errors
- unsaved-change protection
- success/error/loading handling
- success navigation aligned with web behavior

Flow decision:

- Two-step flow when API requires deck-first then cards
- One-step batch flow when API supports metadata+cards together

Document selected flow in audit docs.

### 4. Quizlet-like Multi-Card Editor

- front/back mandatory rows
- optional fields only when contract supports them
- add/delete/duplicate/reorder rows (if supported)
- per-row validation
- smooth keyboard next/previous behavior
- no horizontal overflow, usable at 360-390 dp
- sticky save CTA that does not hide inputs

No desktop table/grid UX on narrow mobile.

### 5. Bulk Import

- text paste with format help
- parse preview + row-level errors
- duplicate/empty row handling
- edit parsed rows before save
- safe cancel
- no fake AI import or fake file import

Parser rules should match web when web defines parser behavior.

### 6. Flashcard CRUD

- create/edit/delete single card inside deck
- validation and save states
- long ja/vi text handling
- media fields only if contract supports real media

### 7. Delete/Archive/Duplicate Safety

- explicit confirmation UX
- destructive styling
- loading/error states
- prevent accidental delete
- undo only when product/API pattern supports it

### 8. Search/Filter/Sort UX

- search input with clear action
- filter chips and sort sheet
- empty-result state
- avoid desktop sidebar clone

### 9. Study/Review/SRS Integration

- start review from deck detail
- preserve reveal behavior reliability
- SRS actions/progress only from real API data
- keep focused review route free from nav conflict

### 10. Import/Export/Share

- implement with real API when supported
- otherwise record exact blocker with evidence

## UI and UX Guardrails

Deck management UX must be:

- fast, focused, modern, premium
- mobile-native and touch-safe
- readable for Japanese and Vietnamese content
- consistent with brand and existing mobile design system

Use:

- one clear primary action per screen
- bottom sheets for secondary actions
- progressive disclosure for advanced fields
- complete loading/empty/error states

Avoid:

- dead actions
- fake stats
- noisy visuals that hurt readability
- hidden validation errors
- input-loss behavior

## Tests Required

Update tests for changed areas:

- deck list states and navigation
- deck detail metadata/actions/navigation
- create/edit deck validation and save states
- card editor row operations and overflow safety
- import parsing/preview/edit/save
- flashcard CRUD and destructive confirmations
- review entry + reveal stability + tab ownership

Integration tests where feasible:

- Review -> Deck list -> Deck detail -> Create card -> Start review -> Reveal
- Deck list -> Create deck -> Add cards -> Save -> Deck detail
- Create deck -> Import -> Preview -> Save

In tests, use fake repositories/providers. Do not require real credentials.

## Migration Guard For Existing Implementation

A previous Deck / Flashcard Management implementation may already exist.

Before replacing code, create or update:

- `docs/mobile/DECK_FLASHCARD_MIGRATION_MAP.md`

The migration map must classify existing files/routes/providers/tests as:

- Keep as-is
- Refactor
- Replace
- Remove as dead/duplicate code

The migration map must include:

- existing deck list files
- existing deck detail files
- existing create/edit deck files
- existing flashcard CRUD files
- existing review/SRS integration files
- existing route ownership
- existing tests to preserve
- duplicate/dead routes to remove
- risks and rollback notes

Rules:

- Do not rewrite working API/repository/provider code from scratch unless it is fundamentally incompatible.
- Preserve existing passing tests unless the product behavior intentionally changes.
- Preserve existing Review/SRS integration.
- Preserve existing Flashcard reveal behavior.
- Do not leave old and new Create Deck flows side by side.
- Do not leave duplicate routes.
- Do not leave dead buttons/cards pointing to old screens.
- Prefer incremental upgrade over full rewrite.

## Implementation Batches

### Batch 0 - Audit and Specs

Create required docs and parity matrix. Stop if missing evidence.

### Batch 1 - Data and API Foundation

Repository/provider mapping, DTO mapping, CRUD endpoints, batch save, import parser, loading/error/offline handling, test fakes.

### Batch 2 - Deck List and Detail

List/detail screens, search/filter/sort, management menu, state coverage, Review ownership.

### Batch 3 - Create/Edit Set Experience

Metadata form, multi-card editor, row operations, validation, keyboard safety, unsaved-change guard, save flow.

### Batch 4 - Bulk Import

Import UX, parser, row errors, parsed edit, save flow, tests.
Import format should follow web behavior. If web behavior is not explicit, support the common flashcard import pattern only when product agrees:

- term/definition separators: tab, comma, dash
- card row separators: newline or semicolon
- preview before save
- row-level errors
- user can edit parsed rows before save

Do not silently discard invalid rows.
Do not auto-save imported rows without preview.

### Batch 5 - Flashcard CRUD

Single-card CRUD, confirmations, optional duplicate/reorder, tests.

### Batch 6 - Review/SRS Integration

Start review from deck, reveal stability, SRS actions if supported, focused route behavior.

### Batch 7 - Production Polish

360-390 dp, tablet, dark mode, long ja/vi text, touch targets, visual consistency, widget previews.

### Batch 8 - Retest Package

Create/update:

- `docs/mobile/DECK_FLASHCARD_RETEST_CHECKLIST.md`
- `docs/mobile/DECK_FLASHCARD_RETEST_PROMPT_FOR_CODEX.md`
- `docs/mobile/MOBILE_KNOWN_LIMITATIONS.md`
- `docs/mobile/MOBILE_MANUAL_QA_CHECKLIST.md`

Codex retest prompt must cover deck list/detail, create set, multi-card edit, import, deck/card edit-delete, review start/reveal, 360-390 dp, dark mode, screenshots, QA report update, no code changes unless requested.

## Verification Commands

Run after each batch:

```bash
cd apps/mobile && flutter analyze
cd apps/mobile && flutter test
git diff --check
```

If Android SDK available:

```bash
cd apps/mobile && flutter build apk --debug
```

Stop when verification is red.

## Final Response Contract

Final response using this skill must include:

1. web parity summary
2. create-set UX summary
3. API/data wiring summary
4. screens implemented
5. CRUD implemented
6. import/bulk editor status
7. review/SRS integration status
8. UI/UX polish status
9. tests added/updated
10. verification results
11. remaining limitations
12. Codex retest prompt path

## Acceptance Criteria

Skill done only when:

- create set flow is smooth on mobile
- user can create deck with multiple cards efficiently
- CRUD works without fake success
- import works when supported
- unsaved work protection exists
- deck can launch study/review
- reveal behavior remains stable
- no bottom-nav conflict in focused review
- no dead actions or fake stats
- tests pass and retest prompt is ready
