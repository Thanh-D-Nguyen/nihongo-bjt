# Social, Battle, and Postcard Product Layer

## Mission

Make NihonGo BJT feel less lonely and less stressful without weakening learning focus or exam integrity.

This layer covers:

- bot interactions;
- battle modes;
- rematches and lightweight competition;
- privacy-safe public share pages;
- SNS sharing;
- share postcard templates and preview;
- referral/social campaigns when they are tied to learning progress.

## Product Principle

Interaction is not decoration. Every social or battle feature must support one of these outcomes:

1. help learners practice retrieval;
2. help learners recover from mistakes;
3. help learners feel accompanied;
4. help learners share a safe, meaningful milestone;
5. help learners return to the next study action.

If a social mechanic only increases clicks, pressure, or vanity metrics, reject it.

## Tone

Use:

- supportive challenge;
- coach-like encouragement;
- opt-in sharing;
- calm celebration;
- concrete learning next steps.

Avoid:

- public shame;
- manipulative streak anxiety;
- pay-to-win competition;
- fake scarcity;
- fake opponents;
- autoplay celebration;
- forced share prompts.

## Bot Interaction

Bots must be transparent and learning-aware.

Required:

- clearly label bot opponents as bots;
- persona, difficulty, accuracy, and response-delay tuning come from backend/admin-managed config when available;
- battle result should point to a real weak skill or next practice action;
- no claim that a bot is a real user;
- no fake online presence.

Useful bot archetypes:

- `coach`: slower, explains gently, suited to weak-skill recovery;
- `rival`: balanced challenge, suited to daily retrieval;
- `mentor`: higher difficulty, suited to J1/J1+ practice;
- `boss`: timed integrated-comprehension challenge, opt-in only.

## Battle Modes

Battle should start with bot battle and expand carefully.

Recommended modes:

- quick duel: 5 BJT questions, low pressure;
- section sprint: one BJT section under gentle time pressure;
- weak-skill rematch: questions from known weak tags;
- boss challenge: advanced integrated questions;
- friend/PvP room: later, after fairness and moderation are ready.

Required data:

- real BJT question pool;
- battle config;
- battle session;
- battle rounds;
- completion/abandon/fairness analytics;
- bot tuning data.

## SNS Share and Public Pages

Sharing must be privacy-safe by design.

Allowed share topics:

- achievement milestone;
- BJT quiz result with estimated label;
- daily phrase/card;
- battle result;
- comeback completion;
- weak-skill improvement.

Public share page requirements:

- use opaque public token;
- never expose raw user id, session id, private notes, or private answer history;
- OG metadata must be minimal and safe;
- user must opt in before public postcard/share creation;
- support hide/delete/moderation workflows where implemented.

## Postcard Templates

Postcards are a core emotional layer, not a screenshot hack.

Required:

- template selection before share;
- preview before publishing;
- template config persisted through `ShareTemplate` or a provider abstraction;
- rendered image generated server-side or through an explicit renderer/provider;
- provenance/license metadata for external/generated visual assets;
- accessible text alternative where the postcard is shown in-app.

Template families:

- quiet achievement card;
- exam sprint result;
- battle victory/rematch;
- daily phrase;
- comeback milestone;
- weak-skill improvement.

Design rules:

- readable Japanese/Vietnamese text;
- no cluttered badge spam;
- no fake rank or fake score;
- estimated scores clearly labeled;
- color variants are semantic or template-driven, not random.

## Backend Escalation

Do not fake this layer in frontend state.

If a frontend slice needs missing support, route to `bjt-backend` first or in the same slice for:

- share template listing/detail/preview;
- share item creation;
- public share snapshot;
- rendered postcard image;
- battle config listing;
- bot persona/config listing;
- battle session lifecycle;
- analytics events;
- moderation/hide/delete actions;
- consent/opt-in checks.

Known backend anchors to inspect first:

- `ShareTemplate`
- `ShareItem`
- `ShareCardAsset`
- `BattleConfig`
- `BattleBot`
- `BattleSession`
- `BattleRound`
- `AnalyticsEvent`
- `apps/api/src/growth/share.service.ts`
- `apps/api/src/growth/share-image.renderer.ts`
- `apps/api/src/battle/*`

## Required Agent Routing

Use these specialists for any battle/share/postcard slice:

- `bjt-social-experience`: social action, SNS UX, public-page privacy posture, growth ethics;
- `bjt-postcard-visual-designer`: template visual system, postcard preview quality, share image composition;
- `bjt-learning-science`: motivation, pressure, focus, learner wellbeing;
- `bjt-media-experience`: media, motion, accessibility, provenance;
- `bjt-security`: privacy, public token, OG metadata, consent;
- `bjt-backend`: missing API/provider/schema/runtime support;
- `bjt-learner-ui`: implementation in learner app;
- `bjt-qa`: tests and runtime verification.

Use the smallest set required by the slice, but do not skip security for public share surfaces.

## Done Criteria

This layer is production-ready only when:

- social action is opt-in;
- public data is minimal;
- postcard can be previewed before sharing;
- selected template is persisted or represented by a real provider contract;
- share image is rendered through a real backend/provider path;
- battle uses real sessions/questions;
- bot identity is transparent;
- analytics events are real;
- i18n keys cover user-facing copy;
- mobile share flow is usable;
- Open Design BJT and growth ethics gates pass.
