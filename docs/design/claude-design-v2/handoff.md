# KotobaWorks / Nihongo BJT — Learner UI Handoff

Implementation spec for engineering. Pair with `tokens.json` (values) and `frames/` (visual reference).
**Scope:** learner web + native mobile. **Admin excluded.** All copy is example → i18n keys.

---

## 1. Information architecture

### Web (authenticated shell)
Top bar: logo · primary nav (`Trang chủ` / `Học` / `BJT` / `Ôn tập` / `Tiến độ`) · global search · avatar. Footer trust strip on every app page (`Trợ giúp` / `Quyền riêng tư` / `Điều khoản` / `Hỗ trợ` / locale).
- **Trang chủ (Home/Hub)** → continue, review-due, remediation, daily phrase, BJT readiness, streak, daily-life prompt
- **Học (Learn)** → recommended path · competency areas (Listening / Listening-Reading / Reading) · daily-life contexts · lesson list → **Lesson/Reading**
- **BJT** → practice vs official mode select · rank J5–J1+ · → **Quiz** / **Mock Exam**
- **Ôn tập (Review)** → decks/flashcards · **SRS Review session**
- **Tiến độ (Progress)** → consistency · SRS workload · competency · estimated band · recommendations
- Global: **Search/Dictionary** (list-detail) → **Kanji detail**; **Profile/Settings**; **Monetization**; **Share**

### Native mobile — 5 tabs
`Home` · `Learn` · `Review` · `Practice` · `Me`. Search is a prominent action from Home and a top action in Learn (not a 6th tab). Reading Assist surfaces as a bottom sheet anywhere Japanese is shown.

---

## 2. Screen specs

Each screen lists: **intent · primary action · secondary · hierarchy · data/state · loading · empty · error · responsive · a11y · eng notes.** States summarized once in §5 (matrix); per-screen notes call out only specifics.

### 2.1 Logged-out / Auth — `19-web-auth.png`
- **Intent:** introduce KotobaWorks fast; sign in / start onboarding. Product-focused, not marketing.
- **Primary:** Đăng nhập. **Secondary:** social auth (provider-abstracted), `Bắt đầu miễn phí` (register).
- **Hierarchy:** left navy brand panel (3 value signals: BJT, reading assist, work/daily) · right form.
- **Data/state:** email/password validation; provider buttons abstract OAuth providers (no provider hard-coding in UI logic). Loading on submit; inline field validation; calm auth error.
- **Responsive:** two-panel ≥768; stacks to single column on mobile web (form first).
- **a11y:** labelled fields, error text tied via `aria-describedby`, focus ring on submit.

### 2.2 Onboarding & placement — `08-mobile-onboarding.png`
- **Intent:** capture goal, level, target BJT band, daily habit, reading-assist preference. Short, respectful, no pressure.
- **Primary:** Tiếp tục. **Secondary:** Bỏ qua (where product-appropriate), back.
- **Hierarchy:** step progress (e.g. 2/5) · question · large tap options (selected = navy border + check).
- **Responsive:** thumb-friendly 48px option rows; same flow on web (centered, narrower).
- **a11y:** options are radio semantics; progress announced; never color-only selection (check icon + border).

