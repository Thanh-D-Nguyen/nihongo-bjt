# Mobile ↔ Web Parity Retest Checklist

Use this to retest the mobile app against the web product after the
production-readiness pass. Each row maps a web-equivalent flow to its mobile
screen, the expected parity, the **accepted** (intentional) difference, and a
severity for any gap found during retest.

> Device note: APK/emulator runs are **blocked on the current Windows host**
> (Android SDK lacks platforms/build-tools). Rows below are verified by widget
> tests + static analysis, **not** on-device. Re-run the device column on a host
> with a working Android/iOS toolchain before sign-off. Do not mark device QA
> passed until then.

## Legend

- **Parity:** Full = behaviour matches web; Adapted = same capability, mobile-native UX; N/A = not applicable to mobile.
- **Severity (if gap found):** Blocker / Major / Minor / None.

## Core loop

| Web-equivalent flow | Mobile screen | Expected parity | Accepted difference | Severity | Screenshot |
| --- | --- | --- | --- | --- | --- |
| Login (email/password + social) | `LoginPage` | Full | Social/register via system browser (PKCE), not in-app webview | None | _attach_ |
| Home dashboard | `HomePage` | Adapted | Bottom 5-tab nav; body capped at 640 dp on tablets | None | _attach_ |
| Daily lesson entry | `LearnPage` → `LessonDetailPage` | Adapted | Preview content honestly badged | None | _attach_ |
| Sign out → returns to login | `ProfilePage` → `LoginPage` | Full | Explicit "signing out" state before redirect | None | _attach_ |

## Learning content

| Web-equivalent flow | Mobile screen | Expected parity | Accepted difference | Severity | Screenshot |
| --- | --- | --- | --- | --- | --- |
| Lesson reading (JA passage + VI translation) | `LessonDetailPage` | Adapted | Furigana toggle in Profile; reading suppressed in review | None | _attach_ |
| Practice / quiz (MCQ) | `PracticePage` | Adapted | Full-screen player (no bottom nav); per-question review on summary | None | _attach_ |
| BJT timed exam mode | — | **Deferred** | Needs `/api/quiz/*`; not wired to mobile | Deferred | n/a |
| Dictionary / Kanji / Grammar | — | **Deferred** | Need respective backend contracts | Deferred | n/a |
| News / Magazine / Scenarios / Search | — | **Deferred** | Need respective backend contracts | Deferred | n/a |

## Review / SRS

| Web-equivalent flow | Mobile screen | Expected parity | Accepted difference | Severity | Screenshot |
| --- | --- | --- | --- | --- | --- |
| Review hub | `ReviewPage` | Adapted | Mobile-native hub entry | None | _attach_ |
| Flashcard decks | `FlashcardDeckListPage` | Full | — | None | _attach_ |
| Flashcard SRS review (rate recall) | `FlashcardReviewPage` | Full | On-device SRS cache (drift); real schedule only | None | _attach_ |
| Saved / bookmarks | — | **Deferred** | Needs `/api/bookmarks` | Deferred | n/a |

## Progress / profile

| Web-equivalent flow | Mobile screen | Expected parity | Accepted difference | Severity | Screenshot |
| --- | --- | --- | --- | --- | --- |
| Progress / activity | `ProgressPage` | Adapted | Device-local study stats only; **no fabricated server analytics** | None | _attach_ |
| Settings (language, furigana) | `ProfilePage` | Full | Preferences persist device-locally | None | _attach_ |
| App version / About | `ProfilePage` → About | Full | Real platform version via `package_info_plus` | None | _attach_ |
| Server analytics / gamification | — | **Deferred** | Need `/api/analytics/*`, `/api/gamification/*` | Deferred | n/a |

## Social / competitive

| Web-equivalent flow | Mobile screen | Expected parity | Accepted difference | Severity | Screenshot |
| --- | --- | --- | --- | --- | --- |
| Battle / Career | — | **Deferred** | Realtime + `/api/career`, `/api/story` | Deferred | n/a |

## Admin

| Web-equivalent flow | Mobile screen | Expected parity | Accepted difference | Severity | Screenshot |
| --- | --- | --- | --- | --- | --- |
| Admin / management consoles | — | **N/A** | Admin is desktop-only by design | None | n/a |

## Cross-cutting retest (every screen)

- [ ] Light + dark mode render correctly (no hardcoded white/black surfaces).
- [ ] 375 dp narrow width: no horizontal overflow.
- [ ] Loading (shimmer) / empty (CTA) / error (retry) states present.
- [ ] Touch targets ≥ 44 dp; interactive elements have transitions + focus rings.
- [ ] All user-facing strings localized (vi + ja); no hardcoded literals.
- [ ] No fabricated analytics/progress shown as real server data.

## Automated gate (run before sign-off)

```bash
cd apps/mobile
flutter analyze        # expect: No issues found!
flutter test           # expect: All tests passed!
git diff --check       # expect: no whitespace errors
# Device build (run on a host with Android/iOS toolchain — NOT verified here):
# flutter build apk --debug
```
