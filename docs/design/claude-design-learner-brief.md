# Claude Design Brief - KotobaWorks Learner Web and Mobile UI

Use this document as the single source brief for designing the learner-facing web and mobile UI for KotobaWorks / Nihongo BJT.

Do not design admin screens. Do not generate production code. The expected output is a complete product design package that engineers can later implement in the existing codebase.

## 1. Role

You are Claude Design acting as a senior product designer, mobile app designer, and design systems lead.

Your job is to design the complete learner experience for a production-grade Japanese and BJT learning product used by Vietnamese adults preparing for work, exams, and daily life in Japan.

The design must be strong enough that an engineering team can later rebuild the UI from your screens, component specifications, interaction notes, and responsive rules.

## 2. Product Context

Product name: KotobaWorks / Nihongo BJT.

Audience:

- Vietnamese adults learning Japanese for the BJT exam.
- Learners preparing for work in Japanese business environments.
- Learners living in or planning to live in Japan.
- Users who need both serious exam preparation and practical daily-life Japanese.

Product promise:

- Help learners understand Japanese, practice consistently, recover from mistakes, and see real progress.
- Combine serious BJT preparation with joyful but restrained daily learning.
- Reduce Japanese reading friction through reusable reading assist: furigana, readings, meanings, audio, and add-to-flashcard actions.

The product must not feel like:

- A generic SaaS dashboard.
- A childish gamified learning app.
- A fake demo with pretty cards but no real workflow.
- A marketing landing page.
- A copied version of Duolingo, Quizlet, WaniKani, Bunpo, Mazii, or Anki.

Competitive judgment:

- More serious and less noisy than Duolingo.
- More modern than WaniKani.
- Richer and clearer than Bunpo.
- More beautiful and guided than Anki.
- Search/reference depth can be inspired by Mazii, but the visual design must not copy it.
- Study flow clarity can be inspired by Quizlet, but the visual design must not copy it.

## 3. Design Direction

Design direction: Quiet Mastery for Business Japanese.

Atmosphere:

- Calm.
- Premium.
- Precise.
- Supportive.
- Japanese-editorial.
- High-trust learning coach plus calm exam cockpit.

The learner should feel:

- "I know what to do next."
- "This app respects my focus."
- "Difficult Japanese becomes understandable."
- "My mistakes turn into the next study action."
- "My progress is real, not inflated."

Quiet must not mean bland. Every screen needs:

- A clear focal point.
- Strong hierarchy.
- Decisive primary actions.
- Memorable KotobaWorks identity.
- Enough visual refinement to feel like a real product.

## 4. Hard Scope

Design only learner-facing web and mobile experiences.

Include:

- Learner web app.
- Learner mobile app.
- Shared learner design system.
- Shared components.
- Reading Assist layer.
- Study, review, quiz, mock exam, search, progress, profile, onboarding, monetization, and sharing surfaces.

Exclude:

- Admin dashboard.
- Admin content management.
- Admin analytics.
- Backend architecture diagrams.
- Production code.
- Database schema.
- Marketing-only landing pages unless needed as a logged-out entry point.

## 5. Technical Handoff Assumptions

The engineering team will implement the UI later in an existing monorepo.

Likely implementation targets:

- Web learner app: Next.js.
- Mobile app: Flutter or React Native.
- Shared design language should be portable across web and mobile.

Design output should include enough implementation detail for:

- Design tokens.
- Component variants.
- Responsive behavior.
- Empty/loading/error states.
- Accessibility requirements.
- Interaction and motion rules.
- i18n copy placeholders.

All visible copy must be treated as example copy that will become i18n keys. Do not hard-code final product strings as if they are implementation-ready.

## 6. Brand System

### Core Colors

Use this palette as the source of truth. You may create tints and surface variants, but do not invent an unrelated palette.