### 2.3 Home / Daily Hub — `09-mobile-home.png`, `20-web-home.png` *(chosen: guided today-plan)*
- **Intent:** make the single next action obvious within 3 seconds.
- **Primary:** Tiếp tục (step 1 of today's plan). **Secondary:** review-due, remediation, daily phrase audio.
- **Hierarchy:** today-plan timeline spine — Step 1 *continue* (navy hero) → Step 2 *review 24 due* → Step 3 *fix 6 mistakes*; supporting: daily phrase, BJT readiness (estimated), streak, daily-life prompt.
- **Data/state:** all values are real/server-backed; estimated band labelled `ước lượng`. No fake charts.
- **Empty/degraded:** if no plan yet → guide to onboarding/first lesson; never a blank hub.
- **Responsive:** web ≥1280 = spine + 300px rail; 768 = spine then rail as 2-up; <640 = stack. Native 375/430 = spine + bottom tabs.
- **a11y:** timeline steps are an ordered list; one primary CTA; streak is informational, never anxiety copy.

### 2.4 Learn / Paths — `10-mobile-learn.png`, `21-web-learn.png`
- **Intent:** choose & continue structured learning; show *why* a path is recommended.
- **Primary:** Tiếp tục lộ trình. **Secondary:** open competency area, daily-life context, lesson.
- **Hierarchy:** recommended path (with reason chip + progress) · competency cards (Listening/Listening-Reading/Reading with % ) · lesson list (done / in-progress / locked) · contexts.
- **Data/state:** recommendation reason is explicit and truthful — do not fake adaptivity.
- **Responsive:** web = path hero + competency grid + lesson list, contexts in rail; mobile stacks.

### 2.5 Lesson / Reading — `11-mobile-lesson.png`, `22-web-lesson.png`
- **Intent:** teach Japanese with strong reading support; Japanese is the visual focus.
- **Primary:** Luyện tập (practice CTA). **Secondary:** furigana toggle, save, add-to-flashcard, audio, Reading Assist.
- **Hierarchy:** JP passage (large, LH 2.0) → VN explanation (recedes) → key vocab rows (add ＋) → grammar note.
- **Data/state:** furigana toggle persists per learner preference.
- **a11y:** furigana ruby never collides (passage LH 1.8+); toggle is a labelled switch.

### 2.6 Search / Dictionary — `15-mobile-search.png`, `23-web-search-dictionary.png`
- **Intent:** deep, useful lookup (words, kanji, grammar, examples, saved). Not a thin index.
- **Primary:** open result detail. **Secondary:** audio, save, add-to-flashcard, related.
- **Hierarchy:** search box · filters (Tất cả/Từ vựng/Kanji/Ngữ pháp) · results list · **detail** (headword, reading, VN meaning, examples, related).
- **Responsive:** **desktop = list-detail** (380px list + detail pane); mobile stacks list → detail (push), bottom sheets for actions.
- **Empty:** "không tìm thấy X — thử cách viết khác / thêm thủ công". **Offline:** only saved items searchable.

### 2.7 Kanji detail — `24-web-kanji.png`
- **Intent:** make a kanji understandable & studyable; kanji is prominent, first view uncrowded.
- **Primary:** Luyện kanji này. **Secondary:** add-to-flashcard, stroke order (only if data exists).
- **Hierarchy:** large kanji + level/strokes · On/Kun + VN meaning · compounds · examples · related.

### 2.8 Flashcards / Decks — `25-web-flashcards.png`
- **Intent:** manage & review saved items (real decks/SRS in implementation — no local-only persistence).
- **Primary:** Ôn N thẻ đến hạn. **Secondary:** create manual card, open deck.
- **Hierarchy:** deck cards with due count + SRS distribution bar (new/learning/review/mastered) · empty-deck card.

### 2.9 SRS Review session — `12-mobile-review.png`, `26-web-srs-review.png`
- **Intent:** review quickly & calmly; low distraction.
- **Primary:** reveal answer → confidence buttons (Lại / Khó / Tốt / Dễ with next-interval hint). **Secondary:** audio, reading assist (where allowed).
- **Hierarchy:** progress (n/total) · card front (JP focus) → revealed back · 4 fixed-position confidence buttons.
- **Interaction:** tap card to reveal (no bounce); confidence buttons keep identical size & position across cards. Wrong/again → routes to remediation.
- **Empty:** "Hết thẻ đến hạn 🌸 — quay lại sau / học bài mới" (positive, not failure).

### 2.10 Practice / Quiz — `13-mobile-practice.png`, `27-web-quiz.png`
- **Intent:** retrieval practice; learn from wrong answers.
- **Primary:** Câu tiếp theo. **Secondary:** ＋ thêm lỗi vào thẻ, retry.
- **Hierarchy:** stem + JP · answer options · immediate feedback (correct=green+✓, chosen-wrong=red+✕) · explanation panel · add-mistake.
- **Copy:** wrong-answer copy is non-shaming ("Chưa đúng — và đó là một phần của việc học.").
- **Modes:** practice mode may show hints; label estimated outcomes as estimated.

### 2.11 Mock BJT Exam — `14-mobile-mock-exam.png`, `28-web-mock-exam.png`
- **Intent:** serious timed simulation — a quiet cockpit.
- **Primary:** Câu tiếp. **Secondary:** flag for review, prev, submit (confirm dialog).
- **Hierarchy:** timer (tabular-nums, amber→red urgent) · section + count · question + options (lettered) · **question navigator** (answered/flagged/current/unanswered) · submit.
- **Integrity:** **no meanings during active timed mode**; furigana only if mode permits; no rewards/animation; requires connection to start/submit.
- **Result:** estimated band/score (labelled estimated) + section breakdown + remediation plan. No confetti for weak runs.
- **a11y:** keyboard arrows in navigator; timer has accessible text; selected answer not color-only (filled radio + label).

### 2.12 Battle / Social — `17-mobile-battle.png`
- **Intent:** opt-in motivation without shame or privacy leakage.
- **Hierarchy:** player vs opponent score (player blue / opponent red) · bot-transparency chip ("Đối thủ là bot · công bằng theo trình độ") · round timer · question + answers.
- **Rules:** no pay-to-win; no exposure of private learning detail; energetic but serious.

### 2.13 Progress / Analytics / Coaching — `29-web-progress.png`
- **Intent:** honest understanding of progress + next actions.
- **Hierarchy:** estimated band (navy, EST badge) · consistency (8-week bars) · competency (strong/needs-work, color+label) · recommended next practices.
- **Rules:** estimated scores labelled estimated; no vanity charts; calm, readable, actionable.

### 2.14 Profile / Me / Settings — `16-mobile-me.png`, `30-web-profile-settings.png`
- **Intent:** manage identity, goals, preferences, privacy, sharing, plan. Trustworthy structure.
- **Hierarchy:** profile · goals (BJT band / daily / focus) · preferences (reading assist toggle, language, notifications) · **privacy & sharing** (scores/band private until shared) · plan/quota rail.
- **Rules:** no aggressive premium push; privacy controls understandable.

### 2.15 Monetization / Upgrade — `31-web-monetization.png`
- **Intent:** respectfully explain limits & premium value.
- **Hierarchy:** current plan + quota · Free vs Premium compare · upgrade CTA · restore/manage.
- **Rules:** enforcement server-side (no frontend-only gating in code); basic reading stays free; no countdowns/shame; premium styling not scattered.

### 2.16 Share / Achievement Postcard — `18-mobile-share.png`
- **Intent:** share achievements safely.
- **Hierarchy:** public-safe postcard preview · template picker · privacy note · copy-link / share.
- **Rules:** milestone only; scores, history, estimated band **never** exposed; OG metadata safe; preview before publish.

---

## 3. Reading Assist interaction model — `06`, `07`
One reusable component, two presentations: **web = in-place popover**, **mobile = bottom sheet**. Used in lesson, dictionary, search, and review.
- **Trigger:** tap/click a Japanese token. **Dismiss:** outside tap or drag-handle (sheet).
- **Content:** headword + reading (furigana/romaji) · POS + level/context chips · VN meaning · example (JP + VN) · audio (explicit tap) · ＋ add-to-flashcard · save.
- **Tiering:** furigana & readings are **free**; depth (audio packs, bulk add) may be gated.
- **Exam:** blocked in active timed mode (no meanings; permitted furigana only if mode allows).
- **a11y:** focus moves into popover/sheet; ESC / outside-tap closes; audio button has aria-label.

## 4. Study / Review / Quiz / Exam interaction models
- **SRS:** reveal → 4 confidence levels with interval hints; "Lại"/wrong feeds remediation queue.
- **Quiz:** select → immediate feedback (correct/incorrect both shown with icon+text) → explanation → add-mistake → next.
- **Exam cockpit:** stable controls, quiet timer, flag/skip, navigator jump, submit-confirm; meanings hidden; connection required.
- **Remediation:** mistakes across quiz/exam/review surface on Home (Step 3) and become flashcards.

## 5. State matrix — `39-state-matrix.png`
Every major flow ships all four. Principles:
- **Loading:** skeletons mirror final content shape — never spinner-only.
- **Empty:** explain + offer the next action (Review empty is celebratory, not failure).
- **Error:** calm copy, retry, learner progress kept safe; never raw technical errors.
- **Offline/degraded:** graceful, never fake progress. Lessons/cards already loaded remain usable; **mock exam requires connection to start/submit and says so plainly.**
Also support: disabled, success, warning, destructive-confirm.

## 6. Responsive behavior — `33`–`38`
| Target | Width | Layout |
|---|---|---|
| Web wide | 1440 | spine + fixed 300px rail, 32px gutters, max content 1280 |
| Web desktop | 1024–1279 | two-column spine + rail |
| Web tablet | 768 | single column; rail → 2-up below; nav condenses to icon + avatar |
| Web mobile | <640 | full stack, hamburger, sticky top bar, **no bottom tab bar** |
| Native | 375 | base; 48px primary CTA; thumb-zone; safe-area aware |
| Native | 430 | same layout, type +1–2px, spacing scales, content max-width holds |
Japanese never below 14px at any width. Touch targets ≥44px web / ≥48px native primary.

## 7. Accessibility — `41`
- Focus-visible 3px `#3B82F6` ring, 2px offset on every interactive element.
- Full keyboard nav on web; arrow keys in question navigator; Enter/Space activate.
- WCAG AA contrast (navy/white, blue-on-white, secondary text all pass).
- Icon buttons carry `aria-label` (Phát âm, Lưu, Thêm thẻ…).
- Never color-only for state — add icon + text (quiz ✓/✕, SRS labels, premium label).
- Furigana ruby at LH 1.8 never collides; semantic landmarks on the shell; `prefers-reduced-motion` respected.

## 8. Motion — `41`
Press feedback scale 0.98 + pressed color (150ms); transitions 150–300ms ease-out; no animation in active study/exam; no autoplay audio (explicit tap); one primary CTA per viewport.

## 9. i18n & copy — `42`
- Locales: `vi` (UI primary), `ja` (content). Namespaces: `common, auth, home, learn, lesson, review, quiz, exam, search, dict, progress, profile, billing, share, errors`.
- Key pattern `<ns>.<screen>.<element>` (e.g. `home.hub.continue_cta`, `quiz.feedback.incorrect_intro`, `progress.band.estimated_label`).
- Japanese headwords/examples are content data, never inside UI keys. ICU plural & number formatting; tabular-nums for counts. Tone: supportive, precise, adult, no-shame.

## 10. Implementation notes — `42`
- Tokens → `apps/web/app/globals.css` custom properties; mirror to Flutter/RN theme. Web = Next.js; mobile = Flutter or RN; design language is platform-portable.
- Reading Assist = one shared component instance across lesson/dict/search/review.
- **Enforcement is server-side** — quota, paywall gating, exam integrity & share privacy come from backend contracts; UI reflects server state and never gates client-only.
- Share tokens expose safe metadata only (no scores/history/band in OG).
- **Admin surfaces are out of scope** and excluded.

## 11. QA checklist — `32-qa-checklist.png`
- [ ] Feels like serious BJT learning, not a generic LMS
- [ ] Main action obvious within 3 seconds
- [ ] Japanese readable & respected (LH 1.8, ≥14px, furigana no collision)
- [ ] Reading Assist is one reusable layer, not one-off tooltips
- [ ] Mock exam hides meanings & preserves integrity (connection required)
- [ ] Mistakes convert into next learning actions
- [ ] Scores framed as estimated, never official
- [ ] Loading / empty / error / offline designed for every major flow
- [ ] Mobile thumb-friendly; 48px native primary targets
- [ ] Web spacious & focused, not a dashboard wall
- [ ] Premium states respectful, no dark patterns; basic reading stays free
- [ ] Sharing privacy-safe (no score/history/band leak)
- [ ] All controls accessible (focus, keyboard, contrast, aria, reduced-motion)
- [ ] No admin surfaces present
