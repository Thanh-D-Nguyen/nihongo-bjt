---
applyTo: "**"
---

# Production-First — Mandatory Standards

**This file applies to EVERY change. No exceptions. No shortcuts. No "we'll fix it later."**

Every line of code written must be production-grade from the first commit. This is not a prototype, not a hackathon, not a demo. This is a shipping product.

---

## 1. Code Quality: Production-Grade by Default

### 1.1 No Demo/Prototype Patterns — Ever
- **No localStorage for user state that belongs in the database.** User preferences, settings, progress, skipped states — all must persist server-side (PostgreSQL) and sync across devices.
- **No in-memory fake data** as the primary data source. If it needs persistence, use real DB.
- **No `console.log` left behind.** Use structured logging (Logger) or remove.
- **No `any` types** unless interfacing with truly unknown external data (and even then, validate immediately).
- **No commented-out code** committed. Use git history, not comments.
- **No TODO comments without a linked task/issue.** Naked TODOs are invisible tech debt.

### 1.2 State Must Be Server-Authoritative
- User data → PostgreSQL, always.
- UI-only ephemeral state (modal open, hover) → React state, OK.
- "Did user see this?" / "Did user skip this?" → **Server-side.** Not localStorage. Not sessionStorage. Not cookies.
- Cross-device consistency is mandatory. If I do something on mobile, it reflects on desktop.

### 1.3 API Standards (Every Endpoint)
- DTO validation with class-validator or zod.
- Proper HTTP status codes (not everything is 200).
- Auth guard where needed. No unprotected mutations.
- OpenAPI decorators for documentation.
- Error responses have consistent shape: `{ statusCode, message, error }`.
- Idempotent operations where applicable (upserts, not duplicate inserts).

### 1.4 Database Standards
- All user-facing data in PostgreSQL with proper schema.
- Migrations for schema changes (not raw ALTER in scripts).
- Indexes for any column used in WHERE/JOIN.
- Foreign keys and constraints enforced at DB level.
- Timestamps (created_at, updated_at) on all mutable tables.

### 1.5 Security Baseline (OWASP Aware)
- Never trust client input. Validate at system boundary.
- Parameterized queries only (Prisma handles this, but raw SQL must use $1, $2...).
- No secrets in code or logs.
- Rate limiting on public endpoints.
- CORS configured per environment.

---

## 2. UI/UX: World-Class or Reject

### 2.1 Trend-Defining, Not Trend-Following
- Target: 2025–2027. Build UI that sets trends, not copies them.
- If a component looks like it could exist in a 2020 Bootstrap template → reject and redesign.
- Every screen must pass the "screenshot test": would a design-savvy user share this on Twitter?
- Reference: Apple, Linear, Raycast, Notion, Arc Browser for interaction quality.

### 2.2 Non-Negotiable UI Principles
| Principle | Requirement |
|-----------|-------------|
| **Mobile-first** | 375px base. Touch targets ≥ 48px. Bottom nav for primary actions. |
| **Micro-interactions** | Every tap/click has visual feedback (scale, color shift, haptic-style animation). |
| **Loading states** | Shimmer skeletons matching content shape. Never blank screens. Never spinners alone. |
| **Empty states** | Encouraging illustration + clear CTA. Never "No data found." |
| **Error states** | Gentle, actionable. Retry button. Not raw error messages. |
| **Transitions** | Smooth, purposeful. 150-300ms. `prefers-reduced-motion` respected. |
| **Typography** | Clear hierarchy. Japanese text: line-height ≥ 1.8, proper font stack. |
| **Color** | Contextual, not decorative. Semantic color tokens. Dark mode ready. |
| **Depth** | Layering via shadows, blur, elevation. Not flat boxes. |
| **Layout** | Bento grids with size variation. No monotonous card walls. |

### 2.3 Japanese Learning UX Specifics
- Furigana toggle (always available, default based on user level).
- Kanji must be readable — minimum 1.2rem for inline, 2rem+ for study focus.
- Answer feedback: immediate, clear, non-punishing. Show correct answer with explanation.
- Study sessions: calm focus mode. No distracting notifications or badges during active study.
- Progress: real, measurable, honest. No fake streaks or inflated metrics.

### 2.4 Competitive Bar
- Better than Duolingo (more serious, less gamified noise).
- Better than WaniKani (modern UI, not 2015 design).
- Better than Bunpo (richer interactions, better content presentation).
- Better than Anki (actually beautiful, not just functional).
- If it looks like "generic SaaS" → it's wrong. Redesign.

---

## 3. Data Quality: Accurate or Don't Ship

### 3.1 Content Standards
- Japanese text must be linguistically correct (readings, meanings, JLPT levels verified).
- Vietnamese translations must be natural, not machine-translated verbatim.
- Stroke counts, kanji readings (on/kun), grammar explanations — all must be verifiable.
- No placeholder content in production paths. Seed data is clearly marked as seed.

### 3.2 Seed Data Rules
- Seed data must be production-quality (correct Japanese, correct meanings, correct metadata).
- "Insert a few" still means every entry is accurate and complete.
- Idempotent: safe to run multiple times without duplicates.
- Clearly separated from production user data.

---

## 4. Architecture: Simple Until Proven Complex

- Start with the simplest solution that solves the real problem.
- No premature abstraction. One implementation? No interface needed.
- No "flexibility" for hypothetical future requirements.
- If you need a pattern (repository, service, guard), use it. If you don't, don't.
- Monorepo packages exist for shared code. Don't duplicate across apps.

---

## 5. Verification Before Claiming Done

- Code compiles without errors.
- No TypeScript `any` leaks in new code.
- API endpoints respond correctly (test with curl or Postman equivalent).
- UI renders correctly on mobile (375px) and desktop (1280px+).
- Cross-device behavior works (no localStorage hacks for persistent state).
- i18n keys exist for all user-facing text.

---

**If you're about to write something and think "this isn't production-ready but..."** — STOP. Make it production-ready first. There is no "later" for quality.