- Primary Navy: `#1B2A4A`
- Navy Hover: `#243560`
- Navy Pressed: `#141F38`
- Canvas: `#F8FAFC`
- Surface: `#FFFFFF`
- Surface Hover: `#F1F5F9`
- Ink Text: `#111827`
- Secondary Text: `#4B5563`
- Tertiary Text: `#9CA3AF`
- Border: `#E2E8F0`
- Border Hover: `#CBD5E1`
- Interactive Blue: `#3B82F6`
- Blue Hover: `#2563EB`
- Blue Light: `#DBEAFE`
- Sky Highlight: `#EFF6FF`
- Success / Correct: `#059669`
- Success Background: `#ECFDF5`
- Warning: `#D97706`
- Warning Background: `#FFFBEB`
- Danger / Incorrect: `#DC2626`
- Danger Background: `#FEF2F2`
- Sakura Reward: `#F9A8D4`
- Gold Reward / Premium: `#F59E0B`

### Learning State Colors

- SRS New: `#8B5CF6`
- SRS Learning: `#F59E0B`
- SRS Review: `#3B82F6`
- SRS Mastered: `#059669`
- Battle Player: `#3B82F6`
- Battle Opponent: `#EF4444`
- Timer: `#F59E0B`
- Timer Urgent: `#DC2626`

### Color Rules

- Navy is the authority anchor, not a color to flood every surface.
- Blue is for interaction and links.
- Semantic colors must carry meaning, not decoration.
- Sakura and gold are sparse reward accents only.
- Do not let the whole app become one-hue blue, purple, beige, brown, or dark slate.
- Avoid pure black. Use `#111827`.
- Do not use AI-purple gradient dominance.
- Do not use neon, cyberpunk, crypto aesthetics, childish claymorphism, or heavy glassmorphism.

## 7. Typography

Use:

- Vietnamese / Latin UI: Inter.
- Japanese text: Noto Sans JP.
- Monospace only where needed: JetBrains Mono or similar.

Rules:

- Japanese content must be readable and spacious.
- Japanese body line-height: 1.6 to 1.8.
- Japanese example sentences: around 1.8.
- Vietnamese body line-height: around 1.6.
- Minimum Japanese text size: 14px.
- Inline Japanese should generally be at least 1.2rem where it is the learning object.
- Study focus kanji/headword should be 2rem or larger where appropriate.
- Furigana must not collide with lines above or below.
- Use tabular numerics for timers, scores, quotas, streaks, and analytics numbers.
- No negative letter spacing.

Suggested scale:

- Web display: 36px desktop, 28px mobile.
- Web H1: 30px desktop, 24px mobile.
- Web H2: 24px desktop, 20px mobile.
- Web H3: 20px desktop, 18px mobile.
- Body: 15px desktop, 14px mobile.
- Caption: 12px desktop, 11px mobile.
- Japanese headword: 28px desktop, 24px mobile.
- Flashcard front: 32px desktop, 28px mobile.

## 8. Layout Principles

Use:

- Calm, task-first layouts.
- Generous whitespace around Japanese learning content.
- Progressive disclosure for dense reference data.
- Bento-style variation only where it supports hierarchy.
- Cards for meaningful content groups, not decorative walls.
- Clear section titles and action areas.
- Sticky primary actions only when they improve usability and do not obscure content.

Avoid:

- Generic dashboard card walls.
- Dense enterprise tables on learner screens.
- Nested card inside card patterns.
- Decorative hero sections inside authenticated app workflows.
- Oversized marketing typography inside compact product surfaces.
- Random shadows, random borders, and random accent colors.
- Cluttered toolbars in study or exam mode.

Responsive expectations:

- Web desktop: 1440px.
- Web tablet: 768px.
- Web mobile: 375px.
- Native mobile: 375px and 430px widths.
- Touch targets: at least 44px on web mobile, 48px for native mobile primary controls.

## 9. Motion and Interaction

Motion should help orientation and feedback only.

Rules:

- Tap/click feedback: subtle scale, color shift, or pressed state.
- Typical duration: 150ms to 300ms.
- Respect reduced motion.
- No distracting animation during active study or exam.
- No surprise autoplay audio or video.
- Audio starts only from explicit learner action.
- Every button/control needs default, hover where relevant, focus-visible, active, loading, and disabled states.
- One primary CTA per viewport.

