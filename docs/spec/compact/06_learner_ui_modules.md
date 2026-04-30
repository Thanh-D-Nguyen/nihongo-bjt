# Compact Spec 06: Learner UI Modules

## Canonical references

Full spec sections: 13, 21.5, 21.7, 21.8, 21.12, 27.5-27.8, 28, 29.10.

## Learner routes and areas

Expected learner experience includes:
- home/daily life hub
- dictionary
- kanji
- grammar
- ViJa
- global search
- flashcards
- study
- bookmarks
- BJT levels
- quiz/mock exam
- battle
- learning paths
- profile
- learner analytics/coaching
- onboarding/placement
- privacy/settings
- sharing/referral surfaces

## UX rules

- Mobile-first, responsive, calm, premium, supportive.
- No shame-based messaging.
- Estimated BJT score/band must be clearly labeled as estimated.
- User-facing text uses i18n keys.
- No fake progress or fake analytics.
- Offline/PWA behavior must not corrupt canonical data.

## Study and flashcard UX

- Connect to real deck/card/SRS APIs.
- Persist review results and progress.
- Support remediation from quiz/exam mistakes into cards.
- Show empty/error/loading/degraded states.

## Quiz and exam UX

- Timed BJT exam mode must not reveal meanings during active exam unless practice/help mode allows it or after answering.
- Results must be persisted and tied to remediation/analytics where implemented.

## Reading assist layer

Japanese text components should be able to opt into:
- hover/tap reading
- furigana
- meanings
- add-to-flashcard actions
- analytics events

Basic reading support remains available to free users. Use a reusable product layer, not page-specific demo tooltips.

## Sharing

Use privacy-safe public share pages and generated share postcards for achievements, BJT quiz results, daily phrases, and battle results. Do not expose private learning data in share URLs or OG metadata.

## Learning paths

Learning paths must connect to real competency/progress data. Adaptive/recommended sequencing should be explainable and not just static fake cards.

## Route checklist

Each learner route should include:
- real API/client contract where data is domain-owned
- loading state
- empty state
- error state
- offline/degraded state where relevant
- responsive layout
- i18n labels
- accessible controls
- analytics event only when real tracking exists

## Japanese text checklist

For Japanese text that learners may not read:
- use the reusable Reading Assist layer when appropriate
- allow furigana/readings where supported
- avoid revealing meanings during timed exam mode
- support add-to-flashcard when context permits
- keep free-tier basic reading support

## Share UX checklist

Share surfaces must:
- generate privacy-safe public URLs
- avoid private raw learning history
- use safe OG metadata
- respect user consent/settings
- connect to real share templates/providers or an explicit local provider

## Premium UX checklist

When a learner hits a gated feature:
- show respectful upgrade messaging
- do not use dark patterns
- keep backend as enforcement source
- show quota state only from server contract
- avoid hard-coded `isPremium` branches

## Product quality checks

- Does the route help a real learner complete a task?
- Does it avoid fake progress?
- Does it handle slow/failing APIs?
- Does it remain usable on mobile?
- Does it preserve learning focus and exam integrity?

For sensory media, motivation loops, postcards, sharing, or competition, also read `compact/11_learning_effectiveness_experience.md`.

For housing, banking, tax, insurance, pension, lottery/probability, investment, crypto, or other practical Japan-life contexts, also read `compact/12_life_in_japan_contexts.md`.
