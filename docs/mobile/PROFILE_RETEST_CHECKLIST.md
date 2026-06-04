# Profile (Me Hub) — Retest Checklist

Scope: `apps/mobile` — the rebuilt **Me Hub** (`ProfilePage`) and its
sections. Every item must be verified on a real/emulated device at the listed
breakpoints. No item passes on "looks fine in code" — it passes on observed
behavior.

## 0. Build gates (run first, must be green)

- [ ] `cd apps/mobile && flutter analyze` → **No issues found!**
- [ ] `cd apps/mobile && flutter test` → **All tests passed!**
- [ ] `git diff --check` → no whitespace errors (CRLF notices are OK on Windows)

## 1. Structure (Me Hub sections render, in order)

- [ ] Profile hero (avatar + name + session label + account eyebrow pill)
- [ ] Learning snapshot card ("Tổng quan học tập" / "学習サマリー")
- [ ] Account identity card (display name / username / email when present)
- [ ] Quick actions group (Progress, Saved, Subscription)
- [ ] Preferences group (Language, Theme, Furigana, Haptics)
- [ ] About group (real app version row)
- [ ] Sign-out button (danger outline, full width)

## 2. Real data (NO fabricated metrics, NO dead rows)

- [ ] Hero plan badge appears **only** on a resolved subscription. Premium plan
      shows the gold plan name; free plan shows "Gói miễn phí" / "無料プラン".
      During loading/error the badge is **absent** (never a guessed plan).
- [ ] Learning snapshot shows real device-local stats (streak / today /
      7-day / total). With no study log it shows the honest empty state
      ("Chưa có dữ liệu học" / "学習データはまだありません"), not zeros dressed as progress.
- [ ] Identity card shows only real ID-token claims. With no claims it shows
      the "unavailable" notice, not placeholder values.
- [ ] About version row shows the **real** build (`PackageInfo`), em dash while
      it resolves — never a hardcoded version.
- [ ] Every quick-action row navigates to a real destination (Progress, Saved,
      Subscription). No row is inert.

## 3. Preferences (persist + reflect immediately)

- [ ] Language: select Tiếng Nhật → app switches to JA and survives reload.
- [ ] Theme: select Tối/Dark → app switches to dark immediately and survives
      reload (persisted as `theme_mode`).
- [ ] Theme: select Theo thiết bị/System → follows device light/dark.
- [ ] Furigana toggle persists and survives reload.
- [ ] Haptics toggle persists; disabling silences interaction haptics app-wide.
- [ ] A failed write surfaces the save-error SnackBar and the control reverts.

## 4. Auth / logout (unchanged behavior, verified)

- [ ] Tapping Sign out shows the spinner + disabled state; no raw AppAuth /
      browser prompt appears.
- [ ] During sign-out the screen shows the explicit "Đang đăng xuất…" /
      "ログアウトしています…" state — no authenticated-profile flash.
- [ ] After sign-out the app lands on Login. No auth loop, no fallback flash.
- [ ] No credentials/tokens are rendered anywhere on the screen.

## 5. UI/UX polish (verify on each breakpoint)

Breakpoints: **360 dp**, **390 dp**, **tablet ≥ 720 dp** (content caps at 720).

- [ ] No overflow at 360 dp in either language.
- [ ] JA and VI long strings wrap/ellipsize without clipping.
- [ ] Dark mode: all cards, badges, and stat tiles have AA contrast.
- [ ] Snapshot stat tiles: 2-up on narrow, 4-up on wide.
- [ ] All interactive rows/switches are ≥ 48 dp touch targets.
- [ ] `prefers-reduced-motion` honored (selection check has no animation).

## 6. States

- [ ] Snapshot loading shows skeleton tiles (not a spinner jump).
- [ ] Snapshot empty + identity unavailable + subscription loading all render
      gracefully together (no exceptions).