## 10. Accessibility

Design must support:

- Visible focus states.
- Keyboard navigation on web.
- Proper contrast.
- Semantic hierarchy.
- Screen-reader friendly labels for icon buttons.
- Large enough hit areas.
- Reduced motion.
- Error recovery.
- Japanese readability with furigana.

Do not rely only on color to communicate correctness, error, premium state, or selected state.

## 11. Core Learner Web Screens

Design the following web screens and key states. Do not include admin screens.

### 11.1 Logged-Out Entry / Auth

Purpose:

- Introduce KotobaWorks quickly and let learners sign in or start onboarding.

Requirements:

- Keep it product-focused, not a long marketing page.
- Show BJT learning, daily-life Japanese, and reading assist as first-viewport signals.
- Include login, registration, and social auth entry points as provider-abstracted options.
- Include loading, validation, and error states.

### 11.2 Onboarding and Placement

Purpose:

- Capture learner goal, level, target BJT band, daily study habit, and reading assist preferences.

Requirements:

- Short, respectful flow.
- No pressure copy.
- Show progress through steps.
- Make skipping/continuing clear where product-appropriate.
- Output should feel useful, not bureaucratic.

### 11.3 Learner Home / Daily Hub

Purpose:

- Show the next best learning action for today.

Content:

- Continue learning.
- Daily phrase.
- Review due.
- BJT readiness snapshot.
- Learning path progress.
- Mistake remediation queue.
- Gentle streak / XP.
- Daily-life Japanese prompt.

Rules:

- One primary action.
- Avoid generic metric dashboard feel.
- Progress must look honest and data-backed.
- Empty/degraded states must still guide the learner.

### 11.4 Learn / Learning Paths

Purpose:

- Help learners choose and continue structured learning.

Content:

- Recommended path.
- BJT competency areas.
- Daily-life contexts.
- Lesson list.
- Lesson detail.
- Completion/progress.

Rules:

- Show why a recommendation exists.
- Do not fake adaptivity.
- Keep hierarchy scannable.

### 11.5 Lesson / Reading Content

Purpose:

- Teach Japanese with strong reading support.

Content:

- Japanese passage or sentence.
- Furigana toggle.
- Reading assist.
- Vietnamese explanation.
- Key vocabulary.
- Grammar note.
- Examples.
- Practice CTA.
- Save/add-to-flashcard action.

Rules:

- Japanese text is the visual focus.
- Vietnamese supports comprehension but should not overpower the Japanese.
- Long explanations should be scan-friendly.

### 11.6 Global Search / Dictionary

Purpose:

- Let learners find words, kanji, grammar, examples, and saved items.

Content:

- Search box.
- Recent searches.
- Result categories.
- Result list.
- Detail panel.
- Headword.
- Reading.
- Vietnamese meaning.
- Examples.
- Audio.
- Save/bookmark.
- Add to flashcards.
- Related entries.

Rules:

- Search should feel deep and useful, not like a thin index.
- Use progressive disclosure for advanced data.
- Desktop can use list-detail layout.
- Mobile web should stack naturally.

### 11.7 Kanji Detail

Purpose:

- Make a kanji understandable and studyable.

Content:

- Large kanji.
- On/kun readings.
- Vietnamese meaning.
- compounds.
- examples.
- stroke/order placeholder only if data exists.
- related flashcards.
- practice CTA.

Rules:

- The kanji must be prominent and readable.
- Do not overcrowd first view.

### 11.8 Flashcards / Decks

Purpose:

- Manage and review saved learning items.

Content:

- Deck list.
- Review due counts.
- Card preview.
- Bulk states.
- Empty deck state.
- Import/add manual card entry concept.

Rules:

- Connected to real decks/SRS in future implementation.
- No fake local-only persistence patterns in the design notes.

### 11.9 SRS Review Session

Purpose:

