# Compact Spec 11: Learning Effectiveness and Experience

## Canonical references

Full spec sections: 13, 21.5, 21.7, 21.12, 21.14, 27, 28, 29.

## Product principle

Every sensory, social, competitive, and media element must improve learning focus, comprehension, habit formation, or visible progress. Do not add entertainment that competes with study.

## Learning science baseline

- Reduce cognitive load during study and exam workflows.
- Keep one primary learning task per screen.
- Make progress visible through real persisted data.
- Use retrieval practice, spaced repetition, remediation, and reflection loops.
- Use encouraging copy without shame, panic, or manipulation.
- Respect fatigue: allow pause, quiet mode, reduced motion, and session length controls where relevant.
- Basic reading support must remain available to free users.

## Focus and distraction rules

Avoid:
- infinite-scroll feeds in core learning flows
- autoplay audio/video
- excessive animations during quiz/exam/study
- high-saturation visual noise around Japanese text
- notification pressure during active learning
- streak anxiety or punishment framing
- social comparison that demotivates low-confidence learners

Prefer:
- calm layouts
- stable navigation
- clear next action
- timed focus sessions
- visible completion criteria
- short reflection after practice
- remediation links after mistakes

## Audio rules

Audio should support pronunciation, listening comprehension, ambience, or feedback.

Requirements:
- user-controlled playback
- captions/transcripts where applicable
- volume/mute controls
- no autoplay in study/exam flows
- no sound effects that mask Japanese audio
- reduced-stimulation or quiet mode respected
- source/provenance/license metadata for audio assets

## Image and color rules

Images and color should support meaning, context, memory, or navigation.

Requirements:
- avoid decorative clutter around dense study content
- maintain text contrast and readability
- use culturally respectful imagery
- store provenance/license metadata for external media
- avoid color-only meaning
- keep BJT exam mode visually restrained

## Video rules

Video should be used for listening, scenario context, pronunciation, or onboarding explanations.

Requirements:
- no autoplay by default
- captions/subtitles/transcripts
- playback speed controls where feasible
- clear learning objective
- file/provider abstraction
- privacy-safe analytics
- fallback state when media is unavailable

## Postcard and sharing rules

Share postcards should celebrate learning without leaking private data.

Allowed share subjects:
- achievements
- BJT quiz result summaries with estimated label
- daily phrases
- battle results
- learning streaks when user opts in

Requirements:
- privacy-safe public share page
- no private raw learning history in URLs or OG metadata
- template provenance for images/media
- user consent/settings respected
- no dark-pattern prompts to spam contacts

## Competition and gamification rules

Competition must remain learning-first.

Use:
- opt-in battle and leaderboards
- skill/band-aware matching where possible
- anti-cheat and fairness checks
- positive remediation after loss
- personal bests and mastery over vanity metrics
- cooldowns and limits if competition hurts focus

Avoid:
- pay-to-win mechanics
- public shaming
- manipulative scarcity
- unbounded competitive loops during study sessions
- fake ranks or fake opponents

## Progress clarity

Progress indicators must be backed by real persisted events/rollups:
- SRS reviews
- quiz attempts
- mock exam results
- learning path competency progress
- reading assist interactions where useful
- battle results

Do not show fake charts, fake streaks, fake rank movement, or fake coaching insights.

## Accessibility and learner comfort

Support:
- reduced motion
- quiet mode
- readable typography
- keyboard navigation for core flows
- captions/transcripts
- color contrast
- session pause/resume where relevant
- mobile ergonomics

## Review checklist

- Does this feature improve learning, focus, or motivation?
- Is the learning objective explicit in the product behavior?
- Are sensory elements user-controlled?
- Does it avoid distracting the learner from Japanese content?
- Is progress real and persisted?
- Are privacy/share boundaries safe?
- Are competition mechanics fair and opt-in?
- Are accessibility and comfort settings respected?

For practical life-in-Japan contexts such as housing, tax, pension, lottery, stocks, crypto, or banking, also read `compact/12_life_in_japan_contexts.md` and `company/gates/finance-gambling-ethics-gate.md`.
