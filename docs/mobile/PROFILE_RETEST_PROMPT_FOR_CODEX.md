# Codex Retest Prompt — Profile (Me Hub)

Copy everything in the fenced block below into a fresh Codex/agent session to
independently retest the rebuilt mobile Me Hub. The prompt is self-contained.

```
You are retesting the rebuilt mobile "Me Hub" (Profile) in apps/mobile of the
NihonGo BJT monorepo. Do NOT change product behavior. Your job is to verify,
reproduce, and report — only fix if you find a concrete defect, and keep any fix
minimal and explained.

Context files to read first:
- docs/mobile/PROFILE_RETEST_CHECKLIST.md  (the checklist you must execute)
- docs/mobile/PROFILE_WEB_PARITY_AUDIT.md
- docs/mobile/PROFILE_MOBILE_UX_DECISION.md
- docs/mobile/PROFILE_AUTH_LOGOUT_AUDIT.md
- docs/mobile/PROFILE_IMPLEMENTATION_PLAN.md

Entry points:
- apps/mobile/lib/features/settings/presentation/profile_page.dart
- apps/mobile/lib/features/settings/presentation/widgets/profile_*.dart
- apps/mobile/lib/features/settings/presentation/profile_providers.dart
- apps/mobile/lib/features/settings/presentation/settings_controller.dart
  (themeModeProvider, setThemeOption)
- apps/mobile/lib/app/app.dart  (themeMode wiring)
- apps/mobile/lib/l10n/app_vi.arb + app_ja.arb  (must stay in sync)

Hard rules to enforce while retesting:
- No fabricated profile / progress / subscription data. The plan badge renders
  only on a resolved subscription; the learning snapshot uses the real
  device-local studySummaryProvider and shows an honest empty state with no
  activity; the About version comes from PackageInfo.
- No dead rows. Every action routes somewhere real.
- No auth bypass, no raw AppAuth prompt on logout, no fallback identity flash,
  no auth loop, no stored credentials shown.
- VI/JA localization stays in sync; user-facing text uses l10n keys.
- Each Dart file stays under ~600 lines.

Steps:
1. Run, from apps/mobile:
   - flutter analyze        (expect: No issues found!)
   - flutter test           (expect: All tests passed!)
   Quote the exact final line of each. If red, STOP and report.
2. Run the project root: git diff --check (CRLF notices on Windows are OK).
3. Execute every item in docs/mobile/PROFILE_RETEST_CHECKLIST.md on 360 dp,
   390 dp, and a tablet width (>= 720 dp), in BOTH light and dark, and in BOTH
   vi and ja. For UI checks, drive the running app or widget tests; do not rely
   on reading code alone.
4. Pay special attention to:
   - Plan badge hidden during subscription loading/error; correct free vs
     premium label and color.
   - Learning snapshot: empty state vs real metrics; skeleton while loading;
     2-up (narrow) vs 4-up (wide) stat tiles.
   - Theme switch is immediate AND persists across a reload (key: theme_mode).
   - Logout shows the signing-out state, lands on Login, no flash/loop.

Report back exactly:
1. analyze result (final line, verbatim).
2. test result (final line, verbatim; note any added/failing tests).
3. Checklist pass/fail per section with the breakpoint+locale where any
   failure was observed.
4. Any defects found, with file:line and a minimal proposed fix (or applied fix
   with a one-line rationale).
5. Confirmation that the hard rules above all hold, or precisely which one does
   not and why.
```
