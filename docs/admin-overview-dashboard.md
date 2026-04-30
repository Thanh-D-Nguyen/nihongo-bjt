# Admin overview dashboard (Trung tâm vận hành)

**Route:** `apps/admin/app/[locale]/page.tsx` (home)  
**Client:** `apps/admin/app/[locale]/_components/overview/overview-page.tsx` + `overview/*`  
**Mappers / types:** `apps/admin/lib/admin-overview-mappers.ts`, `admin-overview-types.ts`  
**Data loading:** `apps/admin/lib/admin-overview-fetch.ts` (adapter to APIs)

## Sections

1. **Header** — title, subtitle, date range (7/30/90d via `?range=`), refresh, “last update”, environment badge, RBAC count.
2. **Executive KPIs (6)** — MAU, new users, flashcard reviews, completed assessment sessions, search events, active content. Deltas from KPI models or `previousMetricTotals` when available; **“Chưa đủ dữ liệu so sánh”** when `deltaRatio` is null.
3. **Activity trend** — multi-line chart from `executive.mauDauWau.byDay` (dau, reviews, bjtCompletions, searchEventsRollup). No raw `metricTotals` keys on axis; tooltip can show debug mapping when enabled in code.
4. **Learning health** — placeholders for review completion / accuracy / streaks until APIs exist; **search success rate** from executive KPI; study minutes show “not aggregated” message from spec.
5. **Content operations** — lexeme `byStatus` (published, needs_review) when `GET /api/admin/content/summary?type=lexeme` succeeds; media / enrichment / import as honest “not on this dashboard” until wired.
6. **System health** — `GET /api/health/ready` maps DB + Keycloak config checks; Redis, Meilisearch, workers, object storage as **unknown** until exposed by API.
7. **Action center** — queue-style list from real signals (e.g. `needs_review` count, stale rollup, high zero-result search); empty copy when nothing fires.
8. **Product insights** — cards from `executive.insights` + search zero share + d7 (when value present) or the empty insight message.
9. **Quick actions** — permission-gated links (content, import, audit, feature flags, DLQ, monetization, optional battle when `adminNav.battle` flag not false).
10. **Recent audit** — `GET /api/admin/audit` when `viewer.audit`; readable action labels via `mapAuditActionLabelI18nKey` + `overviewDashboard` keys; forbidden state if no permission.

## Data sources (real)

| Source | Permission | Notes |
|--------|------------|--------|
| `GET /api/admin/analytics?days=` | `viewer.analytics` / `admin.analytics.view` / `analytics.view` | Executive object + metric totals, sparklines, insights |
| `GET /api/admin/audit?limit=` | `viewer.audit` | Recent rows; hidden with message if forbidden |
| `GET /api/admin/content/summary?type=lexeme` | `admin.content.read` | `byStatus` for queue cards |
| `GET /api/health/ready` | Public (bearer in dev) | DB + keycloak checks; failure → degraded/unknown |
| `GET /api/admin/me` | session | Permission codes for gates |

## i18n

- Namespace: `messages.*.overviewDashboard` (flat string record) and existing `overview` for page title/legacy.  
- Locales: `vi`, `ja`, `en` in repo (`en` may mirror until full copy deck).

## Feature flags

- Quick action “Battle” respects `readClientAdminFeatureFlags()` and `adminNav.battle` (same as nav).

## Empty / error / degraded

- **Error** — failed analytics load → red banner, no fake KPIs.
- **No analytics permission** — amber explanation; no executive charts.
- **Partial degradation** — some fetches fail (content summary, health, audit) → amber “partial” strip; show what loaded.
- **Action center** — if no tasks: encouraging empty string from i18n.

## Future work (metrics / APIs)

- Real **review completion rate**, **average accuracy**, **streak distribution**, **Meilisearch lag**, **import job counts**, **DLQ / security** counts in action center.  
- Explicit **OpenAPI/backup** health when API exists.  
- **Custom date range** UI (currently disabled scaffold in header).  
- Deeper **audit** severity and action label catalog in i18n.
