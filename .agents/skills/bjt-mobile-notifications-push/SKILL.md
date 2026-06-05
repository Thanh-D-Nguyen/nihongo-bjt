---
name: bjt-mobile-notifications-push
description: Design, audit, or implement notifications and push in the Nihongo BJT Flutter mobile app \u2014 study reminders, SRS-due alerts, streak nudges, and announcements \u2014 with explicit opt-in/consent, server-driven config, and respect for learning focus. Use when adding local or push notifications, reminders, or re-engagement nudges to mobile.
---

# BJT Mobile Notifications & Push Skill

Use this skill when designing, auditing, or implementing notifications and push.
Follow the `bjt-mobile-foundation-quality-gate` baseline.

## Goal

Bring learners back at the right moments — review due, daily study reminder,
streak at risk, important announcements — respectfully, with explicit consent
and server-driven configuration.

## Core principle

Notifications are **opt-in and consent-respecting**. The server drives what/when
where possible; the client honors user preferences and platform permissions.

## Hard rules

- Explicit opt-in; never notify without consent and granted OS permission.
- Provide granular, persisted preferences (reminders, SRS-due, streak,
  announcements) stored server-side and reflected cross-device.
- No spammy or shame-based nudges; respect quiet hours if supported.
- Notification content uses i18n (vi/ja); no leaked private data in payloads.
- Deep-link notifications to the correct real route; handle cold/warm start.
- Reminder scheduling reflects real due/SRS data, not fabricated counts.
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp. Add/update
  tests.

## Required audit before coding

Inspect:
- web notification/reminder/announcement config, preference APIs, models
- mobile push/local-notification setup (or absence; justify dependency/platform
  config), settings/preferences providers, deep-link handling, l10n, tests
- platform requirements (FCM/APNs) and whether they are in scope

Create/update:
- `docs/mobile/NOTIFICATIONS_WEB_PARITY_AUDIT.md`
- `docs/mobile/NOTIFICATIONS_CONSENT_POLICY.md`
- `docs/mobile/NOTIFICATIONS_IMPLEMENTATION_PLAN.md`

## Required surfaces

1. Permission request flow with clear value explanation (no pre-permission
   dark patterns).
2. Notification preferences screen (granular, persisted server-side).
3. Local reminders (study time, SRS due) from real data.
4. Push handling + deep-link routing (if push is in scope).
5. All states; honest behavior when permission denied.

## Required tests

- preferences persist (server mock) and gate scheduling
- permission-denied path handled without breaking the app
- reminder schedules from real due data; none when no data
- deep-link routes to the correct screen (cold/warm)
- no private data in notification payload
- dark mode, 360 dp, long VI/JA text

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Document platform (FCM/APNs) runtime verification as
blocked-with-proof if not configured. Report files changed and commands + results.