- Review cards quickly and calmly.

Content:

- Card front/back.
- Japanese focus.
- reveal answer.
- confidence actions.
- audio.
- reading assist where allowed.
- progress.
- mistake handling.

Rules:

- Low-distraction.
- Clear answer feedback.
- Mistakes should become remediation.

### 11.10 Practice / Quiz

Purpose:

- Practice retrieval and learn from wrong answers.

Content:

- Question stem.
- Japanese text.
- Answer choices.
- Progress.
- Feedback.
- Explanation.
- Correct answer.
- Add mistake to flashcards.
- Continue/retry.

Rules:

- Wrong answer copy must be non-shaming.
- Feedback should be immediate and useful.

### 11.11 Mock BJT Exam

Purpose:

- Simulate serious timed BJT practice.

Content:

- Timer.
- Question progress.
- Question navigation.
- Answer options.
- submit/flag.
- break/end confirmation.
- result screen.
- estimated BJT score/band label.
- remediation plan.

Rules:

- Exam mode is a quiet cockpit.
- No meanings revealed during active timed exam.
- Reading assist may show permitted readings/furigana only if product mode allows it; meanings should appear only after answering or outside timed exam mode.
- Avoid playful rewards during active exam.

### 11.12 Battle / Social Practice

Purpose:

- Provide opt-in motivation without shame or privacy leakage.

Content:

- Matchmaking.
- live round.
- score.
- opponent state.
- post-battle result.
- rematch.
- share result.

Rules:

- No pay-to-win feeling.
- No public exposure of private learning details.
- Keep it energetic but still aligned with serious learning.

### 11.13 Progress / Analytics / Coaching

Purpose:

- Help learners understand real progress and next actions.

Content:

- Study consistency.
- SRS workload.
- competency progress.
- estimated BJT band.
- strengths.
- weaknesses.
- recommended next practices.

Rules:

- Estimated scores must be labeled estimated.
- No fake vanity charts.
- Data should feel honest.
- Charts should be calm, readable, and actionable.

### 11.14 Profile / Me / Settings

Purpose:

- Manage identity, goals, preferences, privacy, sharing, and plan state.

Content:

- Profile.
- learning goal.
- target BJT band.
- daily goal.
- language settings.
- reading assist preferences.
- notification preferences.
- privacy/sharing settings.
- subscription/plan/quota state.

Rules:

- Settings should feel trustworthy.
- Paywall and quota states must not use dark patterns.

### 11.15 Monetization / Upgrade

Purpose:

- Respectfully explain plan limits and upgrade value.

Content:

- Current plan.
- quota state.
- premium benefits.
- upgrade CTA.
- compare plans.
- restore/manage subscription concept.

Rules:

- Enforcement is server-side in implementation; design must not imply frontend-only gating.
- No manipulative countdowns or shame copy.
- Basic reading support should remain available to free users.

### 11.16 Sharing / Achievement Postcard

Purpose:

- Let learners share achievements safely.

Content:

- Public-safe postcard preview.
- achievement or quiz result summary.
- privacy note.
- copy link/share actions.

Rules:

- Do not expose private learning history.
- Do not expose sensitive score detail unless explicitly consented.
- Public metadata should be safe.

## 12. Core Native Mobile Screens

Design a native mobile learner app experience using the same product language, adapted for mobile.

### 12.1 Mobile Navigation

Use 5 primary tabs:

1. Home
2. Learn
3. Review
4. Practice
5. Me

Search can be:

- A prominent action from Home.
- A top-level action in Learn.
- A floating or top-bar action if it does not crowd the tab model.

### 12.2 Mobile Onboarding

Design:

- Welcome.
- goal selection.
- current level.
- target BJT band.
- daily study goal.
- reading assist preference.
- account/sign-in step if needed.

Rules:

- Short and respectful.
- Thumb-friendly controls.
- No long forms.

### 12.3 Mobile Home

Design:

- Daily next action.
- review due.
- daily phrase.
- quick resume.
- BJT readiness.
- streak/XP lightly.
- daily-life Japanese card.

Rules:

- The top of Home should make the next action obvious within 3 seconds.
- No dense dashboard.

### 12.4 Mobile Learn

Design:

- learning paths.
- lesson list.
- daily-life contexts.
- lesson detail.
- reading content.

Rules:

- Mobile layouts should stack cleanly.
- Japanese text needs breathing room.

### 12.5 Mobile Review

Design:

- review queue.
- card session.
- reveal answer.
- confidence controls.
- session summary.

Rules:

- Main controls in thumb zone.
- Keep answer actions stable in size and location.

### 12.6 Mobile Practice

Design:

- quiz selection.
- question player.
- answer choices.
- feedback.
- summary.
- mock exam entry.

Rules:

- Use sticky bottom CTA only when useful.
- Avoid tiny answer controls.

### 12.7 Mobile Mock Exam

Design:

- focused timer.
- question count.
- answer options.
- flag/skip where allowed.
- submit confirmation.
- results/remediation.

Rules:

- No distractions.
- No meaning reveal during active timed exam.
- Strong state clarity for selected answer and time pressure.

### 12.8 Mobile Search / Dictionary

Design:

- search entry.
- results.
- detail.
- audio.
- save.
- add-to-flashcard.
- reading assist.

Rules:

- Result list and detail must be easy to navigate one-handed.
- Use bottom sheets where appropriate.

### 12.9 Mobile Reading Assist

Design:

- tap Japanese text to reveal reading/furigana/meaning.
- bottom sheet or compact popover.
- audio.
- add to flashcard.
- save.

Rules:

- Avoid tooltip clutter.
- Meanings are restricted during timed exam mode.
- Basic reading support remains available to free users.

### 12.10 Mobile Me / Profile

Design:

- profile summary.
- goals.
- progress summary.
- reading assist settings.
- language.
- notifications.
- privacy.
- plan/quota.

Rules:

- Calm settings structure.
- Avoid pushing premium aggressively.

## 13. Required Components

Design these components with variants, states, and usage notes.

Navigation:

- Web app shell.
- Web sidebar/topbar patterns where appropriate.
- Native mobile bottom nav.
- Breadcrumbs where useful.
- Mobile top app bar.

Core UI:

- Button.
- Icon button.
- Input.
- Search input.
- Select/dropdown.
- Segmented control.
- Tabs.
- Card.
- Badge/pill.
- Progress bar.
- Progress ring.
- Modal.
- Bottom sheet.
- Tooltip/popover.
- Toast/snackbar.
- Table/list row only where learner-facing use is justified.

Learning:

- Japanese text block.
- Furigana toggle.
- Reading Assist popover/bottom sheet.
- Audio/read-aloud button.
- Save/bookmark button.
- Add-to-flashcard button.
- Lesson card.
- Daily phrase card.
- Learning path card.
- Flashcard.
- Deck card.
- Review queue card.
- Quiz answer option.
- Feedback panel.
- Explanation panel.
- Exam timer.
- Question navigator.
- Result summary.
- Remediation queue item.
- Achievement badge.
- Share postcard.
- Quota/paywall card.

States:

- Loading skeleton.
- Empty state.
- Error state.
- Offline/degraded state.
- Disabled state.
- Success state.
- Warning state.
- Destructive confirmation.

## 14. Content and i18n Guidance

Use realistic sample content in Vietnamese and Japanese, but mark it as example copy.

Examples are allowed:

- Daily phrase: "お世話になっております"
- Vietnamese meaning: "Cảm ơn anh/chị đã luôn hỗ trợ tôi."
- BJT context: "Email công việc", "Cuộc họp", "Báo cáo tiến độ"
- Practice feedback: "Chưa đúng. Cách dùng này thường xuất hiện trong email trang trọng."

Do not use lorem ipsum.

All final implementation copy will go through i18n keys. Your design handoff should name copy areas clearly enough that engineers can create message keys later.

Tone:

- Supportive.
- Precise.
- Calm.
- Adult.
- No shame.
- No manipulative urgency.
- No childish jokes during study or exam.

## 15. Loading, Empty, Error, and Offline States

Every major screen must include:

- Loading state with skeleton matching the content shape.
- Empty state with useful explanation and next action.
- Error state with calm copy and retry action.
- Offline/degraded state where relevant.

Avoid:

- Spinner-only loading.
- "No data found."
- Raw technical errors.
- Blank screens.
- Fake progress while data is unavailable.

## 16. Privacy, Sharing, and Trust

Design must protect learner trust.

Rules:

- Sharing must be privacy-safe.
- Public share previews must not expose private learning history.
- Exam results and estimated BJT band should not be public unless the user explicitly shares.
- Profile/settings must make privacy controls understandable.
- Paywalls and ads must be visually distinct from learning controls.
- Ads must never interrupt active study, review, or timed exam flows.

## 17. Monetization UX

Design monetization-ready learner UI, but keep it respectful.

Include:

- Plan/upgrade page.
- Quota state.
- Gated feature state.
- Premium badge.
- Manage plan concept.

Rules:

- No frontend-only paywall logic in handoff notes.
- Mention that real enforcement should come from backend contracts.
- Do not scatter "premium" styling everywhere.
- Keep core learning dignity intact.
- Basic reading support should remain free.

## 18. Output Requirements

Claude Design should produce one complete design package covering both web and mobile.

Required output:

1. Design concept summary.
2. Shared design tokens.
3. Web information architecture.
4. Mobile information architecture.
5. Web screen designs for desktop, tablet, and mobile web.
6. Native mobile screen designs for 375px and 430px widths.
7. Component library with variants and states.
8. Reading Assist interaction model.
9. Study/review/quiz/exam interaction model.
10. Loading, empty, error, offline state designs.
11. Accessibility notes.
12. Motion notes.
13. i18n/copy notes.
14. Implementation handoff notes for engineering.
15. Final QA checklist.

For each screen, include:

- User intent.
- Layout structure.
- Primary action.
- Secondary actions.
- Content hierarchy.
- Data/state assumptions.
- Loading state.
- Empty state.
- Error state.
- Responsive behavior.
- Accessibility notes.
- Engineering handoff notes.

## 19. Quality Bar

Before finalizing, self-review the design against this checklist:

- Does the product feel like serious BJT learning, not a generic LMS?
- Is the main action obvious within 3 seconds?
- Is Japanese content readable and visually respected?
- Does Reading Assist feel reusable, not like one-off tooltips?
- Does the mock exam preserve exam integrity?
- Are mistakes converted into next learning actions?
- Are progress and scores framed honestly?
- Are empty/error/loading states designed for every major flow?
- Does mobile feel native and thumb-friendly?
- Does web feel spacious and focused, not a dashboard wall?
- Are premium states respectful and non-manipulative?
- Is sharing privacy-safe?
- Are all controls accessible?
- Is the style distinctive without becoming decorative?

## 20. Absolute Do-Nots

Do not:

- Design admin screens.
- Generate code.
- Create a generic SaaS dashboard.
- Create a marketing-first landing page as the main product.
- Use lorem ipsum.
- Copy external products visually.
- Use fake charts or fake progress in the design language.
- Reveal meanings during active timed BJT exam mode.
- Use shame-based motivation.
- Use manipulative paywall patterns.
- Make Japanese text cramped.
- Hide key study actions behind decorative visuals.
- Use heavy glassmorphism, neon, cyberpunk, childish claymorphism, or AI-purple gradients.
- Use decorative 3D or parallax in core study flows.

## 21. First Message Claude Design Should Return

Start by briefly confirming this interpretation:

```text
I will design a complete learner-only KotobaWorks UI package for both web and mobile: shared design system, learner web screens, native mobile screens, Reading Assist, study/review/quiz/exam flows, responsive states, component specs, and QA checklist. I will exclude admin screens and will not generate production code.
```

Then proceed with the design work.
