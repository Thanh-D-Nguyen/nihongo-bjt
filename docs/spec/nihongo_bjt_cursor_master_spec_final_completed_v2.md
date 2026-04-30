# NihonGo BJT — Cursor Master Specification

> **Canonical version: v15**  
> This document supersedes all previous internal labels such as v6/v7/v9/v14. When there is any conflict between sections, the latest numbered section or explicit addendum wins.  
> Tài liệu tổng hợp để dùng trực tiếp trong Cursor/AI Agent nhằm dựng toàn bộ web app học tiếng Nhật BJT.  
> Ưu tiên kiến trúc và database từ 2 tài liệu technical specification tiếng Anh; hợp nhất đầy đủ feature từ `FEATURES.md`; thay MongoDB bằng PostgreSQL + Prisma.  
> v15 additions: Security hardening, OpenAPI contract, CI/CD pipeline, observability metrics, backup RPO/RTO, testing matrix, legal/compliance, privacy governance, feature flag kill switches.

---

## 0. Cách dùng tài liệu này trong Cursor

Copy toàn bộ tài liệu này vào Cursor với vai trò **single source of truth**. Agent phải triển khai theo từng phase, không tự đổi stack, không tự đơn giản hóa database, không quay lại MongoDB.

### Prompt chính cho Cursor

```text
You are a senior full-stack architect and implementation agent.
Build the complete NihonGo BJT web-first learning platform from this specification.
Use PostgreSQL as the canonical database, Prisma ORM, NestJS API, Next.js App Router for learner and admin apps, Redis/BullMQ, Meilisearch, Socket.IO, Keycloak-ready auth, and Turborepo.

Important rules:
1. Do not use MongoDB/Mongoose.
2. Do not build a thin dictionary clone. The product must be BJT-first.
3. PostgreSQL is the source of truth. Meilisearch is only a projection. Redis is only cache/queue/realtime state.
4. Implement production-ready folder structure, DTOs, validation, tests, seed scripts, Docker Compose, env examples, and README.
5. Implement progressively but keep every commit runnable.
6. When source JSON fields are uncertain, build a streaming profiler and canonical import layer instead of hard-coding assumptions.
7. Build all learner features, admin features, realtime battle mode, SRS, quiz, BJT levels, NHK news analysis, achievements, bookmarks, and data import workflows.
8. Generate clean UI/UX using Tailwind, shadcn/ui style components, React Query, Zustand, Japanese aesthetic, and responsive mobile-first layouts.
9. Build multilingual/i18n support from day one: Vietnamese and Japanese first, English-ready, more locales later without schema rewrite.
10. Flashcards must support images, user uploads, object storage, and optional external image search/selection workflow.
11. Admin must be enterprise-grade: full RBAC, profile/avatar management, content workflow, media moderation, import governance, analytics, audit, and IAM screens.
12. Admin analytics must be implemented as a professional BI-style operations center with reusable chart components, drill-down, exports, freshness indicators, and role-aware User 360.
13. Implement analytics event tracking from day one with typed client/server helpers, raw event log, rollup jobs, insight generation, and privacy guardrails.
14. Build Learning Path Engine from day one: structured curriculum, prerequisite graph, adaptive sequencing, competency-based progression, and personalized path recommendations.
15. Implement production infrastructure: caching strategy, circuit breakers, connection pooling, CI/CD pipeline, feature flags, cursor-based pagination, CDN, email service, and zero-downtime deploy support.
```

---

## 0.1 Requirement language

This document uses the following requirement levels:

| Keyword | Meaning |
|---|---|
| **MUST** | Required for production-ready implementation. Cursor must not skip or stub. |
| **SHOULD** | Strongly recommended. Cursor must implement unless the current phase explicitly excludes it. |
| **MAY** | Optional or deferred to a later phase. |
| **RECOMMENDED** | Treat as SHOULD. |
| **PLACEHOLDER** | Allowed only when backed by a real interface, schema, and feature flag. A placeholder must never produce fake user-facing success (e.g., a "Scan complete" message without an actual scan). |

When in doubt, treat the requirement as SHOULD.

## 0.2 MVP v1 implementation cutline

This specification is large. To prevent Cursor from spreading too thin and delivering half-finished features, the following **vertical slices MUST be fully completed** before expanding breadth:

1. **Auth + profile + i18n baseline** — login, profile CRUD, locale switching, Keycloak-ready mock
2. **Dictionary search + detail + bookmark** — full-text search, entry detail page, bookmark toggle
3. **Flashcard deck + card + SRS review** — deck CRUD, card creation with images, SM-2 review loop
4. **Quiz start + answer + result** — BJT mock exam flow with scoring and remediation links
5. **Admin content CRUD + audit** — dictionary/kanji/grammar CRUD with audit log and RBAC
6. **Import profiler + staging + canonical import** — streaming profiler, staging tables, validation, canonical write
7. **Meilisearch projection** — outbox event → sync worker → search index with fallback
8. **Monetization foundation** — plan, entitlement, quota, backend enforcement (no fake UI-only premium)
9. **Production baseline** — OpenAPI generation, CI pipeline, health checks, structured logs, feature flags

Everything else (battle arena, learning paths, reading assist, social login, referrals, postcards, advanced analytics) MAY be scaffolded with real contracts (interfaces, schemas, feature flags) but MUST NOT ship fake user-facing implementations.

---

## 1. Product goal

NihonGo BJT là nền tảng học tiếng Nhật chuyên sâu cho người Việt chuẩn bị thi hoặc làm việc trong môi trường business Japanese. Sản phẩm không chỉ là từ điển + flashcard, mà là nền tảng **BJT-first** với:

- Từ điển Nhật-Việt, Việt-Nhật, Kanji, ngữ pháp, ví dụ.
- Học theo mục tiêu BJT J5 → J1+.
- Thi thử BJT theo cấu trúc Listening / Listening-Reading / Reading.
- Flashcard SRS theo ngữ cảnh business, keigo, kỹ năng nghe/đọc.
- Realtime battle với bot/người chơi.
- Admin phân quyền rõ ràng, có CMS, import, enrichment, audit, quiz builder, battle config.
- Đa ngôn ngữ từ đầu: UI tiếng Việt/tiếng Nhật, sẵn sàng mở rộng English và ngôn ngữ khác.
- Flashcard giàu hình ảnh: upload ảnh, tự động gợi ý ảnh theo keyword, chọn ảnh từ danh sách, lưu provenance.
- User profile có avatar, mục tiêu học, ngôn ngữ UI, timezone, privacy, learning personality.
- Tự động sinh deck/câu hỏi/gợi ý dữ liệu từ nguồn sẵn có.

### Non-goals

- Không dùng MongoDB làm database chính.
- Không lưu source JSON như blob rồi query trực tiếp.
- Không tính điểm BJT giả như điểm chính thức. Chỉ hiển thị `estimatedBjtBand` hoặc `estimatedScore` có nhãn rõ là ước tính.
- Không để Meilisearch/Redis trở thành source of truth.

---

## 2. Tech stack chuẩn

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| Monorepo | Turborepo + npm/pnpm workspaces | 3 app + shared packages |
| Backend API | NestJS 10+ / Node.js 20+ / TypeScript strict | Modular monolith |
| Learner web | Next.js 14/15 App Router + React + Tailwind | `apps/web`, port 3000 |
| Admin web | Next.js App Router + React + Tailwind | `apps/admin`, port 3002 |
| Database | PostgreSQL 16+ | Canonical source of truth |
| ORM | Prisma | Kết hợp raw SQL migration cho extension/index/partition |
| Search | Meilisearch | Projection cho dictionary/kanji/grammar/example |
| Cache/Queue/Realtime state | Redis 7+ | Không lưu dữ liệu canonical |
| Job queue | BullMQ | Import, indexing, enrichment, NHK sync |
| Realtime | Socket.IO + Redis adapter | Battle arena, lobby, room |
| Auth | Keycloak OIDC-ready | Dev có thể mock auth, production dùng Keycloak |
| Object storage | S3-compatible/MinIO/local storage | Audio, image, import files |
| UI | Tailwind + shadcn/ui style + Radix | Japanese aesthetic |
| i18n | next-intl hoặc tương đương + DB localized content | VI/JA first, EN-ready |
| Server state | TanStack Query v5 | Web/admin |
| Client state | Zustand | Review session, duel HUD, UI local state |
| Test | Jest/Vitest + Playwright | API, unit, e2e |
| Observability | Pino/Winston + OpenTelemetry-ready | TraceId, audit log |

---

## 3. Monorepo structure

```txt
nihongo-bjt/
  apps/
    api/                         # NestJS backend
    web/                         # Learner Next.js app
    admin/                       # Admin Next.js app
  packages/
    database/                    # Prisma schema, migrations, seed helpers
    shared/                      # DTO types, constants, zod schemas, utils
    ui/                          # Shared UI components
    config/                      # eslint, tsconfig, tailwind presets
  scripts/
    import/                      # JSON profiler + canonical import scripts
    seed/                        # seed BJT levels, demo data, admin users
    keycloak/                    # realm/client role JSON
  infra/
    docker/
    nginx/
  data/                          # local source JSON, gitignored except README
  docs/
  docker-compose.yml
  .env.example
  README.md
```

### App routes

```txt
apps/web/app/
  (public)/
    page.tsx                     # home
    dictionary/
    kanji/
    grammar/
    vija/
    search/
    levels/[level]/
    quiz/templates/
  (learner)/
    dashboard/
    flashcards/
    study/
    bookmarks/
    quiz/[sessionId]/
    quiz/[sessionId]/results/
    quiz/history/
    battle/
    battle/[roomCode]/
    battle/history/
    battle/leaderboard/
    learning-paths/
    learning-paths/[pathId]/
    learning-paths/units/[unitId]/
    profile/

apps/admin/app/
  login/
  dashboard/
  users/
  content/
    words/
    kanji/
    grammar/
    examples/
  presets/
  quiz/
    templates/
    questions/
    sessions/
  battle/
    configs/
    bots/
    matches/
    leaderboard/
  imports/
  enrichment/
  analytics/
  audit/
  learning-paths/
  learning-paths/builder/
  learning-paths/[pathId]/
  learning-paths/analytics/
  competencies/
  operations/
    feature-flags/
    dead-letter-queue/
    content-versions/
  iam/
```

---

## 4. System architecture

```mermaid
flowchart LR
  Browser[Browser] --> Web[Next.js Learner App]
  Browser --> AdminWeb[Next.js Admin App]

  Web --> API[NestJS Modular Monolith]
  AdminWeb --> API

  API <--> KC[Keycloak OIDC]
  API --> PG[(PostgreSQL canonical DB)]
  API --> Redis[(Redis cache / realtime / queue)]
  API --> Meili[(Meilisearch projection)]
  API --> Obj[(Object Storage)]

  Worker[BullMQ Workers] --> Redis
  Worker --> PG
  Worker --> Meili
  Worker --> Obj

  API <--> Socket[Socket.IO Gateway]
  Socket <--> Redis
```

### Architectural rules

1. Backend là **modular monolith**, không tách microservice sớm.
2. Mỗi module chỉ write vào table do chính nó sở hữu.
3. Module khác chỉ đọc qua service interface hoặc query read model có kiểm soát.
4. Các event quan trọng phải ghi `outbox_event` để worker đồng bộ Meilisearch/enrichment/analytics.
5. Admin write phải ghi `admin_audit_log` với before/after JSON và traceId.

---

## 5. Bounded contexts / Backend modules

| Module | Trách nhiệm | Core entities |
|---|---|---|
| Auth | JWT/OIDC, role guard, principal mapper | CurrentUser, PermissionSet |
| User | Profile, goal, preference | UserProfile, UserPreference |
| Dictionary | Từ vựng, form, sense, gloss, tag | Lexeme, LexemeForm, LexemeSense |
| Kanji | Kanji, reading, meaning, stroke/svg | Kanji, KanjiReading |
| Grammar | Ngữ pháp, alias, structure, example | GrammarPoint |
| Example | Câu ví dụ, translation, token | ExampleSentence |
| Search | Projection Meilisearch, fallback PG | SearchDocument |
| Flashcard | Deck, card, SRS, review log | Deck, UserFlashcard, ReviewEvent |
| Study | Session, streak, heatmap | StudySession, DailyMetric |
| BJT Exam | Template, section, question, attempt | BjtMockTest, BjtQuestion, ExamAttempt |
| Battle | Lobby, match, bot, Elo, realtime room | QuizMatch, BattleConfig, BotProfile |
| Achievement | Badge, quest, unlocked state | Achievement, UserAchievement |
| Analytics | Product, learning, content, exam, battle, retention analytics | AnalyticsEvent, DailyLearningMetric, SkillMasterySnapshot, ContentPerformanceMetric |
| NHK News | RSS sync, article analysis, deck generation | NhkArticle |
| Learning Path | Curriculum, path, unit, prerequisite graph, adaptive sequencing, competency tracking | LearningPath, PathUnit, Prerequisite, UserPathProgress, CompetencyRecord |
| Enrichment | Auto-fill, AI suggestions, review queue | EnrichmentSuggestion |
| Admin | CMS, import, analytics, audit, IAM | AuditLog, ImportJob |
| Monetization | Plans, subscriptions, entitlements, quota, billing events | Plan, Subscription, Entitlement, QuotaUsage |
| Growth | Social login, referrals, sharing, postcards | ReferralCode, ReferralEvent, SharePostcard |
| Reading Assist | Tap-to-understand Japanese text, annotation, known terms | ReadingAssistCache, TextAnnotation, KnownTerm |
| Legal | Policy versions, consent tracking, privacy requests | PolicyVersion, UserConsent, CookieConsent |
| Notification | Email/in-app notification jobs and preferences | NotificationJob, EmailEvent, NotificationPreference |
| Operations | Feature flags, kill switches, dead-letter recovery | FeatureFlag, DeadLetterEntry, FeatureFlagAudit |

---

## 6. PostgreSQL database design

### 6.1 Design principles

- Content tables normalized and mostly stable: no partition by default.
- User/event/telemetry tables are append-heavy: partition by month or hash by user.
- Search is served by Meilisearch; PostgreSQL has fallback indexes for admin/debug/degraded mode.
- Use deterministic import keys: `(source_id, source_key)`.
- Use JSONB only for intentionally flexible metadata, not for main query fields.
- Use raw SQL migrations for `pg_trgm`, `unaccent`, custom indexes, partition parents.

### 6.2 Required extensions

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### 6.3 Schemas

```sql
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS learning;
CREATE SCHEMA IF NOT EXISTS curriculum;
CREATE SCHEMA IF NOT EXISTS assessment;
CREATE SCHEMA IF NOT EXISTS battle;
CREATE SCHEMA IF NOT EXISTS ops;
CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS media;
CREATE SCHEMA IF NOT EXISTS l10n;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS growth;
CREATE SCHEMA IF NOT EXISTS legal;
```

### 6.4 Source file mapping

| Source file | Vai trò | Canonical target |
|---|---|---|
| `javi.json` | JP→VI main dictionary | `content.lexeme`, `lexeme_form`, `lexeme_sense`, `sense_gloss`, `sense_tag`, `lexeme_kanji` |
| `vija.json` | VI→JP reverse lookup | Derived projection; chỉ staging nếu có meaning riêng |
| `kanji.json` | Kanji metadata | `kanji`, `kanji_reading`, `kanji_meaning`, `kanji_variant` |
| `grammar.json` | Grammar points | `grammar_point`, `grammar_alias`, `grammar_meaning`, `grammar_structure`, `grammar_example` |
| `example.json` | Example corpus | `example_sentence`, `example_translation`, `example_token`, `sense_example`, `grammar_example` |


### 6.4.1 Multilingual and localization model

The platform must be multilingual by design, not by hard-coded conditional text. Vietnamese and Japanese are first-class launch languages. English must be expansion-ready, and more locales must be possible without rewriting the database.

| Locale | Purpose | Default audience |
|---|---|---|
| `vi` | Main learner UI, explanations, onboarding, admin default for Vietnamese team | Vietnamese learners |
| `ja` | Japanese UI mode, Japanese explanations, Japanese business context labels | Learners living/working in Japan |
| `en` | Expansion-ready fallback and admin/developer content | Future expansion |

Rules:

- Every UI label must come from translation files, not hard-coded JSX strings.
- Learner can choose UI language from onboarding, profile settings, and navbar language switcher.
- Japanese learning content remains Japanese, but explanations, hints, system messages, achievements, and onboarding follow selected UI language.
- Admin can edit localized fields side-by-side: VI / JA / EN.
- Missing translation fallback order: selected locale → Vietnamese → English → source text.
- Search must support Japanese, kana, romaji, Vietnamese meaning, and later English meaning.

Recommended tables:

```sql
CREATE TABLE l10n.locale (
  code TEXT PRIMARY KEY,
  native_name TEXT NOT NULL,
  english_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  fallback_order SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE l10n.translation_key (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  description TEXT,
  UNIQUE(namespace, key)
);

CREATE TABLE l10n.translation_value (
  key_id BIGINT NOT NULL REFERENCES l10n.translation_key(id) ON DELETE CASCADE,
  locale_code TEXT NOT NULL REFERENCES l10n.locale(code),
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key_id, locale_code)
);
```

Cursor must seed `vi`, `ja`, `en` and create translation namespaces for `common`, `auth`, `dashboard`, `dictionary`, `flashcard`, `quiz`, `battle`, `admin`, `achievement`, and `error`.


### 6.5 Core table catalog

#### Content

| Table | Purpose | Index chính |
|---|---|---|
| `content.content_source` | Source registry | `code unique` |
| `content.lexeme` | Entry từ vựng canonical | `(source_id, source_key) unique`, `bjt_weight` |
| `content.lexeme_form` | Kanji/kana/romaji forms | `(lexeme_id, form_type, normalized_text) unique`, trigram |
| `content.lexeme_sense` | Sense/POS/register/domain | `(lexeme_id, sense_no) unique` |
| `content.sense_gloss` | Gloss VI/EN/JP | trigram on `normalized_gloss` |
| `content.sense_tag` | POS/domain/keigo/business tag | `(sense_id, tag_type, tag_value)` |
| `content.kanji` | Kanji canonical | `literal unique` |
| `content.kanji_reading` | on/kun/nanori | `(kanji_id, reading_type, reading)` |
| `content.lexeme_kanji` | Link lexeme-kanji | `(lexeme_id, kanji_id)` |
| `content.example_sentence` | Example corpus | trigram on normalized text |
| `content.example_translation` | VI/EN translations | `(example_id, lang_code)` |
| `content.example_token` | Tokenized Japanese | `(example_id, position)` |
| `content.grammar_point` | Grammar canonical | `slug unique`, trigram on pattern |
| `content.grammar_alias` | Alias forms | `(grammar_point_id, alias_normalized)` |
| `media.asset` | User/admin/import/external media asset | `checksum`, `(owner_user_id, created_at)` |
| `media.external_image_candidate` | Image search candidates before selection | `(query_normalized, provider, created_at desc)` |
| `content.entity_media_link` | Link image/audio to lexeme/kanji/grammar/example/question | `(target_type, target_id, role)` |

#### Learning

| Table | Purpose | Partition/Index |
|---|---|---|
| `learning.deck` | User/preset deck | `(owner_user_id, created_at desc)` |
| `learning.deck_card` | Cards inside deck | `(deck_id, card_id)` |
| `learning.flashcard_template` | Template definition | no partition |
| `learning.flashcard_variant` | Generated card variants | `(source_type, source_id)` |
| `learning.user_flashcard` | Per-user card state | hash partition by `user_id`, partial index `(user_id, due_at)` where active |
| `learning.review_event` | Append-only SRS log | monthly range partition by `reviewed_at` |
| `learning.study_session` | Study session | `(user_id, started_at desc)` |
| `learning.learning_metric_daily` | Dashboard/heatmap aggregate | `(user_id, metric_date)` |
| `learning.bookmark` | Bookmark words/kanji/grammar | `(user_id, target_type, target_id) unique` |
| `learning.card_media_link` | Image/audio attached to flashcard/card variant | `(card_id, role)` |

#### Assessment

| Table | Purpose | Partition/Index |
|---|---|---|
| `assessment.bjt_mock_test` | Quiz/exam template | `(status, type)` |
| `assessment.bjt_test_section` | Section by BJT part | `(test_id, display_order)` |
| `assessment.bjt_question` | Question bank | `(section_id, difficulty, category)` |
| `assessment.bjt_question_option` | Answer options | `(question_id, option_key)` |
| `assessment.bjt_question_link` | Link to content remediation | `(question_id, target_type, target_id)` |
| `assessment.exam_attempt` | User attempt | `(user_id, started_at desc)` |
| `assessment.exam_attempt_answer` | Answer log | monthly partition by `answered_at` |

#### Battle

| Table | Purpose | Partition/Index |
|---|---|---|
| `battle.battle_config` | Match config | status/index |
| `battle.bot_profile` | Virtual bots | level, enabled |
| `battle.quiz_match` | Match room | `(room_code unique)`, `(status, created_at)` |
| `battle.quiz_match_player` | Players in match | `(match_id, user_id)` |
| `battle.quiz_match_question` | Questions in match | `(match_id, round_no)` |
| `battle.quiz_match_answer` | Answer log | monthly partition by `answered_at` |
| `battle.user_rating` | Elo/MMR | `(user_id unique)`, rating desc |

#### Ops/Admin

| Table | Purpose | Partition/Index |
|---|---|---|
| `ops.import_job` | Import run | `(status, created_at desc)` |
| `ops.import_manifest` | Profiler output | `(job_id)` |
| `ops.outbox_event` | Projection/event | partial index where `published_at is null` |
| `ops.search_sync_checkpoint` | Meili sync state | `(projection_name unique)` |
| `ops.enrichment_suggestion` | Auto-fill candidate | `(status, confidence_score desc)` |
| `ops.admin_audit_log` | Admin audit | monthly partition by `created_at` |

### 6.5.1 User profile, avatar, media, and flashcard images

User profile and media are product-critical. Avatar, display name, learning goal, preferred UI language, timezone, target BJT level, daily goal, and privacy preferences must be first-class data.

User profile fields: `user_id`, `keycloak_subject`, `display_name`, `avatar_asset_id`, `ui_locale`, `explanation_locale`, `timezone`, `current_bjt_band`, `target_bjt_band`, `daily_goal_cards`, `learning_personality`, `privacy_level`, `created_at`, `updated_at`.

Media rules:

- Store image/audio files in object storage, not PostgreSQL binary columns.
- PostgreSQL stores metadata, checksum, owner, source, moderation status, and usage links.
- Flashcards can have multiple images: primary image, mnemonic image, example-context image.
- Card image selection supports local upload, media library selection, or external image candidates generated from keywords.
- External image usage must record provider, source URL, thumbnail URL, license metadata if available, selected_by, and selected_at.
- Auto image search is only a suggestion until the user/admin selects it.
- Admin can disable external image providers by environment config.

Recommended media tables:

```sql
CREATE TYPE media.asset_source AS ENUM ('upload', 'import', 'external_search', 'generated', 'system');
CREATE TYPE media.asset_status AS ENUM ('pending', 'active', 'rejected', 'deleted');

CREATE TABLE media.asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID,
  source media.asset_source NOT NULL,
  status media.asset_status NOT NULL DEFAULT 'pending',
  kind TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  public_url TEXT,
  thumbnail_url TEXT,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT,
  width_px INTEGER,
  height_px INTEGER,
  checksum_sha256 TEXT,
  alt_text_vi TEXT,
  alt_text_ja TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE media.external_image_candidate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  query_normalized TEXT NOT NULL,
  provider TEXT NOT NULL,
  source_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  width_px INTEGER,
  height_px INTEGER,
  license_label TEXT,
  license_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  selected_asset_id UUID REFERENCES media.asset(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE content.entity_media_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  asset_id UUID NOT NULL REFERENCES media.asset(id),
  role TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(target_type, target_id, asset_id, role)
);
```

Flashcard image UX:

1. Show “Thêm ảnh để nhớ nhanh hơn” when no image exists.
2. `Tự tìm ảnh` creates an image query from card keyword, reading, meaning, and domain tags.
3. Candidate grid shows 12 image candidates with source/provider labels.
4. Selected image is imported to object storage and linked to card.
5. User can upload a custom image from device.
6. User can replace or remove image later.
7. Every image has editable alt text.

Recommended API endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/media/upload` | Upload image/audio to object storage |
| `GET` | `/media/assets/:id` | Get asset metadata |
| `POST` | `/flashcards/cards/:id/images/search` | Generate external image candidates from card keyword |
| `GET` | `/flashcards/cards/:id/images/candidates` | List candidate images |
| `POST` | `/flashcards/cards/:id/images/select` | Import/select one candidate as card image |
| `POST` | `/flashcards/cards/:id/images/upload` | Upload custom card image |
| `DELETE` | `/flashcards/cards/:id/images/:assetId` | Remove image link |

Cursor must implement the media abstraction even if v1 uses a mock provider or local filesystem. The interface must allow later providers such as Google Custom Search, Unsplash, Wikimedia, or internally generated images without changing flashcard code.

### 6.5.2 Additional module table registry

All tables introduced in later sections are part of the canonical database design. This registry ensures Cursor does not miss tables when generating Prisma schemas.

| Module | Schema | Representative tables |
|---|---|---|
| Monetization | `billing` | `plan`, `entitlement`, `subscription`, `quota_usage`, `billing_event`, `refund_log`, `webhook_dead_letter` |
| Social login | `iam` | `identity_provider_account`, `login_event` |
| Referral / Share | `growth` | `referral_code`, `referral_event`, `share_postcard` |
| Reading Assist | `learning` / `content` | `reading_assist_cache`, `reading_assist_user_preference`, `reading_assist_known_term`, `content_text_annotation` |
| Feature flags | `ops` | `feature_flag`, `feature_flag_audit` |
| Content versioning | `ops` / `content` | `content_version`, `content_publish_event` |
| Notification / Email | `ops` | `notification_job`, `email_event` |
| Legal / Consent | `legal` | `policy_version`, `user_consent`, `cookie_consent` |
| Learning Paths | `curriculum` | `learning_path`, `path_stage`, `path_unit`, `unit_activity`, `learner_path_enrollment`, `learner_unit_progress`, `competency_score` |
| Security audit | `ops` | `security_audit_event` |
| Dead-letter queue | `ops` | `dead_letter_entry` |

### 6.6 Indexing strategy

```sql
-- Exact lookup
CREATE INDEX lexeme_form_normalized_idx
  ON content.lexeme_form (normalized_text);

-- Fuzzy fallback and duplicate detection
CREATE INDEX lexeme_form_trgm_idx
  ON content.lexeme_form USING gin (normalized_text gin_trgm_ops);

CREATE INDEX sense_gloss_trgm_idx
  ON content.sense_gloss USING gin (normalized_gloss gin_trgm_ops);

CREATE INDEX example_sentence_ja_trgm_idx
  ON content.example_sentence USING gin (japanese_normalized gin_trgm_ops);

CREATE INDEX grammar_pattern_trgm_idx
  ON content.grammar_point USING gin (pattern_normalized gin_trgm_ops);

-- Hot due cards
CREATE INDEX user_flashcard_due_active_idx
  ON learning.user_flashcard (user_id, due_at)
  WHERE state IN ('new', 'learning', 'review', 'lapsed');

-- Outbox unpublished
CREATE INDEX outbox_unpublished_idx
  ON ops.outbox_event (created_at)
  WHERE published_at IS NULL;
```

### 6.7 Partition strategy

| Table | Strategy | Lý do |
|---|---|---|
| `learning.user_flashcard` | hash by `user_id`, 16/32 partitions | Query daily review cực nóng theo user |
| `learning.review_event` | monthly range by `reviewed_at` | Append-only, analytics theo thời gian |
| `assessment.exam_attempt_answer` | monthly range by `answered_at` | Dữ liệu lớn, analytics/replay |
| `battle.quiz_match_answer` | monthly range by `answered_at` | Realtime log lớn |
| `ops.admin_audit_log` | monthly range by `created_at` | Audit retention/archive |
| `battle.quiz_matchmaking_ticket` | monthly/range or Redis-first + persisted | Matchmaking analytics |

### 6.8 ERD summary

```mermaid
erDiagram
  CONTENT_SOURCE ||--o{ LEXEME : imports
  LEXEME ||--o{ LEXEME_FORM : has
  LEXEME ||--o{ LEXEME_SENSE : has
  LEXEME_SENSE ||--o{ SENSE_GLOSS : has
  LEXEME_SENSE ||--o{ SENSE_TAG : has
  LEXEME }o--o{ KANJI : uses
  EXAMPLE_SENTENCE }o--o{ LEXEME_SENSE : illustrates
  GRAMMAR_POINT }o--o{ EXAMPLE_SENTENCE : uses
  BJT_MOCK_TEST ||--o{ BJT_TEST_SECTION : has
  BJT_TEST_SECTION ||--o{ BJT_QUESTION : has
  BJT_QUESTION ||--o{ BJT_QUESTION_OPTION : has
  USER_PROFILE ||--o{ USER_FLASHCARD : owns
  USER_FLASHCARD ||--o{ REVIEW_EVENT : logs
  USER_PROFILE ||--o{ EXAM_ATTEMPT : takes
  EXAM_ATTEMPT ||--o{ EXAM_ATTEMPT_ANSWER : has
  QUIZ_MATCH ||--o{ QUIZ_MATCH_PLAYER : has
  QUIZ_MATCH ||--o{ QUIZ_MATCH_QUESTION : has
  QUIZ_MATCH ||--o{ QUIZ_MATCH_ANSWER : has
  LEARNING_PATH ||--o{ PATH_STAGE : has
  PATH_STAGE ||--o{ LEARNING_UNIT : has
  LEARNING_UNIT }o--o{ LEXEME : teaches
  LEARNING_UNIT }o--o{ GRAMMAR_POINT : teaches
  LEARNING_UNIT }o--o{ KANJI : teaches
  LEARNING_UNIT }o--o{ COMPETENCY : develops
  USER_PROFILE ||--o{ USER_PATH_ASSIGNMENT : enrolls
  USER_PROFILE ||--o{ USER_COMPETENCY_RECORD : tracks
```

---

## 7. Prisma implementation requirements

Prisma schema phải đặt trong `packages/database/prisma/schema.prisma`. Dùng `@@schema` để map PostgreSQL schema.

### Required enum examples

```prisma
enum ContentStatus {
  draft
  published
  archived
}

enum FormType {
  surface
  kana
  romaji
  latin
}

enum ReviewRating {
  again
  hard
  good
  easy
}

enum BjtPart {
  listening
  listening_reading
  reading
}

enum QuizMatchStatus {
  queued
  matched
  in_progress
  completed
  expired
  cancelled
}
```

### Raw SQL migration policy

Cursor must create normal Prisma models first, then add `migrations/*/migration.sql` for:

- PostgreSQL extensions.
- Schema creation.
- Trigram indexes.
- Partial indexes.
- Partition parent/child tables.
- Function indexes if needed.

Do not try to express every PostgreSQL advanced feature only through Prisma.

---

## 8. Data ingestion / ETL

### 8.1 Required source files

```txt
data/
  javi.json       # JP -> VI dictionary, large
  vija.json       # VI -> JP reverse lookup
  kanji.json      # Kanji metadata
  grammar.json    # Grammar points
  example.json    # Example sentences
```

### 8.2 Import pipeline

```mermaid
flowchart LR
  Raw[Raw JSON files] --> Profile[Streaming schema profiler]
  Profile --> Manifest[Import manifest]
  Raw --> Stage[Staging rows]
  Stage --> Normalize[Normalize/NFKC/language cleanup]
  Normalize --> Canonicalize[Canonical upsert]
  Canonicalize --> Link[Build links: lexeme-kanji-example-grammar]
  Link --> Outbox[Outbox events]
  Outbox --> Meili[Meilisearch projection]
```

### 8.3 Import rules

- Stream JSON; do not load entire file in memory.
- First run must emit schema manifest: key paths, sample values, record count, missing fields.
- Normalize Japanese/Vietnamese keys with NFKC and lower-case where appropriate.
- Deduplicate examples by normalized Japanese text + translation fingerprint.
- `vija.json` is treated as derived reverse projection unless profiler proves it has unique canonical data.
- All import writes must be idempotent using deterministic keys.
- Failed records go to `ops.import_error` with raw sample and error message.

### 8.4 Enrichment / auto-fill

Implement `ops.enrichment_suggestion` with review workflow:

| Confidence | Policy |
|---|---|
| `>= 0.98` | Auto-apply only for safe fields such as normalized text, derived kana, domain tag from deterministic rules |
| `0.80 - 0.98` | Admin review required |
| `< 0.80` | Keep as low-confidence suggestion, not visible by default |

Auto-fill targets:

- BJT relevance score.
- Business domain tag.
- Keigo flag.
- Example-to-lexeme links.
- Example-to-grammar links.
- Kanji links from lexeme surface.
- Generated flashcard templates.
- Generated quiz question candidates.
- NHK article extracted vocabulary/kanji/grammar.

---

## 9. Search architecture

### 9.1 Meilisearch indexes

| Index | Source | Purpose |
|---|---|---|
| `dictionary_entries` | lexeme + forms + senses + gloss | Main dictionary search |
| `kanji` | kanji + readings + meanings | Kanji search |
| `grammar_points` | grammar + alias + explanation | Grammar search |
| `examples` | example + translation + token | Example search |
| `vija_reverse` | derived reverse index | Vietnamese → Japanese |
| `global_search` | compact combined docs | Ctrl+K command palette |

### 9.2 Ranking principles

- Exact surface match > kana match > romaji match > gloss match.
- Business/BJT weighted content ranks higher when user is in BJT mode.
- Published content only for learner; draft/review visible in admin.
- Search result must carry canonical IDs; UI fetches detail from API if needed.

### 9.3 Search fallback in PostgreSQL

If Meilisearch is down, support degraded search using:

- B-tree exact lookup on `normalized_text`.
- Trigram similarity on forms/gloss/examples.
- Limit results aggressively.
- Return `degraded: true` in response metadata.

---

## 10. Backend API surface

Base URL: `/api/v1`

### Auth/User

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | Register via Keycloak-ready flow; dev mode can create local user |
| POST | `/auth/profile` | JWT | Sync profile from JWT |
| GET | `/auth/profile` | JWT | Current profile |
| PUT | `/auth/profile` | JWT | Update displayName, avatar, currentLevel, targetLevel, dailyGoal, timezone, preferences |

### Dictionary / content browsing

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/dictionary/search?q=&page=&limit=` | public | JP→VI search |
| GET | `/dictionary/words/:id` | public | Entry detail with forms/senses/examples/TTS |
| GET | `/kanji?level=&page=&limit=` | public | Kanji list |
| GET | `/kanji/search?q=` | public | Kanji search |
| GET | `/kanji/:id` | public | Kanji detail + SVG stroke order |
| GET | `/grammar?level=&page=&limit=` | public | Grammar list |
| GET | `/grammar/:id` | public | Grammar detail |
| GET | `/examples?page=&limit=` | public | Example list |
| GET | `/examples/by-word/:wordId` | public | Examples by word |
| GET | `/examples/search?keyword=&limit=` | public | Example search |
| GET | `/vija/search?q=&page=&limit=` | public | VI→JP search |
| GET | `/search?q=&limit=` | public | Unified search |

### BJT levels

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/levels/:level` | public | BJT level detail J5→J1+ |
| GET | `/levels/:level/vocabulary?page=&limit=` | public | Vocabulary by level |
| GET | `/levels/:level/kanji?page=&limit=` | public | Kanji by level |
| GET | `/levels/:level/grammar?page=&limit=` | public | Grammar by level |

### Bookmarks

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/bookmarks/check/:type/:id` | JWT | Check bookmark |
| POST | `/bookmarks/:type/:id` | JWT | Toggle bookmark |
| GET | `/bookmarks/words` | JWT | Word bookmarks |
| GET | `/bookmarks/kanji` | JWT | Kanji bookmarks |
| GET | `/bookmarks/grammar` | JWT | Grammar bookmarks |

### Flashcard / decks / SRS

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/decks` | JWT | User decks |
| POST | `/decks` | JWT | Create deck |
| GET | `/decks/presets` | public | Public preset decks |
| POST | `/decks/presets/:id/clone` | JWT | Clone preset |
| GET | `/decks/:id` | JWT | Deck detail |
| PUT | `/decks/:id` | JWT | Update deck |
| DELETE | `/decks/:id` | JWT | Delete deck |
| GET | `/decks/:deckId/cards?status=&page=` | JWT | Cards in deck |
| POST | `/decks/:deckId/cards` | JWT | Add card |
| DELETE | `/decks/:deckId/cards/:id` | JWT | Remove card |
| GET | `/review/next?deckId=&limit=` | JWT | Due queue |
| POST | `/review` | JWT | Submit rating Again/Hard/Good/Easy |
| GET | `/review/summary` | JWT | Today review summary |
| POST | `/flashcards/cards/:id/images/search` | JWT | Auto-search image candidates by card keyword/meaning |
| GET | `/flashcards/cards/:id/images/candidates` | JWT | List image candidates for card |
| POST | `/flashcards/cards/:id/images/select` | JWT | Select/import external image into card |
| POST | `/flashcards/cards/:id/images/upload` | JWT | Upload user image for card |
| DELETE | `/flashcards/cards/:id/images/:assetId` | JWT | Remove image from card |

### Study / progress / achievements

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/study/sessions` | JWT | Start study mode REVIEW/LEARN_NEW/CRAM/QUIZ/BJT_PRACTICE |
| PUT | `/study/sessions/:id` | JWT | Finish session |
| GET | `/study/stats` | JWT | Aggregate stats |
| GET | `/study/stats/daily?days=` | JWT | Daily chart data |
| GET | `/study/streak` | JWT | Current streak |
| GET | `/study/heatmap?year=` | JWT | Contribution heatmap |
| GET | `/progress/dashboard` | JWT | Weakness, estimated BJT band, recommendations |
| GET | `/achievements` | JWT | Achievements + unlocked state |
| GET | `/achievements/recent` | JWT | Recent achievements |

### NHK news

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/nhk-news` | public | Latest NHK RSS, cached 10 min |
| GET | `/nhk-news/:articleId/analyze` | public | Extract kanji/vocab/grammar |
| POST | `/nhk-news/:articleId/generate-deck` | JWT | Generate flashcard deck |

### Quiz / BJT mock exam

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/quiz/templates?type=` | public | Browse templates |
| GET | `/quiz/templates/:id` | public | Template detail |
| POST | `/quiz/start` | JWT | Start session |
| GET | `/quiz/session/:id/question` | JWT | Current question |
| POST | `/quiz/session/:id/answer` | JWT | Submit/save answer |
| GET | `/quiz/session/:id/results` | JWT | Result, estimated score/band, weak areas |
| POST | `/quiz/session/:id/abandon` | JWT | Abandon |
| GET | `/quiz/history?page=&limit=` | JWT | History |

### Battle REST

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/battle/configs` | JWT | Match configs |
| GET | `/battle/leaderboard?limit=` | JWT | Elo leaderboard |
| GET | `/battle/leaderboard/me` | JWT | My rank |
| GET | `/battle/history?page=&limit=` | JWT | My battle history |
| GET | `/battle/history/:roomCode` | JWT | Match detail |
| GET | `/battle/stats` | JWT | Win/loss/draw/streak/rank |
| GET | `/battle/ranks` | JWT | Rank distribution |

### Admin

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/dashboard` | admin | Stats, jobs, health |
| GET | `/admin/users` | admin | Keycloak/user list |
| GET | `/admin/content/words` | admin.content | Search words |
| POST | `/admin/content/words` | editor.lexeme | Create word |
| PATCH | `/admin/content/words/:id` | editor.lexeme | Update word |
| GET | `/admin/content/kanji` | editor.kanji | Kanji CMS |
| GET | `/admin/content/grammar` | editor.grammar | Grammar CMS |
| GET | `/admin/presets` | admin.content | Preset decks |
| POST | `/admin/presets` | admin.content | Create preset |
| GET | `/admin/quiz/templates` | editor.exam | Quiz templates |
| POST | `/admin/quiz/templates` | editor.exam | Create template |
| GET | `/admin/quiz/questions` | editor.exam | Question bank |
| POST | `/admin/quiz/questions` | editor.exam | Create question |
| GET | `/admin/battle/configs` | admin.content | Battle config |
| GET | `/admin/imports` | operator.import | Import jobs |
| POST | `/admin/imports` | operator.import | Start import |
| GET | `/admin/enrichment` | editor.enrichment | Suggestions |
| POST | `/admin/enrichment/:id/approve` | editor.enrichment | Approve |
| POST | `/admin/enrichment/:id/reject` | editor.enrichment | Reject |
| GET | `/admin/audit` | viewer.audit | Audit log |
| GET | `/admin/analytics` | viewer.analytics | Analytics |
| GET | `/admin/iam/roles` | iam.manage | Role mapping |

### 10.1 Canonical API registry rule

Section 10 is the **canonical API registry**. Any endpoint introduced in later sections (26–31) MUST also be mirrored in this section before implementation begins. This prevents Cursor from building controllers that exist in prose but are missing from the central API surface.

The following API groups are required in addition to the core groups listed above:

| API group | Prefix | Defined in |
|---|---|---|
| Learning Paths (learner) | `/learning-paths/*` | §29 |
| Learning Paths (admin) | `/admin/learning-paths/*` | §29 |
| Reading Assist | `/reading-assist/*` | §28 |
| Feature Flags (admin) | `/admin/operations/feature-flags/*` | §30.6 |
| Kill Switches (admin) | `/admin/operations/kill-switches/*` | §30.6.1 |
| Dead-Letter Queue (admin) | `/admin/operations/dead-letter-queue/*` | §30.11 |
| Content Versions (admin) | `/admin/content-versions/*` | §30.7 |
| Monetization (learner) | `/monetization/*`, `/billing/*` | §26 |
| Monetization (admin) | `/admin/monetization/*` | §26 |
| OAuth / Social login | `/auth/oauth/*` | §27 |
| Referrals | `/referrals/*` | §27.8 |
| Share / Postcards | `/share/*` | §27.5–27.7 |
| Legal / Consent | `/legal/*`, `/consent/*` | §31 |
| Privacy | `/privacy/*` | §21.11 |
| Notifications (admin) | `/admin/notifications/*` | §30.8 |

When implementing a new module, the developer MUST add its endpoints to this registry table first, then implement the controller.

---

## 11. Realtime Battle specification

Namespace: `/battle`

### 11.1 Lobby events

| Event | Direction | Purpose |
|---|---|---|
| `connection` | client→server | JWT auth, store online user in Redis |
| `disconnect` | client→server | Cleanup queue/online/match abandon |
| `lobby:get_online_users` | client→server | Online users + 6 virtual bots |
| `lobby:online_count` | server→broadcast | Online count |
| `lobby:chat_send` | client→server | Global chat, rate limit 5 msg/10s, max 500 chars |
| `lobby:chat_message` | server→broadcast | Broadcast chat |
| `lobby:chat_history` | client→server | Last 50 messages |

### 11.2 Matchmaking / challenge

| Event | Direction | Purpose |
|---|---|---|
| `battle:find_match` | client→server | Elo-based queue |
| `battle:searching` | server→client | Queue accepted |
| `battle:cancel_match` | client→server | Cancel queue |
| `battle:challenge_user` | client→server | Challenge specific user |
| `battle:challenge_received` | server→target | Challenge popup |
| `battle:challenge_respond` | client→server | Accept/decline within TTL 30s |
| `battle:challenge_bot` | client→server | Fight selected bot level |
| `battle:match_found` | server→both | Found roomCode |

### 11.3 Room events

| Event | Direction | Purpose |
|---|---|---|
| `battle:join_room` | client→server | Join room, get full state |
| `battle:room_info` | server→client | Room state |
| `battle:ready` | client→server | Player ready |
| `battle:countdown` | server→room | 3-2-1 |
| `battle:question` | server→room | Current question |
| `battle:answer` | client→server | Submit answer, idempotency key required |
| `battle:answer_result` | server→client | Correct/wrong, responseMs, scoreDelta |
| `battle:score_update` | server→room | Live score |
| `battle:emoji` | client→room | Emoji reaction |
| `battle:mini_chat_send` | client→room | In-room chat |
| `battle:finished` | server→room | Final result, Elo changes |
| `battle:reconnect_state` | server→client | Full state recovery |

### 11.4 Fairness / anti-cheat

- Server decides question, timer, score, correct answer.
- Client only sends answer option + idempotency key + client timestamp.
- Reject duplicate answers for same round.
- Response time uses server receive time, not client time.
- Bot response delay randomized by bot level.
- Store final result in PostgreSQL; Redis state is disposable.

---

## 12. Flashcard / SRS

### 12.1 Card templates

| Template | Source | Example |
|---|---|---|
| `word_meaning` | lexeme_sense | Japanese → Vietnamese meaning |
| `word_reading` | lexeme_form | Kanji → kana |
| `kanji_meaning` | kanji | Kanji → meaning |
| `kanji_reading` | kanji_reading | Kanji → on/kun |
| `grammar` | grammar_point | Pattern → usage |
| `example_cloze` | example_sentence | Fill missing expression |
| `listening` | example/audio/question | Hear → choose meaning |
| `keigo_choice` | business expression | Choose appropriate keigo |
| `business_context` | BJT scenario | Best response in workplace |

### 12.2 Scheduler

Base algorithm: SM-2 variant with BJT modifiers.

- Ratings: Again, Hard, Good, Easy.
- Track `easeFactor`, `intervalDays`, `repetition`, `lapseCount`, `dueAt`.
- Modifier factors:
  - Business score high → repeat slightly sooner.
  - Listening difficulty high → repeat sooner.
  - Keigo/business expression failed repeatedly → stronger penalty.
  - Exam wrong answer → auto-generate remediation card.

### 12.3 Exam-to-card remediation

When user finishes quiz/mock exam:

1. Analyze wrong answers by target links: lexeme, grammar, kanji, example, business domain.
2. Group by weak area.
3. Generate suggested cards.
4. Add to “BJT Weakness Deck” or ask user to confirm.
5. Update progress dashboard.

---

## 13. Frontend Learner features

### 13.1 Home `/`

- Hero section with CTA.
- Continue Learning: due cards + streak.
- Daily vocabulary random card.
- Quick access cards: Dictionary, Kanji, Grammar, Flashcard.
- NHK news grid 6 articles + analyze + generate deck.
- Quiz section link to BJT practice.
- BJT Levels grid J5→J1+.

### 13.2 Dictionary `/dictionary`

- Debounced search 300ms.
- Supports kanji/hiragana/katakana/romaji/Vietnamese.
- Cards: word, phonetic/kana, pronunciation, top 3 meanings.
- Pagination.
- Bookmark heart.
- Detail page shows forms, meanings grouped by POS, examples, TTS, related kanji/grammar, “study this sense”.

### 13.3 Kanji `/kanji`

- Grid by level 1-8.
- Search by literal/on/kun/meaning.
- Detail: SVG stroke order sanitized by DOMPurify, on/kun readings, meaning, components, example vocabulary, bookmark, add to deck.

### 13.4 Grammar `/grammar`

- Tabs N1-N5 + BJT/business tags.
- Detail: define, structure, Vietnamese meaning, HTML/Markdown notes sanitized, examples, related patterns, add to deck.

### 13.5 ViJa `/vija`

- Vietnamese→Japanese search.
- Results link back to canonical lexeme when possible.

### 13.6 Global search `Ctrl+K`

- Overlay command palette.
- Search words/kanji/grammar/examples/vija.
- Keyboard navigation.
- Quick actions: open, bookmark, add to deck.

### 13.7 Flashcards `/flashcards`

- Deck list.
- Preset decks by BJT level.
- Review mode: flip card, shortcuts Space/Enter/1-4.
- Card states: NEW, LEARNING, REVIEW, GRADUATED, SUSPENDED.
- Daily review summary.

### 13.8 Study `/study`

- Modes: REVIEW, LEARN_NEW, CRAM, QUIZ, BJT_PRACTICE.
- Stats: total cards, total sessions, total time, streak.
- Daily chart and heatmap.

### 13.9 Bookmarks `/bookmarks`

- Tabs: Words, Kanji, Grammar.
- Remove bookmark.
- Navigate to detail.

### 13.10 BJT Levels `/levels/[level]`

- Level overview: description, estimated score range.
- Vocabulary cards with meaning/example/TTS.
- Kanji grid.
- Grammar expandable cards.
- Preset decks clone.
- Full vocabulary pagination.

### 13.11 Quiz `/quiz`

- Template hub: MOCK_EXAM, FULL_BJT, COMPONENT, CUSTOM.
- Session page: one question at a time, 4 options, timer, progress bar, submit/explanation, keyboard shortcuts.
- Results: estimated BJT score/band, per-section analysis, wrong answer review, generated flashcard suggestions.
- History: pagination, best scores, status badges.

### 13.12 Battle `/battle`

- Lobby: online users, 6 bots, global chat, random match, challenge user/bot, receive challenge modal.
- Room: Waiting → Countdown → Questions → Results → Finished.
- UI: split-screen score, timer bar, emoji reactions, mini chat, Elo changes.
- History and leaderboard pages.

### 13.12.1 Learning Paths `/learning-paths`

- Path catalog: browse published paths as premium cards with cover image, title, BJT level, estimated time, difficulty.
- "Recommended for you" section based on placement/competency analysis.
- Path detail: hero section, visual stage roadmap (timeline), unit list per stage, progress indicators.
- Unit view: renders content based on unit_type (vocabulary set, grammar lesson, listening exercise, keigo practice, etc.).
- "Continue Learning" button: jumps to next available unit from adaptive sequencer.
- Study session from path: sequencer generates warm-up → core → practice → cool-down plan.
- Session summary: mastery updates, encouragement, next session preview.
- Competency radar: interactive radar chart from `user_competency_record`, click axis to drill into skill.
- Path roadmap in analytics: visual J5→J1+ with current position and estimated time to milestones.

### 13.13 Profile `/profile`

- Edit displayName, avatar, BJT level, daily goal, timezone.
- Activity stats.

### 13.13.1 Learner analytics `/analytics`

This page is one of the most important motivation surfaces. It must feel like a personal coach, not a dry report.

Required learner analytics screens:

| Screen | UX goal | Required components |
|---|---|---|
| Overview | “I know what to do next.” | today score, next best action, streak, due cards, 5-minute quick start |
| Progress | “I can see my effort accumulating.” | daily study chart, review count, minutes, accuracy, heatmap |
| Skill Radar | “I understand my weak point.” | radar chart for vocab/kanji/grammar/keigo/listening/reading/speed |
| BJT Roadmap | “I am moving toward J1/J1+.” | estimated band trend, section breakdown, next milestone |
| Mistake Notebook | “My mistakes are becoming assets.” | repeated mistakes, leech cards, explanation, one-click review deck |
| Achievement Timeline | “I have proof of progress.” | milestones, badges, personal records, comeback moments |
| Weekly Report | “I feel proud and know next week’s plan.” | summary, best day, weakest skill, recommended focus plan |

Learner analytics UX rules:

- Use encouraging copy and coaching language.
- Default comparison is “this week vs last week”, not “you vs everyone”.
- Show one primary action per analytics card.
- Make progress visible even when accuracy is low.
- Convert failure into a remediation plan: “Review these 12 cards” / “Try a 5-minute listening sprint”.
- Avoid overwhelming charts on mobile; use progressive disclosure.

Recommended chart components:

- Study heatmap.
- Daily bar chart for reviews/minutes.
- Line chart for estimated BJT band.
- Radar chart for skill mastery.
- Donut chart for card states.
- Table for repeated mistakes.
- Timeline for achievements.

### 13.13.2 Smart coaching insights

The app should generate small coaching messages from analytics. Examples:

| Situation | Message style | Action |
|---|---|---|
| User has many due cards | “Hôm nay chỉ cần 8 phút để giữ nhịp.” | Start Review |
| Accuracy drops | “Có vẻ phần kính ngữ đang nặng hơn. Mình gom lại 10 câu nhẹ trước nhé.” | Practice Keigo |
| User returns after missed days | “Không sao, mình bắt đầu lại bằng gói hồi phục 5 phút.” | Comeback Mode |
| User improves speed | “Tốc độ trả lời của bạn nhanh hơn tuần trước 18%.” | View Progress |
| User repeats same mistakes | “3 lỗi này xuất hiện nhiều lần, biến nó thành deck riêng nhé.” | Create Mistake Deck |

### 13.14 UI/UX

- Japanese aesthetic: sakura, bamboo, indigo, ink.
- Fonts: Inter + Noto Sans JP.
- Responsive mobile-first.
- Navbar with 10 items + search trigger + auth state.
- TTS via Web Speech API `ja-JP`, rate 0.8.
- Toast via react-hot-toast.
- Skeleton loading.
- Safe HTML rendering with DOMPurify.

---



### 13.15 Product design philosophy: premium, motivating, habit-forming learning UX

The learner app must not feel like a generic admin dashboard or a raw dictionary clone. It must feel like a premium Japanese learning companion built for Vietnamese learners preparing for real business life in Japan. The design should combine calm Japanese minimalism, emotional motivation, fast feedback, and small habit loops that make daily study feel rewarding.

#### Design personality

| Dimension | Direction |
|---|---|
| Emotional tone | Calm, focused, encouraging, slightly playful, never childish |
| Visual identity | Modern Japanese minimalism: white space, indigo, warm cream, subtle sakura accent, ink-like dividers |
| Learning mood | “I can improve a little every day” rather than “I am being tested all the time” |
| Brand feeling | Premium, trustworthy, professional, friendly for Vietnamese learners in Japan |
| Interaction style | Fast, smooth, tactile, low-friction, keyboard-friendly, mobile-first |

#### Psychology-driven UX principles

| Principle | Implementation |
|---|---|
| Reduce startup friction | Home screen always shows one obvious next action: Continue, Review due, Start 5-minute session |
| Give quick wins | First session should complete in under 2 minutes and immediately unlock a visible achievement |
| Build daily identity | Show streak, daily goal, weekly consistency, and “you are becoming business-ready” messaging |
| Use variable rewards carefully | Random daily word, bonus card, surprise encouragement, but no manipulative dark patterns |
| Make progress visible | Level map J5→J1+, skill radar, weak areas, due cards, estimated BJT band |
| Encourage mastery | Wrong answers become review cards automatically; mistakes are framed as “next focus” |
| Avoid shame | Never show harsh failure language. Use supportive copy and specific next steps |
| Use social motivation | Battle, leaderboard, bot challenge, rank, but always allow solo/private mode |
| Support flow state | Review mode should minimize UI noise: card, answer, rating, next |
| Reward effort, not only correctness | XP/streak should count consistent study, while accuracy affects skill mastery |

#### Healthy achievement and fun-learning system

The app should feel rewarding like a good game, but rewards must reinforce real learning and long-term confidence.

| Feature | User feeling | Implementation |
|---|---|---|
| Daily Mission | “Hôm nay chỉ cần làm việc nhỏ này” | 1–3 small tasks: review 10 cards, learn 3 business words, answer 5 quiz questions |
| Weekly Journey Map | “Mình đang đi tới đích” | Visual path from J5 → J1+, weekly checkpoints, unlocked milestones |
| Skill Garden | “Kiến thức của mình đang lớn lên” | Skills grow as plants: vocabulary, keigo, reading, listening, grammar |
| Achievement Badges | “Mình đã làm được thật” | Badges for consistency, skill mastery, comeback, first battle, first BJT mock |
| Memory Palace | “Mỗi từ có hình ảnh và bối cảnh” | Flashcard images + examples + mnemonic notes create visual memory hooks |
| Comeback Mode | “Mất streak không sao” | After missed days, offer 5-minute recovery plan, not punishment |
| Focus Sprint | “Học ngắn mà hiệu quả” | 5/10/15-minute timed sessions with calm ending summary |
| Boss Challenge | “Vượt qua thử thách lớn” | Weekly bot boss by BJT level, unlocks title/badge when cleared |
| Mistake Notebook | “Sai là tài sản học tập” | Wrong answers automatically grouped by reason and converted into cards |
| Study Room Ambience | “Không khí học dễ chịu” | Optional subtle themes: cafe, office, rainy Tokyo, silence |
| Encouragement Cards | “App hiểu mình” | Personalized copy based on behavior: tired, comeback, high streak, exam focus |
| Progress Story | “Mình thấy tương lai rõ hơn” | Monthly summary: learned words, improved skills, next recommended goal |

Gamification must be soft, elegant, and optional. Competitive users get battle/rank; quiet users get private progress, garden, focus, and mastery.

#### Motivation mechanics by user psychology

| User type | Risk | UX support |
|---|---|---|
| Beginner | Overwhelmed by too many words | Guided path, tiny daily mission, clear “start here” |
| Busy worker | No time and low energy | 5-minute sessions, resume state, commute mode, audio/listening cards |
| Exam-focused learner | Wants measurable progress | Diagnostic, estimated band, weak-skill report, mock exams |
| Competitive learner | Needs excitement | PvP, bots, Elo, weekly boss, leaderboard with privacy controls |
| Anxious learner | Afraid of mistakes | Gentle copy, mistake notebook, no shame language, private mode |
| Visual learner | Remembers through images | Flashcard image panel, mnemonic image, illustrated examples |

Cursor must build these UI states: first-run onboarding, returning-user resume dashboard, missed-day recovery, high-achievement celebration, long-session fatigue suggestion, and empty states with one clear next action.

#### Design tokens

```ts
export const themeTokens = {
  colors: {
    background: '#FAF7F0',
    surface: '#FFFFFF',
    primary: '#243B6B',
    primarySoft: '#E8EEF9',
    sakura: '#F4B6C2',
    matcha: '#8AAE7F',
    amber: '#F2B84B',
    danger: '#D9534F',
    ink: '#1F2937',
    muted: '#6B7280',
    border: '#E5E7EB'
  },
  radius: {
    card: '1.25rem',
    button: '0.875rem'
  },
  shadow: {
    card: '0 12px 30px rgba(31, 41, 55, 0.08)',
    floating: '0 20px 50px rgba(31, 41, 55, 0.12)'
  }
};
```

Ethical habit-forming constraints:

- Do not punish users for missing a day.
- Allow streak freeze or gentle recovery.
- Do not use infinite scroll for study sessions.
- Always show session length and allow stopping.
- Battle mode must not block learning progress for non-competitive users.
- Rewards should encourage learning consistency, not compulsive usage.


## 14. Admin Panel features

### 14.1 Admin auth and RBAC

Use Keycloak-ready admin roles:

| Role | Permission |
|---|---|
| `admin.super` | Full access |
| `admin.content` | Content CRUD except IAM |
| `editor.lexeme` | Words/senses/examples |
| `editor.kanji` | Kanji |
| `editor.grammar` | Grammar |
| `editor.exam` | Quiz/question/exam |
| `editor.enrichment` | Approve/reject/apply suggestions |
| `operator.import` | Import run/retry/cancel |
| `viewer.analytics` | Analytics only |
| `viewer.audit` | Audit only |
| `support.user` | User support read-only |
| `iam.manage` | Role mapping |



### 14.1.1 Enterprise admin design requirements

The admin panel is a professional operating system for the learning platform, not a simple CRUD page. It must support scale, auditability, content governance, role separation, media safety, learner support, and future team expansion.

Admin layout:

- Left sidebar grouped by: Overview, Content, Learning, Assessment, Battle, Media, Import, Enrichment, Users, Analytics, Operations, IAM, Audit.
- Global command palette for users, content, questions, import jobs, media assets.
- Dangerous actions require confirmation and optional audit reason.
- Editors support draft saving, validation, preview, publish, archive.
- Tables support filter, sort, saved views, bulk actions, CSV export where appropriate.
- Admin UI supports VI/JA labels from i18n, not hard-coded text.

#### Canonical admin RBAC matrix

The table below is the **canonical admin RBAC matrix**. If it conflicts with the shorter role list in 14.1, this expanded matrix wins. All role checks MUST use these role keys.

| Role | Purpose |
|---|---|
| `admin.super` | Full system access and break-glass operations |
| `admin.content` | Oversees all content teams |
| `editor.lexeme` | Manage dictionary entries, senses, examples |
| `editor.kanji` | Manage kanji, readings, stroke assets |
| `editor.grammar` | Manage grammar points, examples, notes |
| `editor.exam` | Manage BJT templates, questions, scoring rules |
| `editor.media` | Review/upload/delete media, moderate external images |
| `editor.i18n` | Manage UI/content translations |
| `editor.enrichment` | Review AI/algorithm suggestions |
| `operator.import` | Run profiler/import/reindex jobs |
| `operator.support` | User support actions: view profile, reset progress flags, inspect issues |
| `viewer.analytics` | Analytics read-only |
| `viewer.audit` | Audit read-only |
| `iam.manage` | Grant/revoke admin roles |
| `billing.manage` | Subscription/payment admin, separated from content roles |

Required admin modules:

| Module | Required screens |
|---|---|
| Overview | Dashboard, system health, queue health, recent admin actions |
| User Management | user list, profile detail with avatar, learning stats, battle stats, support notes, privacy flags |
| Content CMS | dictionary, kanji, grammar, examples, localized fields, publish workflow |
| Media Library | uploaded images/audio/SVG, external image candidates, moderation, duplicate detection |
| Flashcard Admin | preset decks, card templates, generated card variants, image rules |
| BJT Exam Admin | mock tests, section builder, question bank, remediation links, simulation |
| Battle Admin | configs, bot profiles, ranking seasons, match monitor, abuse signals |
| Import Center | profiler, manifests, dry-run diff, canonical import, retry failed chunks, reindex |
| Enrichment Queue | auto-fill suggestions, confidence review, side-by-side diff, batch apply |
| i18n Center | translation keys, missing translation dashboard, locale fallback preview |
| Analytics | retention, cohort, skill weakness, search terms, card performance, BJT progress |
| IAM | admin users, roles, permissions, audit of role changes |
| Audit Log | immutable before/after, actor, target, reason, traceId |

User profile detail must show avatar, display name, email, Keycloak subject, status, UI language, explanation language, timezone, current/target BJT level, daily goal, learning personality, streak, reviews, learned cards, weak skills, quiz trend, battle Elo, bookmarks/decks, support notes, and moderation flags. No password or token exposure is allowed.


### 14.2 Dashboard

- Stats cards: users, words, kanji, reviews, cards, quizzes, battles.
- Job health: import, outbox lag, Meili backlog, failed BullMQ jobs.
- Quick links.

### 14.3 Users

- User list from local profile + Keycloak-ready metadata.
- Avatar thumbnail, display name, email, provider, enabled/disabled, locale, timezone.
- Search by name/email/user id/Keycloak subject.
- Filter by target BJT level, current band, role, active/inactive, risk/support flag.
- User activity summary: last active, streak, cards reviewed, quiz attempts, battle rank.
- Profile detail with avatar, goals, learning style, language preferences, privacy settings.
- Support actions: add note, suspend/unsuspend, reset stuck study session, export user data, anonymize on deletion request.
- All support actions must be audited with reason.

### 14.4 Content CMS

Unlike old FEATURES.md read-only design, new admin must support controlled CRUD:

- Words: forms, senses, gloss, tags, examples, publish/archive.
- Kanji: readings, meaning, stroke/svg, examples.
- Grammar: aliases, structure, note, examples.
- Examples: Japanese text, readings, translation, tokens, audio link.
- Draft → review → publish workflow.
- Preview Meilisearch document before publish.

### 14.5 Preset decks

- List by BJT level/type.
- Create manually or auto-generate.
- Detail edit metadata.
- Add/remove cards.
- Bulk generation from vocab/kanji/grammar/query.



### 14.5.1 Media library admin

- List all media assets: images, audio, SVG stroke files, imported assets, external images.
- Filter by source: upload/import/external_search/generated/system.
- Filter by status: pending/active/rejected/deleted.
- Preview image/audio safely.
- Detect duplicate images by checksum and perceptual hash if implemented.
- Approve/reject external image candidates before they become public preset content.
- Edit alt text in VI/JA/EN.
- See usage graph: which card/content/question uses this asset.
- Bulk delete only when asset is unused or after relinking.
- Audit every media moderation action.

### 14.5.2 i18n admin

- Translation key list by namespace.
- Missing translation dashboard.
- Side-by-side editor for Vietnamese / Japanese / English.
- Preview selected UI screen in each locale.
- Import/export translation JSON.
- Fallback warning when a key is missing in launch locales.
- Role required: `editor.i18n` or `admin.super`.


### 14.6 Quiz admin

- Dashboard with templates/questions/sessions/avg score.
- Template CRUD.
- Wizard 3 steps: Basic Info → Structure Builder → Review.
- Load standard BJT structure: 3 parts, 9 sections, 80 questions, 105 minutes.
- Question bank with filters: category, difficulty, search, accuracy stats.
- Bulk delete/export/import.
- Question editor with options, explanation, remediation links.

### 14.7 Battle admin

- Battle configs: duration, rounds, scoring, rank availability.
- Bot profiles: level J5→J1+, speed, accuracy, chat style.
- Match monitor: active/completed/abandoned.
- Leaderboard management.
- Abuse/cheat signals.

### 14.8 Import center

- Upload/select source files.
- Run profiler dry-run.
- View schema manifest.
- Start canonical import.
- Inspect errors and retry failed chunks.
- Trigger reindex.

### 14.9 Enrichment queue

- Filter by content type, confidence, algorithm.
- Side-by-side diff current vs candidate.
- Approve/reject/apply.
- Batch approve safe high-confidence items.
- Undo via content version restore.

### 14.10 Audit / IAM / Analytics

- Immutable audit log with actor, action, target, before/after, reason, traceId.
- Role mapping page.

Admin analytics must be a full operations center with the following dashboards:

| Dashboard | Main questions | Required metrics |
|---|---|---|
| Executive Overview | Is the product healthy? | DAU/WAU/MAU, new users, active learners, reviews/day, quizzes/day, battles/day |
| Learning Health | Are learners improving? | retention, average study minutes, accuracy trend, streak distribution, comeback success |
| Skill Weakness | What is hard for learners? | weak skill distribution, leech cards, low-mastery clusters, BJT section weakness |
| Content Quality | Which content needs fixing? | low accuracy questions, confusing distractors, zero-click entries, repeated report flags |
| Search Analytics | What do users search and fail to find? | top queries, zero-result queries, CTR, locale split, typo patterns |
| BJT Exam Analytics | Is exam training effective? | completion rate, estimated band distribution, section scores, time pressure failures |
| Flashcard Analytics | Is SRS working? | due burden, new/review ratio, lapse rate, card kind performance, image-card effect |
| Battle Analytics | Is realtime learning fun and fair? | match completion, abandon rate, bot win rate, Elo distribution, average response time |
| Funnel Analytics | Where do users drop? | signup → onboarding → first search → first card → first review → first quiz → day-7 return |
| System Analytics | Is infrastructure healthy? | API latency, worker lag, Meili sync lag, failed jobs, import/reindex status |

Admin analytics UX requirements:

- Date range selector: 7d / 30d / 90d / custom.
- Segment filters: locale, target BJT level, signup cohort, learner type, device, country/timezone.
- Export CSV for aggregate tables only.
- Drill-down from aggregate metric to content/user only if role allows it.
- Every user-level drill-down from support/admin analytics must be audited.
- Show data freshness timestamp and rollup job status.
- Show insight cards such as “Top 20 zero-result queries this week” or “Questions with high wrong-answer concentration”.

### 14.10.1 Admin analytics information architecture

Admin analytics must not be a single page with a few charts. It must behave like a professional BI-style control center with a clear navigation model, visualization standards, drill-down flows, and actionability.

#### Admin analytics navigation

| Area | Purpose | Example screens |
|---|---|---|
| Executive | Business health and top-line KPIs | Executive overview, KPI scorecards, weekly digest |
| User Growth | Acquisition, activation, retention, resurrection | funnel, cohort retention, onboarding drop-off |
| Learning | Learning volume and outcomes | study activity, mastery, streaks, comeback, mission completion |
| Content | Dictionary, kanji, grammar, example, media quality | quality score, zero-engagement content, content aging |
| Flashcards | SRS effectiveness and card performance | lapse trend, card template comparison, image-card impact |
| Assessment | BJT mock exams and quizzes | score distribution, section difficulty, question psychometrics |
| Battle | PvP and bot training health | matchmaking time, abandon rate, fairness, bot balance |
| Search | Search demand and search failures | query trends, zero-result queries, CTR, no-click results |
| Support / User 360 | user-level diagnostic view for authorized staff | profile, activity timeline, issues, audit trail |
| Platform Ops | system health and data freshness | API latency, queue lag, reindex status, analytics freshness |

#### Executive overview screen

The executive overview should open with a KPI header and a compact trend summary. Recommended cards:

- Total registered users
- Active learners (DAU / WAU / MAU)
- New paid/free users if billing is later introduced
- Reviews completed today / week / month
- Quizzes completed today / week / month
- Average study minutes per active learner
- D1 / D7 / D30 retention
- Battle completion rate
- Search success rate
- Content quality score

Recommended visualizations:

- KPI scorecards with delta vs previous period
- Multi-series line chart for DAU/WAU/MAU trend
- Stacked bar chart for activity mix: review vs quiz vs battle vs reading/news
- Cohort heatmap for retention
- Donut or stacked bar for active users by locale and target BJT level
- Alert list for anomalies and action items

#### User growth analytics

| Dashboard | Visualizations | Key metrics |
|---|---|---|
| Acquisition | line chart, channel table, geo map if applicable | signup volume, signup conversion, invite/referral performance |
| Activation Funnel | funnel chart, step table | signup → onboarding → first search → first card → first review → first quiz → day-7 return |
| Retention | cohort heatmap, survival curve, stacked retention line | D1/D7/D14/D30 retention, resurrection rate, churn rate |
| Segmentation | bar chart, treemap | cohort by locale, BJT target, device, learner type, source |

#### Learning analytics

| Dashboard | Visualizations | Key metrics |
|---|---|---|
| Study Activity | line chart, weekday heatmap | sessions/day, minutes/day, avg session duration, completion rate |
| Mastery & Progress | radar chart, stacked mastery bars, trend line | mastery by skill, level progress, reviewed-to-mastered conversion |
| Habit & Motivation | streak histogram, mission completion chart | streak length distribution, comeback rate, daily mission completion, burnout risk |
| Mistakes & Recovery | Pareto chart, table with drill-down | repeat mistakes, leech cards, recovery rate after remediation |

#### Content analytics

| Dashboard | Visualizations | Key metrics |
|---|---|---|
| Dictionary Content | table + sparkline, zero-engagement table | views, bookmark rate, add-to-deck rate, zero-engagement entries |
| Kanji / Grammar | bar chart, confusion matrix, trend line | difficult items, completion rate, mastery lift after exposure |
| Example & Media | bar chart, quality table | example usage, audio play rate, image usage rate, missing-media coverage |
| Content Quality | scatter plot, issue table | low-accuracy content, flagged items, outdated content, duplicate risk |

Content quality score should combine:

- learner accuracy patterns
- repeated wrong-answer concentration
- abandonment rate
- report/flag count
- zero-click or zero-bookmark signals
- stale content age
- missing translation or media coverage

#### Flashcard analytics

| Dashboard | Visualizations | Key metrics |
|---|---|---|
| SRS Health | line chart, burden gauge, distribution bars | due burden, new/review ratio, overdue rate, daily review completion |
| Card Performance | box plot or histogram, ranking table | lapse rate, average response time, retention by template type |
| Image Card Impact | comparison bars, uplift table | accuracy lift, recall speed, bookmark lift, engagement lift for cards with images |
| Deck Analytics | table + trend sparkline | active decks, deck completion, deck abandonment, clone rate for presets |

#### Assessment and BJT analytics

| Dashboard | Visualizations | Key metrics |
|---|---|---|
| Exam Overview | distribution histogram, trend line | completion rate, average estimated score, median score, time spent |
| Section Performance | grouped bars, radar, heatmap | listening vs listening-reading vs reading accuracy, time pressure, confidence gap |
| Question Diagnostics | item table, difficulty-discrimination scatter | p-value, distractor popularity, skip rate, too-easy / too-hard items |
| Blueprint Coverage | matrix heatmap | coverage by BJT skill, business scenario, keigo, vocabulary/grammar/reading/listening |

Professional exam analytics should also support psychometric-style indicators for internal tuning:

- difficulty index
- discrimination proxy
- distractor effectiveness
- time-to-answer distribution
- first-attempt vs repeat-attempt gap
- skill-tag performance by cohort

#### Battle analytics

| Dashboard | Visualizations | Key metrics |
|---|---|---|
| Match Health | line chart, abandonment bar, queue time trend | match completion, abandon rate, median matchmaking time |
| Fairness | scatter plot, histogram | Elo gap, upset rate, bot win rate, response-time fairness |
| Engagement | trend line, leaderboard table | repeat battle rate, sessions per user, rematch rate, chat usage |
| Bot Tuning | comparison table, win-rate chart | bot difficulty bands, answer speed realism, weak/strong bot content clusters |

#### Search analytics

| Dashboard | Visualizations | Key metrics |
|---|---|---|
| Search Demand | line chart, ranking table | top queries, trend changes, seasonal topics |
| Search Quality | stacked bar, zero-result table | search success rate, zero-result rate, no-click rate, CTR |
| Query Intent | grouped bars | locale split, dictionary vs grammar vs kanji intent, typo categories |
| Synonym / Relevance Gaps | table with actions | missing synonyms, poor ranking cases, failed prefixes, failed transliteration |

#### Support / User 360 analytics

This area must be strictly permissioned. It should be available only to authorized roles such as `support.user`, `admin.super`, or a dedicated analytics support role.

Recommended sections:

- profile summary with avatar, locale, BJT goal, membership tier, signup source
- learning summary: streak, study time, reviews, quizzes, battles, missions
- weakness summary: weak skills, leech cards, failed sections, stalled decks
- recent activity timeline
- device and session history
- support notes and tagged incidents
- risk markers: churn risk, frustration risk, comeback probability
- audit panel for every manual intervention

#### Platform ops analytics

| Dashboard | Visualizations | Key metrics |
|---|---|---|
| API Health | timeseries, p95/p99 tables | request volume, latency, error rate |
| Worker / Queue Health | lag chart, failure table | queue depth, retry count, dead-letter jobs |
| Search Sync | line chart, status cards | Meilisearch sync lag, failed projections, reindex duration |
| Data Freshness | freshness table | rollup freshness, ETL freshness, content publish propagation time |

### 14.10.2 Visualization standards for admin analytics

Admin analytics should follow a consistent visualization system so that all dashboards feel professional and trustworthy.

#### Chart types by data shape

| Data shape | Recommended chart |
|---|---|
| KPI current value + change | scorecard with delta and sparkline |
| Trend over time | line chart |
| category comparison | horizontal bar chart |
| distribution | histogram or box plot |
| composition | stacked bar or donut (sparingly) |
| cohort behavior | heatmap |
| funnel | step funnel chart |
| relationships or outliers | scatter plot |
| ranked operational list | sortable table with sparkline |

#### Visualization rules

- Always show absolute value and percent change.
- Always support compare-to-previous-period.
- Use clear legends and direct labels where possible.
- Default charts to the most useful granularity: daily for 30 days, weekly for 90 days, monthly for 12 months.
- Never overload one chart with too many series.
- For tables, include search, sort, filter, export, and pinned columns.
- For drill-down, preserve the filter context when navigating deeper.
- Show loading skeletons and empty states that explain why no data appears.
- Every chart must have a tooltip with metric definition.
- Every metric must have a glossary entry in the admin help panel.

### 14.10.3 Admin analytics filters, drill-downs, and exports

Global filters must support:

- time range: today, yesterday, 7d, 30d, 90d, 12m, custom
- locale: `vi`, `ja`, future languages
- user segment: new, returning, power users, at-risk users, dormant users
- target BJT level
- content type
- learner type / study personality
- device type
- acquisition source (if collected)

Drill-down flow examples:

- zero-result query → search session list → affected users (authorized) → create synonym/content fix task
- low-accuracy question → distractor table → wrong answer breakdown → linked content → publish fix
- churn spike cohort → activation funnel by cohort → common weak skill cluster → recommended intervention
- high overdue burden → segment by learner type → identify overloaded decks → adjust defaults or recommendations

Exports:

- CSV export for aggregate tables
- PNG export for visible chart cards
- scheduled email/PDF weekly summary for admin roles
- create task from dashboard insight (future integration with project management)

### 14.10.4 Admin analytics RBAC and privacy

| Role | Access |
|---|---|
| `viewer.analytics` | aggregate dashboards only |
| `admin.content` | aggregate dashboards + content drill-down |
| `support.user` | aggregate dashboards + authorized user 360 |
| `admin.super` | all dashboards and drill-down |
| `iam.manage` | no analytics content by default unless combined with analytics role |

Privacy requirements:

- aggregate view by default
- user-level drill-down only when operationally needed
- require audit reason for opening User 360 or exporting sensitive data
- hide personally sensitive fields by default
- data retention rules must be configurable per event type

### 14.10.5 Additional admin analytics APIs

Add dedicated admin analytics APIs so the frontend can stay modular and not depend on one huge endpoint.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/admin/analytics/executive` | KPI cards and top-level trends |
| GET | `/admin/analytics/growth` | acquisition, activation, retention, resurrection |
| GET | `/admin/analytics/learning-health` | study activity, mastery, streaks, comeback |
| GET | `/admin/analytics/content-quality` | content engagement and quality score |
| GET | `/admin/analytics/flashcards` | SRS health, deck performance, image-card impact |
| GET | `/admin/analytics/bjt` | exam usage and psychometric diagnostics |
| GET | `/admin/analytics/battle` | matchmaking, fairness, bot tuning |
| GET | `/admin/analytics/search` | top queries, zero-result, no-click, synonym gaps |
| GET | `/admin/analytics/system` | ops and freshness metrics |
| GET | `/admin/analytics/users/:userId/360` | authorized support drill-down |
| GET | `/admin/analytics/export` | export aggregate datasets |

### 14.10.6 Cursor implementation requirements for admin analytics

Cursor must implement admin analytics as a first-class subsystem, not as a placeholder. Minimum deliverables:

- dedicated admin route tree: `/admin/analytics/executive`, `/admin/analytics/growth`, `/admin/analytics/learning`, `/admin/analytics/content`, `/admin/analytics/flashcards`, `/admin/analytics/bjt`, `/admin/analytics/battle`, `/admin/analytics/search`, `/admin/analytics/system`
- reusable analytics UI components: KPI cards, filter bar, chart card, insight card, anomaly banner, sortable analytics table, cohort heatmap, funnel, radar, histogram, scatter plot
- role-aware drill-down and audit logging
- data freshness indicator in the header of each dashboard
- chart export and CSV export for supported datasets
- empty-state recommendations such as “No data yet because the feature is still in beta” or “Try widening the date range”
- responsive layout that still works on smaller admin laptop screens


### 14.10.7 Admin dashboard UI/UX blueprint

The admin area must feel like a premium professional operations console, not a simple CRUD panel. Its design goal is to help administrators quickly understand product health, detect problems, and take corrective action without feeling overwhelmed.

#### Admin design principles

| Principle | Meaning | UI implementation |
|---|---|---|
| Executive clarity | Admins must understand the situation in 5 seconds | KPI cards, anomaly banners, concise trend labels |
| Analytical depth | Power users can drill into the cause | linked drill-down, saved filters, sortable tables |
| Operational actionability | Every insight should lead to an action | “Create fix task”, “Open content”, “Retry job”, “Export” |
| Trust and auditability | Data must feel reliable | freshness timestamp, metric definitions, audit trail |
| Low cognitive load | Avoid dashboard chaos | consistent grids, progressive disclosure, grouped filters |
| Role-aware visibility | Admins see only what they are allowed to see | RBAC-controlled widgets, redacted user data |
| Calm premium aesthetic | Serious but not cold | warm neutral background, indigo accents, soft surfaces |

#### Admin shell layout

Recommended desktop layout:

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top bar: workspace switcher | global search | alerts | help | admin avatar   │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ Sidebar       │ Page header: title, subtitle, breadcrumbs, primary action    │
│               ├──────────────────────────────────────────────────────────────┤
│ Overview      │ Global filter bar: date range, locale, segment, BJT level    │
│ Content       ├──────────────────────────────────────────────────────────────┤
│ Learning      │ Alert / insight strip                                        │
│ Assessment    ├──────────────────────────────────────────────────────────────┤
│ Battle        │ KPI row                                                      │
│ Search        ├──────────────────────────────────────────────────────────────┤
│ Media         │ Main grid: charts, tables, drill-down panels                 │
│ Users         ├──────────────────────────────────────────────────────────────┤
│ Analytics     │ Right rail: definitions, saved views, recent actions         │
│ Operations    │                                                              │
│ IAM / Audit   │                                                              │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

Mobile/tablet admin layout does not need feature parity with desktop, but it must support monitoring, approvals, and urgent operations. Complex chart authoring and deep analysis can be desktop-first.

#### Admin navigation model

| Navigation group | Items |
|---|---|
| Overview | Dashboard, Alerts, Weekly Digest |
| Content | Dictionary, Kanji, Grammar, Examples, BJT Content, Content Quality |
| Learning | Study Analytics, Flashcards, Missions, Achievements, Mistake Trends |
| Assessment | Quiz Builder, BJT Exams, Question Diagnostics, Blueprint Coverage |
| Battle | Battle Config, Match Analytics, Bot Tuning, Leaderboards |
| Search | Query Analytics, Zero-result Queries, Synonym Gaps, Meilisearch Sync |
| Media | Media Library, Image Candidates, Upload Moderation, License Review |
| Users | User Management, User 360, Support Notes, Segments |
| Analytics | Executive, Growth, Learning, Content, Flashcards, BJT, Battle, Search, Learning Paths, System |
| Operations | Import Center, Workers, Queues, Jobs, Reindex, Data Freshness, Feature Flags, Dead Letter Queue, Content Versions |
| Governance | IAM, Roles, Audit Logs, Privacy Requests, System Settings |

#### Visual hierarchy for analytics pages

Each analytics page must follow this structure:

1. **Header**: page title, business question, last updated time.
2. **Global filters**: date, locale, segment, BJT level, device, content type.
3. **Insight strip**: 1–3 high-priority findings with severity and action.
4. **KPI row**: 4–6 cards max, each with current value, delta, sparkline.
5. **Primary chart area**: the most important chart for the page.
6. **Secondary analysis grid**: supporting charts and diagnostic tables.
7. **Action table**: ranked items that need admin action.
8. **Right rail / drawer**: metric definitions, saved views, export, audit info.

#### Component library for admin analytics

Cursor must create reusable components under `apps/admin/src/components/analytics`.

| Component | Purpose | Required props |
|---|---|---|
| `AnalyticsPageShell` | consistent admin analytics layout | title, description, filters, actions, children |
| `AnalyticsFilterBar` | global filters | dateRange, locale, segment, bjtLevel, device, contentType |
| `KpiCard` | top metric card | label, value, delta, trend, status, tooltip |
| `InsightCard` | actionable finding | severity, title, message, actionLabel, href |
| `ChartCard` | standard chart wrapper | title, description, metricDefinition, freshness, children |
| `LineTrendChart` | timeseries | data, xKey, yKeys, comparePeriod |
| `StackedBarChart` | activity mix | data, segments |
| `CohortHeatmap` | retention / cohort | cohortRows, periods, values |
| `FunnelChart` | conversion funnel | steps, conversionRates |
| `RadarSkillChart` | skill distribution | skillScores |
| `HistogramChart` | score / time distribution | buckets |
| `ScatterDiagnosticChart` | difficulty vs discrimination | points, xMetric, yMetric |
| `AnalyticsDataTable` | ranked data | columns, data, exportable, drilldownHref |
| `FreshnessBadge` | data freshness | updatedAt, status |
| `MetricGlossaryDrawer` | metric definitions | metricIds |
| `AuditReasonDialog` | protected drill-down | action, target, reason |

Use `recharts` or an equivalent React charting layer, but wrap it behind these components so the chart library can be replaced later.

#### Executive dashboard layout

```txt
Executive Overview
├─ Filter bar
├─ Insight strip
│  ├─ “D7 retention increased 4.2% vs previous cohort”
│  ├─ “Search zero-result rate is high for Vietnamese queries”
│  └─ “Battle abandon rate increased in J2 segment”
├─ KPI row
│  ├─ DAU
│  ├─ WAU
│  ├─ Review completions
│  ├─ Quiz completions
│  ├─ D7 retention
│  └─ Search success rate
├─ Main grid
│  ├─ DAU/WAU/MAU line chart
│  ├─ Activity mix stacked bar
│  ├─ Retention cohort heatmap
│  └─ Active learner segment donut/bar
└─ Action table
   ├─ top anomalies
   ├─ owner
   ├─ severity
   └─ recommended action
```

#### Growth dashboard layout

```txt
Growth Analytics
├─ KPI row: signups, activation rate, D7 retention, resurrection rate, churn risk
├─ Funnel: signup → onboarding → first search → first card → first review → first quiz → D7 return
├─ Cohort heatmap: weekly signup cohort × retention day
├─ Segment table: locale / device / target BJT level / learner type
└─ Drop-off diagnosis table: step, drop %, top suspected cause, action
```

#### Learning dashboard layout

```txt
Learning Health
├─ KPI row: active learners, avg study minutes, review completion, streak health
├─ Study trend line: sessions/minutes/reviews over time
├─ Skill mastery radar: vocabulary, kanji, grammar, reading, listening, keigo, business expression
├─ Habit panel: streak distribution + comeback success
├─ Mistake Pareto: top repeated mistake categories
└─ At-risk segment table: segment, risk reason, recommended intervention
```

#### Content quality dashboard layout

```txt
Content Quality
├─ KPI row: content quality score, flagged items, missing media %, stale content %
├─ Scatter: engagement vs accuracy
├─ Table: low-quality content candidates
├─ Table: zero-engagement dictionary/grammar/kanji entries
├─ Coverage heatmap: BJT skill × level × content type
└─ Action drawer: open editor, create enrichment job, assign reviewer
```

#### Flashcard dashboard layout

```txt
Flashcard Analytics
├─ KPI row: review completion, overdue burden, lapse rate, image-card uplift
├─ SRS burden chart: due/new/review/overdue trend
├─ Template performance table: recognition/production/listening/reading/image/context
├─ Image impact chart: with image vs without image accuracy and response speed
├─ Deck health table: active, abandoned, completed, cloned preset decks
└─ Leech card queue: repeated failures and suggested fixes
```

#### BJT assessment dashboard layout

```txt
BJT Analytics
├─ KPI row: attempts, completion, estimated score median, section weakness
├─ Score distribution histogram
├─ Section heatmap: listening/listening-reading/reading × level/segment
├─ Question diagnostics scatter: difficulty index × discrimination proxy
├─ Distractor effectiveness table
├─ Blueprint coverage matrix
└─ Action panel: revise question, add explanation, generate remediation deck
```

#### Battle dashboard layout

```txt
Battle Analytics
├─ KPI row: matches, completion rate, abandon rate, median match time, bot win rate
├─ Matchmaking queue trend
├─ Elo gap vs match outcome scatter
├─ Bot difficulty win-rate table
├─ Abandon diagnosis by round/question type
└─ Fairness recommendations
```

#### Search dashboard layout

```txt
Search Analytics
├─ KPI row: search volume, success rate, zero-result rate, no-click rate
├─ Query volume trend
├─ Top queries table
├─ Zero-result query table
├─ Synonym/relevance gap candidates
├─ Locale split chart
└─ Action buttons: add synonym, create content, tune ranking, reindex
```

#### User 360 layout

User 360 is not a normal analytics dashboard. It is a support and coaching diagnostic screen and must require permission and audit reason.

```txt
User 360
├─ Header: avatar, display name, locale, target level, signup date, risk status
├─ Summary cards: streak, study time, reviews, quizzes, battles, current level
├─ Timeline: recent sessions, reviews, quizzes, searches, battles, support events
├─ Weakness panel: skills, leech cards, stalled decks, mistake clusters
├─ Recommendations: suggested action, message template, support note
├─ Privacy/audit panel: who opened this profile, reason, timestamp
└─ Safe actions: reset deck, resend onboarding, add support note, export user data if allowed
```

#### Admin UI microcopy style

Admin microcopy must be calm, clear, and action-oriented.

| Situation | Good copy |
|---|---|
| Data loading | “Đang tổng hợp dữ liệu mới nhất…” |
| Empty state | “Chưa có dữ liệu trong khoảng thời gian này. Hãy mở rộng bộ lọc hoặc kiểm tra trạng thái rollup.” |
| Freshness warning | “Dữ liệu chậm 18 phút do queue analytics đang xử lý.” |
| Action insight | “24 truy vấn không có kết quả trong 7 ngày qua. Nên thêm synonym hoặc content mới.” |
| Protected drilldown | “Vui lòng nhập lý do để mở dữ liệu cấp người dùng. Hành động này sẽ được ghi audit.” |

#### Admin visual design tokens

```ts
export const adminDesignTokens = {
  colors: {
    background: '#F8F6F1',
    surface: '#FFFFFF',
    surfaceSubtle: '#F1EEE7',
    ink: '#1F2937',
    muted: '#6B7280',
    border: '#E5E0D8',
    indigo: '#2E3A8C',
    sakura: '#E9A6B2',
    matcha: '#6B8F71',
    amber: '#D99A2B',
    danger: '#B42318',
    success: '#027A48',
    info: '#2563EB'
  },
  radius: {
    card: '1rem',
    panel: '1.25rem',
    button: '0.75rem'
  },
  shadow: {
    card: '0 8px 30px rgba(31, 41, 55, 0.06)',
    popover: '0 18px 60px rgba(31, 41, 55, 0.16)'
  }
};
```

#### Cursor UI implementation rules

- Use a consistent 12-column desktop grid.
- Use one main chart per page above the fold.
- Place insight cards above charts, not hidden below tables.
- Do not put more than 6 KPI cards in one row.
- Do not use random colors for charts; use semantic tokenized colors.
- Use tables for action-heavy data, charts for patterns.
- Every chart must include tooltip, metric definition, and empty/loading state.
- Every protected user-level drill-down must open `AuditReasonDialog` first.
- Every admin page must support deep links with filters encoded in URL query params.

### 14.10.8 Analytics event tracking specification

Analytics must be implemented as a product subsystem from the beginning. Do not rely only on backend table counts, because learning analytics requires behavioral events, timing, session context, and UI interactions.

#### Event tracking principles

| Principle | Requirement |
|---|---|
| Canonical event contract | All events follow one base schema |
| Privacy by design | Do not store raw unnecessary PII in analytics payloads |
| Idempotency | Events include `eventId` and can be deduplicated |
| Session awareness | Events include anonymous/session/user context where available |
| Feature ownership | Each module owns its event names and payload validation |
| Rollup-friendly | Payloads include IDs and dimensions needed for aggregation |
| Debuggable | Every event can be traced to requestId / traceId when available |

#### Base event schema

```ts
export type AnalyticsEventBase = {
  eventId: string;              // uuid generated client or server side
  eventName: string;            // snake_case, stable contract
  eventVersion: number;         // increment only on breaking payload change
  occurredAt: string;           // ISO timestamp from client or server
  receivedAt?: string;          // server timestamp
  userId?: string;              // nullable for public search/anonymous usage
  anonymousId?: string;         // cookie/device scoped id
  sessionId?: string;           // app session id
  requestId?: string;
  traceId?: string;
  locale: 'vi' | 'ja' | 'en' | string;
  uiLanguage: 'vi' | 'ja' | 'en' | string;
  explanationLanguage?: 'vi' | 'ja' | 'en' | string;
  timezone?: string;
  deviceType?: 'desktop' | 'tablet' | 'mobile' | 'unknown';
  appSurface: 'learner_web' | 'admin_web' | 'api' | 'worker' | 'battle_ws';
  route?: string;
  referrer?: string;
  sourceModule: string;
  payload: Record<string, unknown>;
};
```

#### PostgreSQL analytics event table

Create a partitioned event table. Keep raw event payload for replay/debug, but roll up into dedicated aggregate tables for dashboards.

```sql
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE analytics.event_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  event_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  event_version SMALLINT NOT NULL DEFAULT 1,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NULL,
  anonymous_id TEXT NULL,
  session_id TEXT NULL,
  request_id TEXT NULL,
  trace_id TEXT NULL,
  locale TEXT NOT NULL,
  ui_language TEXT NOT NULL,
  timezone TEXT NULL,
  device_type TEXT NULL,
  app_surface TEXT NOT NULL,
  route TEXT NULL,
  source_module TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, occurred_at),
  UNIQUE (event_id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_event_log_name_time ON analytics.event_log (event_name, occurred_at DESC);
CREATE INDEX idx_event_log_user_time ON analytics.event_log (user_id, occurred_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_event_log_payload_gin ON analytics.event_log USING GIN (payload);
```

Recommended partitioning:

- monthly partitions for normal scale
- weekly partitions if write volume grows substantially
- retain raw events according to privacy policy, for example 12–24 months
- keep aggregate rollups longer because they are less sensitive

#### Core learner events

| Event name | Fired when | Required payload |
|---|---|---|
| `user_registered` | account created | method, locale, targetBjtLevel |
| `profile_synced` | first JWT sync or profile refresh | hasAvatar, targetBjtLevel, uiLanguage |
| `onboarding_started` | onboarding begins | entryPoint |
| `onboarding_completed` | onboarding completed | targetBjtLevel, dailyGoal, selectedLearningPersonality |
| `language_changed` | UI/explanation language changed | previousLanguage, newLanguage, scope |
| `dashboard_viewed` | learner dashboard opened | activePlanId, streakCount |
| `daily_mission_viewed` | mission panel viewed | missionCount, completedCount |
| `daily_mission_completed` | mission completed | missionId, missionType, rewardType |
| `achievement_unlocked` | achievement unlocked | achievementId, category, rarity |
| `streak_updated` | streak changes | previousStreak, newStreak, reason |
| `comeback_mode_started` | dormant user returns | dormantDays, suggestedPlanId |
| `comeback_mode_completed` | comeback plan completed | dormantDays, completionRate |

#### Dictionary / content discovery events

| Event name | Fired when | Required payload |
|---|---|---|
| `search_performed` | any search submitted | query, normalizedQuery, searchType, resultCount, filters |
| `search_result_clicked` | user clicks search result | query, resultId, resultType, rank, resultScore |
| `search_zero_result` | search returns no result | query, normalizedQuery, searchType, locale |
| `dictionary_entry_viewed` | word detail viewed | entryId, source, rankFromSearch |
| `kanji_viewed` | kanji detail viewed | kanjiId, literal, source |
| `grammar_viewed` | grammar detail viewed | grammarPointId, levelCode, source |
| `example_viewed` | example detail viewed | exampleId, source |
| `content_bookmarked` | bookmark toggled on | contentType, contentId |
| `content_unbookmarked` | bookmark toggled off | contentType, contentId |
| `content_reported` | user reports issue | contentType, contentId, reasonCode |
| `add_to_deck_clicked` | add-to-deck action started | contentType, contentId, suggestedCardType |

Do not store full raw search query in long-retention aggregate tables if privacy policy later restricts it. Raw event retention and query anonymization must be configurable.

#### Flashcard and SRS events

| Event name | Fired when | Required payload |
|---|---|---|
| `deck_created` | user creates deck | deckId, deckType, isPresetClone |
| `preset_deck_cloned` | user clones preset deck | presetDeckId, targetLevel, cardCount |
| `card_created` | card created | cardId, deckId, sourceType, sourceId, cardTemplate |
| `card_image_added` | image attached to card | cardId, imageSource, provider, licenseKnown |
| `card_image_candidate_viewed` | candidate image grid opened | cardId, keyword, provider, candidateCount |
| `card_image_candidate_selected` | user selects image | cardId, candidateId, provider, rank |
| `review_queue_opened` | user opens review | deckId, dueCount, newCount, reviewCount |
| `card_reviewed` | review submitted | cardId, deckId, rating, responseMs, previousState, nextState, intervalDays |
| `card_lapsed` | card enters lapsed state | cardId, lapseCount, sourceType, skillTags |
| `leech_card_detected` | card becomes leech | cardId, lapseCount, suggestedAction |
| `review_session_completed` | review session ended | deckId, reviewedCount, correctRate, durationSec |

#### Study session events

| Event name | Fired when | Required payload |
|---|---|---|
| `study_session_started` | study starts | sessionId, mode, deckId, goalCount |
| `study_session_paused` | user pauses | sessionId, elapsedSec, reason |
| `study_session_resumed` | user resumes | sessionId, pausedSec |
| `study_session_completed` | session ends | sessionId, mode, durationSec, itemCount, accuracy |
| `focus_sprint_started` | focus sprint starts | sprintDurationMin, goalType |
| `focus_sprint_completed` | focus sprint completes | sprintDurationMin, completedItems, success |
| `mistake_notebook_viewed` | mistake notebook opened | unresolvedCount, categoryFilter |
| `mistake_resolved` | user resolves mistake | mistakeId, sourceType, resolutionType |

#### Quiz and BJT assessment events

| Event name | Fired when | Required payload |
|---|---|---|
| `quiz_template_viewed` | template viewed | templateId, templateType, estimatedDuration |
| `quiz_started` | quiz starts | attemptId, templateId, mode, sectionCount |
| `quiz_question_viewed` | question shown | attemptId, questionId, sectionType, questionType, position |
| `quiz_answer_submitted` | answer submitted | attemptId, questionId, selectedOptionIds, isCorrect, responseMs |
| `quiz_question_skipped` | question skipped | attemptId, questionId, elapsedMs |
| `quiz_abandoned` | attempt abandoned | attemptId, elapsedSec, answeredCount, reason |
| `quiz_completed` | attempt completed | attemptId, durationSec, rawScore, estimatedScore, estimatedBand |
| `quiz_result_viewed` | result page viewed | attemptId, estimatedBand, weakestSection |
| `remediation_deck_generated` | wrong answers generate deck | attemptId, deckId, cardCount, weakSkillTags |

#### Battle events

| Event name | Fired when | Required payload |
|---|---|---|
| `battle_lobby_joined` | socket joins lobby | onlineCount, userElo |
| `battle_matchmaking_started` | search begins | mode, targetLevel, userElo |
| `battle_matchmaking_cancelled` | search cancelled | elapsedSec |
| `battle_match_found` | match found | roomCode, opponentType, eloGap, configId |
| `battle_room_joined` | room joined | roomCode, playerCount, reconnect |
| `battle_ready` | player ready | roomCode |
| `battle_question_started` | round starts | roomCode, roundNo, questionId, timeLimitMs |
| `battle_answer_submitted` | answer submitted | roomCode, roundNo, questionId, isCorrect, responseMs |
| `battle_round_completed` | round completed | roomCode, roundNo, winnerUserId, scoreDelta |
| `battle_completed` | match completed | roomCode, result, eloBefore, eloAfter, durationSec |
| `battle_abandoned` | player abandons | roomCode, roundNo, reason |
| `battle_chat_sent` | lobby or room chat | roomCode, messageLength, rateLimited |

#### Admin events

| Event name | Fired when | Required payload |
|---|---|---|
| `admin_login` | admin enters admin app | roleCount, roles |
| `admin_dashboard_viewed` | admin dashboard opened | dashboardName, filters |
| `admin_filter_changed` | analytics filter changed | dashboardName, filterKey, filterValueSummary |
| `admin_export_requested` | export requested | dashboardName, exportType, rowCountEstimate |
| `admin_drilldown_requested` | drill-down clicked | dashboardName, targetType, targetId |
| `admin_user360_opened` | User 360 opened | targetUserId, reasonProvided |
| `admin_content_created` | content created | contentType, contentId |
| `admin_content_updated` | content updated | contentType, contentId, changedFields |
| `admin_content_published` | content published | contentType, contentId, version |
| `admin_enrichment_approved` | enrichment approved | suggestionId, entityType, confidence |
| `admin_import_started` | import started | sourceCode, fileCount, dryRun |
| `admin_import_completed` | import completed | importJobId, successCount, errorCount |
| `admin_role_changed` | IAM role changed | targetUserId, addedRoles, removedRoles |

Admin events must also write to `ops.audit_log` when they represent administrative action. Analytics events explain behavior; audit logs prove governance.

#### System / worker events

| Event name | Fired when | Required payload |
|---|---|---|
| `worker_job_started` | worker job starts | queueName, jobName, jobId |
| `worker_job_completed` | worker job succeeds | queueName, jobName, jobId, durationMs |
| `worker_job_failed` | worker job fails | queueName, jobName, jobId, errorClass, retryCount |
| `search_projection_synced` | Meili document synced | indexName, documentCount, durationMs |
| `search_reindex_completed` | reindex completes | indexName, documentCount, durationMs, swapped |
| `analytics_rollup_completed` | rollup completes | rollupName, periodStart, periodEnd, rowCount, durationMs |
| `analytics_rollup_failed` | rollup fails | rollupName, periodStart, periodEnd, errorClass |

#### Event ingestion API

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/analytics/events` | optional JWT | ingest learner/admin client events |
| POST | `/analytics/events/batch` | optional JWT | ingest batched browser events |
| POST | `/internal/analytics/events` | service auth | ingest server/worker events |

Rules:

- Client should batch events and flush every 5–10 seconds or on page unload.
- Server must validate event names and payload schema.
- Unknown event names are rejected in production.
- Event ingestion must never block core user actions.
- Failed event ingestion should be retried client-side with small bounded buffer.

#### Event naming rules

- Use snake_case.
- Use past tense for completed actions: `quiz_completed`, `card_reviewed`.
- Use nouns consistently: `dictionary_entry_viewed`, not `word_opened` in one place and `entry_viewed` elsewhere.
- Never rename events casually; introduce a new version when payload changes.
- Keep event names product-semantic, not UI-button-specific.

#### Rollup tables

```sql
CREATE TABLE analytics.daily_product_metric (
  metric_date DATE NOT NULL,
  locale TEXT NOT NULL DEFAULT 'all',
  segment_key TEXT NOT NULL DEFAULT 'all',
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_date, locale, segment_key, metric_name)
);

CREATE TABLE analytics.daily_user_learning_metric (
  metric_date DATE NOT NULL,
  user_id UUID NOT NULL,
  study_minutes NUMERIC NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  quiz_count INTEGER NOT NULL DEFAULT 0,
  battle_count INTEGER NOT NULL DEFAULT 0,
  correct_rate NUMERIC(5,4),
  streak_count INTEGER NOT NULL DEFAULT 0,
  mastered_count INTEGER NOT NULL DEFAULT 0,
  lapsed_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_date, user_id)
);

CREATE TABLE analytics.content_performance_daily (
  metric_date DATE NOT NULL,
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  bookmark_count INTEGER NOT NULL DEFAULT 0,
  add_to_deck_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  correct_rate NUMERIC(5,4),
  avg_response_ms INTEGER,
  quality_score NUMERIC(8,4),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_date, content_type, content_id)
);

CREATE TABLE analytics.search_query_daily (
  metric_date DATE NOT NULL,
  normalized_query TEXT NOT NULL,
  locale TEXT NOT NULL,
  search_type TEXT NOT NULL,
  search_count INTEGER NOT NULL DEFAULT 0,
  result_click_count INTEGER NOT NULL DEFAULT 0,
  zero_result_count INTEGER NOT NULL DEFAULT 0,
  no_click_count INTEGER NOT NULL DEFAULT 0,
  avg_result_count NUMERIC(10,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_date, normalized_query, locale, search_type)
);

CREATE TABLE analytics.question_performance_daily (
  metric_date DATE NOT NULL,
  question_id UUID NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  skip_count INTEGER NOT NULL DEFAULT 0,
  avg_response_ms INTEGER,
  difficulty_index NUMERIC(5,4),
  discrimination_proxy NUMERIC(5,4),
  distractor_stats JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_date, question_id)
);
```

#### Rollup job specification

| Job | Frequency | Reads | Writes |
|---|---:|---|---|
| `rollup-product-metrics` | hourly + daily final | event_log | daily_product_metric |
| `rollup-user-learning` | hourly + daily final | review/study/quiz events | daily_user_learning_metric |
| `rollup-content-performance` | daily | content/search/review events | content_performance_daily |
| `rollup-search-quality` | hourly | search events | search_query_daily |
| `rollup-question-performance` | daily | quiz events | question_performance_daily |
| `rollup-retention-cohorts` | daily | registration/session events | cohort tables or daily_product_metric |
| `rollup-battle-balance` | hourly | battle events | battle metrics rollup |
| `detect-anomalies` | hourly | rollup tables | insight table |

#### Insight generation table

```sql
CREATE TABLE analytics.insight (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metric_name TEXT,
  metric_value NUMERIC,
  comparison_value NUMERIC,
  recommended_action TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
```

Examples:

- zero-result query spike
- low-accuracy question spike
- battle abandon rate spike
- overdue burden risk
- content report spike
- analytics rollup delay
- search sync delay

#### Frontend tracking helper

Cursor must create a typed tracking helper in a shared package:

```ts
export function trackEvent<TPayload extends Record<string, unknown>>(
  eventName: AnalyticsEventName,
  payload: TPayload,
  options?: { immediate?: boolean; sourceModule?: string }
): void;
```

Requirements:

- typed event names
- typed payloads where practical
- automatic sessionId / anonymousId / route / locale injection
- batching
- bounded retry queue
- no crash if analytics endpoint is down
- disabled in tests unless explicitly enabled

#### Backend tracking helper

```ts
export interface AnalyticsTracker {
  track(event: AnalyticsEventBase): Promise<void>;
  trackServerEvent(name: string, payload: Record<string, unknown>, context: ServerTrackingContext): Promise<void>;
}
```

Use it in:

- auth/profile module
- dictionary/search module
- flashcard/review module
- quiz module
- battle gateway
- admin module
- import/enrichment workers
- search projector

#### Analytics data quality requirements

- Event ingestion must deduplicate by `eventId`.
- Rollup jobs must be idempotent for a date range.
- Rollup jobs must support backfill.
- Dashboards must show data freshness.
- Admin must see rollup failure warnings.
- Tracking tests must validate representative events.
- Analytics must not store passwords, raw JWTs, raw email content, or private user notes in payload.

#### Cursor implementation checklist for analytics tracking

- Create `analytics` NestJS module.
- Create event DTOs and validation.
- Create `analytics.event_log` partitioned table migration.
- Create rollup tables and insight table migrations.
- Create client tracking package.
- Track core learner events.
- Track core admin events.
- Track search, review, quiz, battle, image-card events.
- Implement rollup jobs with BullMQ.
- Implement admin analytics APIs from rollup tables.
- Add integration tests for event ingestion and rollup idempotency.


---

## 15. Background jobs

| Queue | Job | Purpose |
|---|---|---|
| `import` | `profile-json` | Discover raw schema |
| `import` | `canonical-import` | Normalize/upsert content |
| `search` | `project-document` | Sync Meilisearch document |
| `search` | `reindex-all` | Blue/green rebuild |
| `enrichment` | `generate-candidates` | Auto-fill suggestions |
| `news` | `sync-nhk-rss` | Fetch/cache NHK articles |
| `news` | `analyze-article` | Extract vocab/kanji/grammar |
| `flashcard` | `generate-remediation` | Exam wrong answer → cards |
| `analytics` | `rollup-daily-metrics` | Daily dashboard metrics |
| `analytics` | `rollup-skill-mastery` | Skill radar and weak skills |
| `analytics` | `rollup-content-performance` | Hard cards/questions and quality flags |
| `analytics` | `rollup-search-metrics` | Search query, zero-result, CTR metrics |
| `analytics` | `rollup-retention-cohorts` | D1/D7/D30 cohort retention |
| `analytics` | `rollup-battle-balance` | Match fairness, abandon rate, bot tuning |
| `curriculum` | `update-competency-records` | Aggregate mastery from SRS/quiz into competency scores |
| `curriculum` | `generate-remediation-path` | Auto-generate remediation paths from weakness data |
| `curriculum` | `refresh-path-recommendations` | Update personalized path recommendations |
| `battle` | `expire-stale-matches` | Cleanup stale rooms |

---

## 16. Docker Compose services

Cursor must create `docker-compose.yml` with:

- `postgres:16`
- `pgbouncer` (edoburu/pgbouncer)
- `redis:7`
- `getmeili/meilisearch`
- `quay.io/keycloak/keycloak` or optional profile `auth`
- `minio/minio`
- API/web/admin dev commands or documented local commands

Required ports:

| Service | Port |
|---|---:|
| web | 3000 |
| api | 3001 |
| admin | 3002 |
| postgres | 5432 |
| pgbouncer | 6432 |
| redis | 6379 |
| meilisearch | 7700 |
| keycloak | 9080 |
| minio | 9000/9001 |

---

## 17. Security and validation

- Global validation pipe with whitelist/forbidNonWhitelisted/transform.
- Rate limiting:
  - Public search: 120/min/IP.
  - Auth/register: 10/min/IP.
  - Battle chat: 5 messages/10s/user.
  - Admin write: 60/min/user.
  - File upload: 10/min/user.
- HTML must be sanitized before rendering.
- SVG stroke order sanitized via DOMPurify.
- Never expose correct answer before submission.
- Admin writes require role and audit reason for high-risk actions.

### 17.1 Security headers and transport

- Helmet.js on ALL HTTP responses (see Section 30.4 for configuration).
- Content-Security-Policy: nonce-based `script-src`, restrict `frame-src` to `'none'`.
- HSTS: `max-age=31536000; includeSubDomains; preload`.
- Referrer-Policy: `strict-origin-when-cross-origin`.
- X-Content-Type-Options: `nosniff`.
- CORS: whitelist specific origins from env, never `*` in production.

### 17.2 Cookie and session security

- All cookies: `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict` for admin).
- CSRF token required for all state-changing requests when using cookie-based auth.
- Refresh token rotation: issue new refresh token on every use, invalidate old one.
- Admin session timeout: 30 minutes of inactivity → force re-authentication.
- Learner session: long-lived refresh (30 days) with short access token (15 min).

### 17.3 Authentication hardening

- Brute-force protection: lock account after 5 failed login attempts for 15 minutes.
- Progressive delay: add 1s delay per failed attempt.
- Passwordless/OAuth account linking: require email verification before linking new OAuth provider.
- Social login abuse protection: rate-limit new account creation per OAuth provider (10/hour/IP).

### 17.4 File upload security

- Validate MIME type server-side (do not trust `Content-Type` header).
- Restrict allowed types: `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`, `audio/mpeg`, `audio/wav`, `text/csv`.
- Max file size: 5MB for images, 20MB for audio, 50MB for CSV imports.
- SVG sanitization: strip embedded scripts, `onload`, foreign objects via DOMPurify.
- Anti-MIME-sniffing: `X-Content-Type-Options: nosniff`.
- Malware scanning MUST be implemented behind a `MalwareScanProvider` interface. MVP MAY use `LocalAllowScanProvider` (pass-through) only in development. Production MUST either configure ClamAV or a cloud scanning provider, or disable risky upload/import flows via the `file_upload.scan.enabled` kill switch.
- Store uploads with random UUID filenames, never user-supplied filenames.

### 17.5 SSRF protection

- External image/news URL fetching: validate against allowlist of domains.
- Block requests to private IP ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`.
- Timeout external requests: 5s max.
- Do not follow redirects to private IPs.

### 17.6 Secrets management

- Production secrets MUST NOT be stored in `.env` files, Git, or Docker images.
- Use cloud secret manager (AWS Secrets Manager, GCP Secret Manager, or Vault) in production.
- Dev environment: `.env` is acceptable but must be `.gitignore`-d.
- Rotate database passwords, API keys, and JWT signing keys on a schedule (90 days minimum).
- Admin audit log for any secret rotation event.

### 17.7 Security audit log

Separate from admin audit log. Track security-sensitive events:

| Event | Data logged |
|---|---|
| `auth.login_success` | userId, IP, user-agent, method (password/OAuth) |
| `auth.login_failed` | email (hashed), IP, user-agent, reason |
| `auth.account_locked` | userId, IP, lock duration |
| `auth.password_changed` | userId, IP |
| `auth.token_rotated` | userId, tokenType |
| `auth.session_expired` | userId, reason (timeout/forced) |
| `admin.role_changed` | targetUserId, oldRole, newRole, changedBy |
| `admin.user_disabled` | targetUserId, reason, changedBy |
| `privacy.data_export_requested` | userId |
| `privacy.account_deletion_requested` | userId |
| `security.rate_limit_triggered` | IP, endpoint, count |
| `security.csrf_violation` | IP, endpoint |
| `security.suspicious_upload` | userId, filename, reason |

Retention: 1 year minimum for security events.

- Use consistent response envelope:

```json
{
  "success": true,
  "data": {},
  "meta": { "traceId": "req_..." }
}
```

Error format:

```json
{
  "success": false,
  "error": {
    "type": "validation_error",
    "message": "Validation failed",
    "details": []
  },
  "meta": { "traceId": "req_..." }
}
```

---

## 18. Testing requirements

### Backend

- Unit tests for modules/services.
- Integration tests with test PostgreSQL container.
- Import profiler tests with small fixture JSON.
- SRS scheduler deterministic tests.
- Quiz scoring tests.
- Battle event/service tests.
- RBAC guard tests.

### Frontend

- Component tests for core components.
- Playwright e2e:
  - Search dictionary.
  - Review flashcard.
  - Start and finish quiz.
  - Battle with bot.
  - Admin login and edit content.
  - Import dry run.

### 18.1 API contract testing

- Generate `openapi.json` from NestJS decorators during build.
- CI must fail if OpenAPI generation fails or produces diff from committed spec.
- Contract tests validate API responses against OpenAPI schema.
- Use `@nestjs/swagger` decorators on ALL public and admin endpoints.
- Every DTO must be represented in Swagger with examples.
- Error response schema shared and documented.
- Auth requirements visible per endpoint (`@ApiBearerAuth()`).
- Admin endpoints document required permission (`@ApiOperation({ summary: '...', description: 'Requires: admin.content.write' })`).
- Provide API examples for: success, validation error, auth error, forbidden, rate limited.

### 18.2 Load and performance testing

- Use k6 or Artillery for load testing.
- Load test scenarios:
  - Dictionary search: 500 concurrent users, p95 < 200ms.
  - Flashcard review session: 200 concurrent users, p95 < 300ms.
  - Quiz submission: 100 concurrent users, p95 < 500ms.
  - Battle WebSocket: 50 concurrent rooms (100 users), message latency < 100ms.
  - Admin content list: 50 concurrent admins, p95 < 500ms.
  - CSV import (10K rows): single request, complete < 60s.
- Load test scripts stored in `tests/load/`.
- Run load tests in CI against staging (not blocking PR, but report results).

### 18.3 Security regression testing

- RBAC guard tests: verify every admin endpoint rejects unauthorized roles.
- Rate limit tests: verify throttling activates at configured thresholds.
- CSRF validation tests for cookie-based flows.
- File upload tests: verify rejection of disallowed MIME types and oversized files.
- SQL injection regression: parameterized query verification.
- XSS regression: verify DOMPurify sanitization on user-generated content.

### 18.4 Accessibility testing

- Integrate `axe-core` with Playwright for automated accessibility checks.
- Run on all learner-facing pages.
- Fail CI on critical accessibility violations (missing alt text, no keyboard focus, contrast ratio < 4.5:1).
- Manual accessibility checklist for new features.

### 18.5 Migration and rollback testing

- Migration dry-run test: apply all migrations to empty database, verify success.
- Rollback test: apply → rollback → re-apply for each migration.
- Large backfill stress test: simulate 100K row backfill, verify no timeout.
- Seed idempotency test: run seed twice, verify no duplicates or errors.

### 18.6 Billing and webhook testing

- Billing webhook idempotency: send same webhook event twice, verify single processing.
- Quota race-condition test: simulate concurrent quota consumption, verify no over-allocation.
- Entitlement grace period: simulate payment failure, verify grace period behavior.
- Subscription state machine: test all transitions (active → past_due → cancelled → reactivated).

### Acceptance test command

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:contract        # OpenAPI contract validation
pnpm test:e2e             # Playwright e2e + accessibility
pnpm test:load            # k6 load tests (staging only)
pnpm build
```

---

## 19. Implementation phases for Cursor

### Phase 1 — Repository foundation

- Create Turborepo.
- Configure TypeScript strict, ESLint, Prettier.
- Create apps/api, apps/web, apps/admin.
- Create packages/database/shared/ui/config.
- Docker Compose.
- Env examples.
- Basic README.

### Phase 2 — Database foundation

- PostgreSQL schemas/extensions.
- Prisma models for core content/user/learning/assessment/battle/ops/media/l10n.
- Raw migrations for trigram/partial indexes/partition parents.
- Seed BJT levels and demo data.

### Phase 3 — API foundation

- NestJS modules.
- Auth mock + Keycloak-ready JWT guard.
- Response interceptor, exception filter, validation pipe.
- Swagger docs.
- Health endpoint.

### Phase 4 — Content browsing/search

- Dictionary/Kanji/Grammar/Example/ViJa endpoints.
- Meilisearch projection workers.
- Unified search.
- Learner pages.

### Phase 5 — Flashcard/study/progress

- Decks/cards/review endpoints.
- Flashcard image upload/search/select workflow.
- SRS scheduler.
- Study sessions, streak, stats, heatmap.
- Learner UI.

### Phase 5.5 — Analytics, coaching, and Learning Path Engine

- Raw analytics event table and ingestion service.
- Daily/weekly rollup jobs.
- Learner analytics page: overview, progress, skill radar, BJT roadmap, mistake notebook.
- Smart coaching insights.
- Admin analytics dashboards: retention, content quality, search, BJT, battle, funnel, system health.
- Admin dashboard UI/UX blueprint implemented with reusable analytics components, chart standards, drill-downs, and protected User 360.
- Analytics event tracking implemented with typed client/server helpers, raw event log, rollups, insights, and admin APIs.
- Privacy-safe export/anonymization hooks.
- **Learning Path Engine**: curriculum schema, competency tables, path/stage/unit models.
- **Adaptive sequencer**: next-session algorithm, mastery calculation, prerequisite validation.
- **Path catalog and unit viewer**: learner UI for browsing, enrolling, and progressing through paths.
- **Competency radar**: powered by user_competency_record.
- **Admin path builder**: drag-and-drop stages/units, content linking, prerequisite graph editor.
- **Seed 3 default paths**: BJT J5, J4, J3 with stages, units, competency mappings.
- **Integration hooks**: SRS mastery feeds into unit mastery, quiz results update competencies, daily missions from current path.

### Phase 6 — Quiz/BJT exam

- Templates/sections/questions.
- Session engine.
- Scoring and estimated band.
- Remediation suggestions.
- Quiz UI + admin builder.

### Phase 7 — Battle realtime

- Socket.IO namespace.
- Lobby, chat, matchmaking, challenge, bot match.
- Room lifecycle and scoring.
- Leaderboard/Elo.
- Battle UI/admin.

### Phase 8 — Admin CMS/import/enrichment

- Admin dashboard.
- Users/content/presets/quiz/battle/import/enrichment/media/i18n/audit/IAM pages.
- Profiler + import jobs.
- Enrichment queue.

### Phase 9 — Product readiness and production infrastructure

- First-run onboarding and placement diagnosis.
- PWA shell and offline flashcard review queue.
- In-app notifications and notification preferences.
- Privacy settings, export request, deletion request skeleton.
- Content rights/provenance admin fields and review screens.
- Health endpoints, system dashboard, backup/restore documentation.
- **Production infrastructure hardening**:
  - Redis caching strategy with key design, TTL policy, invalidation patterns, cache warming.
  - Circuit breaker for external services (Meilisearch, Weather, Image, Keycloak, S3, Email).
  - PgBouncer connection pooling in Docker Compose.
  - Security headers: Helmet, CSP, CORS, HSTS.
  - Cursor-based pagination for large datasets.
  - Feature flag system with admin UI.
  - Content versioning with diff and rollback.
  - Email service abstraction with console dev provider.
  - CI/CD pipeline YAML template.
  - Structured logging with Pino and distributed trace correlation.
  - Dead letter queue with admin recovery UI.
  - CDN URL utility for static/media assets.
  - Zero-downtime migration strategy documented.

### Phase 10 — Polish/QA

- Responsive UI.
- Loading/skeleton/toast.
- Error states.
- Accessibility pass: keyboard, focus, contrast, reduced motion.
- E2E tests.
- Production README.

---

## 20. Definition of Done

A build is considered complete only when:

- `pnpm dev` runs API/web/admin.
- `docker compose up -d` starts PostgreSQL, Redis, Meili, Keycloak/MinIO.
- Database migrations run cleanly.
- Seed data creates usable demo content.
- User can search dictionary/kanji/grammar/vija.
- User can choose Vietnamese/Japanese UI language and change it in profile.
- User profile supports avatar upload/display and preferences.
- Learner analytics dashboard shows today overview, progress chart, skill radar, BJT roadmap, mistake notebook, and achievement timeline.
- Analytics rollup jobs run without blocking normal API requests.
- Admin analytics includes retention, content quality, search analytics, flashcard analytics, BJT analytics, battle analytics, funnel analytics, and system analytics.
- Admin analytics uses professional visual dashboard layouts, KPI cards, insight strips, cohort heatmaps, funnels, diagnostic scatter plots, and action tables.
- Analytics event tracking captures learner/admin/search/review/quiz/battle/media/system events and rollups are idempotent/backfillable.
- Analytics respects privacy: aggregate by default, user-level drill-down requires permission and audit reason.
- User can bookmark and review flashcards.
- Learning Path Engine works: user can browse paths, enroll, progress through units, see competency radar, and receive adaptive next-session recommendations.
- Admin can create/edit/publish learning paths with stages, units, prerequisites, and competency mappings.
- Adaptive sequencer generates personalized study sessions based on mastery, weakness, and time budget.
- Flashcards support images via upload and candidate-selection workflow.
- User can take a BJT quiz and see result/weak areas.
- User can battle a bot realtime.
- Admin can manage content, users, media, i18n, quiz, preset decks, battle config, imports, enrichment, audit.
- Meilisearch can be rebuilt from PostgreSQL.
- First-run onboarding creates a personalized initial plan.
- PWA install works and offline flashcard review queue syncs idempotently.
- In-app notification center and notification preferences exist.
- Privacy settings, export request, and account deletion request flows exist.
- Content/media provenance and rights status are visible in admin.
- Health endpoints and admin system health dashboard exist.
- Backup/restore procedure is documented.
- Core learner flows meet accessibility basics: keyboard navigation, focus states, contrast, reduced motion.
- Tests pass.
- README explains setup, migrations, seeds, backup/restore, and troubleshooting clearly.

---

## 21. Extra Cursor guardrails

When implementing, Cursor must avoid these mistakes:

- Do not create only mock UI with no backend connection.
- Do not hide missing backend logic behind TODO comments.
- Do not simplify PostgreSQL schema into one JSON table.
- Do not import all source JSON into memory.
- Do not show official BJT-equivalent score unless calibrated; label as estimate.
- Do not build admin with only one `admin` role; create expandable RBAC.
- Do not hard-code UI text; use i18n keys for learner/admin screens.
- Do not make flashcard images local-only in a way that blocks later S3/external provider integration.
- Do not skip audit logs for admin writes.
- Do not implement external images without provenance/license metadata.
- Do not make notifications impossible to disable.
- Do not collect user-level analytics drill-down without privacy/audit controls.
- Do not store battle state only in memory.
- Do not let Redis/Meili be required to recover canonical data.
- Do not skip learning path prerequisite validation in the sequencer.
- Do not implement frontend-only progress tracking for learning paths without backend persistence.
- Do not hard-code learning paths as static arrays; use database-driven curriculum.
- Do not skip circuit breaker wrappers for external service calls.
- Do not implement caching without explicit TTL and invalidation strategy.
- Do not deploy database migrations that drop columns in the same deploy that removes the write code.
- Do not scatter feature flag checks as raw if-statements; use the FeatureFlagService.


---

## 21.5 Home Daily Life Hub: learn Japanese from everyday life

The product is BJT-first, but it should not feel like a test-prep prison. The learner should open the home page every day and feel: “I can learn Japanese from my actual life in Japan.” The home page should become a calm, practical daily companion that converts everyday information into small Japanese learning moments.

### Product principle

The home page should combine three layers:

1. **Today’s reality**: time, weather, season, local context, calendar, commute/life hints.
2. **Japanese language extraction**: useful vocabulary, phrases, kanji, grammar, keigo, and business expressions from that context.
3. **Actionable learning**: save to flashcard, quick quiz, listening sentence, shadowing, or BJT-style micro question.

The key is subtle usefulness. The page should not become a noisy portal. Each widget must either be immediately useful or produce a clear learning action.

### Recommended home layout

```txt
Home
├── Hero: Today’s learning path + quick start
├── Daily Life Strip: time / weather / season / calendar / phrase
├── Continue Learning: due reviews, active deck, next BJT task
├── Everyday Japanese Widgets
│   ├── NHK News to Learn
│   ├── Weather Japanese
│   ├── Today in Japan
│   ├── Business Phrase of the Day
│   ├── Life Situation Mini Lesson
│   ├── Calendar and Manners
│   └── Commute / Outing Phrase Pack
├── Achievement and Streak
├── Recommended Flashcards
└── Optional: light fortune / mood card / cultural note
```

### Essential and elegant widgets

| Widget | User value | Learning value | Complexity |
|---|---|---|---|
| Current time and greeting | Makes the app feel alive | 「おはようございます」「お疲れさまです」 context | Low |
| Weather Japanese | Useful every day | weather words, small talk, workplace phrases | Medium |
| Seasonal word | Japan-specific daily culture | seasonal vocabulary, kanji, greeting phrases | Low |
| Today’s business phrase | BJT-oriented but light | keigo, meetings, email, phone expressions | Low |
| NHK News to Learn | real Japanese reading | extract vocab/kanji/grammar and generate deck | Medium |
| Daily mini situation | life in Japan scenario | convenience store, hospital, city hall, train, office | Low-Medium |
| Calendar and manners | useful for living in Japan | holidays, business etiquette, set phrases | Medium |
| Commute phrase pack | practical before going out | announcements, delay phrases, asking directions | Medium |
| Mood-based study mode | reduces friction | choose light/review/focus/battle based on mood | Low |
| Lucky / unlucky day as playful culture | fun, not critical | phrases around 運, 吉, 凶, 縁起 | Low |

### Widget details

#### 1. Daily greeting and time card

Purpose: Make the home page feel personal and alive.

Content:

- Local time based on user timezone.
- Japanese greeting adjusted by time:
  - morning: 「おはようございます」
  - daytime: 「こんにちは」
  - evening after work: 「お疲れさまです」
- Tiny explanation in selected language.
- One-tap “practice greeting” audio/shadowing.

Example UI copy:

```txt
お疲れさまです。今日は軽く10分だけ復習しましょう。
Good work today. Let’s do a light 10-minute review.
```

Learning action:

- Add phrase to flashcard.
- Practice pronunciation.
- Open “daily small talk” mini lesson.

#### 2. Weather Japanese card

Purpose: Weather is daily, universal, and highly conversational. It is perfect for habit formation and small talk practice.

Content:

- Current weather: sunny, cloudy, rain, snow, humid, windy.
- Temperature and chance of rain.
- Japanese weather sentence:
  - 「今日は蒸し暑いですね。」
  - 「午後から雨が降るそうです。」
  - 「傘を持って行ったほうがよさそうです。」
- Business small-talk variation:
  - 「本日はお足元の悪い中、ありがとうございます。」
  - 「暑い日が続いておりますが、いかがお過ごしでしょうか。」

Learning action:

- Extract weather vocabulary.
- Generate 3 flashcards from today’s weather.
- Quick quiz: choose the most natural small-talk phrase.
- Listening/shadowing for the sentence.

Implementation:

- Provider abstraction: `WeatherProvider` interface.
- Store only normalized daily snapshot and generated learning content.
- If provider is unavailable, fall back to static seasonal content.

Suggested API:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/daily/weather?location=` | weather snapshot + Japanese sentence |
| POST | `/daily/weather/generate-deck` | create flashcards from weather vocabulary |
| POST | `/daily/weather/quiz` | create a micro quiz from weather phrase |

#### 3. Seasonal Japanese card

Purpose: Japan has strong seasonal language. This makes the app feel culturally grounded.

Content examples:

- 春: 桜, 新年度, 花粉症, 入学式
- 夏: 梅雨, 熱中症, 台風, お盆
- 秋: 紅葉, 食欲の秋, 連休
- 冬: 年末年始, 寒波, 忘年会, 年賀状

Learning action:

- One seasonal word per day.
- Kanji breakdown.
- Example sentence.
- Business greeting phrase.
- Add to seasonal deck.

Example:

```txt
今日の季節語: 梅雨（つゆ）
例文: 梅雨の時期は湿度が高くなります。
Business: 梅雨寒の折、どうぞご自愛ください。
```

#### 4. Today in Japan / calendar card

Purpose: Help learners understand holidays, work rhythm, and social manners.

Content:

- Japanese public holidays.
- Business calendar notes: beginning/end of month, fiscal year, bonus season, year-end greetings.
- Cultural/manners note.
- Optional user region support later.

Learning action:

- Phrase of the day related to the calendar.
- Add calendar phrase to card.
- Mini quiz: choose appropriate greeting.

Examples:

- 年末: 「本年も大変お世話になりました。」
- 新年度: 「新年度もどうぞよろしくお願いいたします。」
- 連休前: 「よい連休をお過ごしください。」

#### 5. Life situation mini lesson

Purpose: Turn everyday situations into useful Japanese practice.

Recommended rotating scenarios:

| Scenario | Examples |
|---|---|
| Convenience store | レジ袋, 温めますか, ポイントカード |
| Supermarket | 半額, 税込, 賞味期限 |
| Train | 遅延, 振替輸送, 各駅停車 |
| Hospital | 保険証, 予約, 症状 |
| City hall | 住民票, 在留カード, 更新 |
| Nursery/school | 連絡帳, お迎え, 欠席 |
| Office | 会議, 確認, 共有, 調整 |
| Email/chat | 承知しました, 確認いたします, 恐れ入ります |

Learning action:

- 3 useful phrases.
- 1 short dialogue.
- 1 BJT-style question.
- Add scenario pack to flashcards.

#### 6. Business phrase of the day

Purpose: Keep the BJT identity strong while staying light.

Categories:

- meeting
- email
- phone
- apology
- request
- confirmation
- scheduling
- reporting
- negotiation
- customer support

Example:

```txt
Phrase: 念のため確認させてください。
Meaning: Cho phép tôi xác nhận lại cho chắc.
Use case: polite confirmation in business context.
Casual contrast: ちょっと確認していい？
```

Learning action:

- Audio/shadowing.
- Politeness comparison.
- “Choose the best business expression” quiz.

#### 7. Commute / outing phrase pack

Purpose: Give practical value before the user leaves home.

Content:

- train delay vocabulary
- weather-related outing phrase
- asking for directions
- station announcement mini listening

Example phrases:

- 「電車が遅れています。」
- 「何番線ですか。」
- 「振替輸送は利用できますか。」
- 「少し遅れて到着します。」

Learning action:

- one-minute listening drill
- save phrases to deck
- BJT-style workplace lateness message practice

#### 8. Daily “from one thing to many skills” card

Purpose: This is the signature learning mechanic. One everyday item becomes multiple learning paths.

Example: Today’s weather is rainy.

```txt
雨
├── vocabulary: 雨, 大雨, 小雨, 傘, 湿度
├── grammar: ～そうです, ～たほうがいい
├── business phrase: お足元の悪い中ありがとうございます
├── listening: short weather announcement
└── BJT micro question: choose the appropriate greeting for a rainy business visit
```

This should be implemented as a reusable `LearningExtractorService` that can receive any source object: weather, news, calendar, phrase, scenario, article, or admin-curated content.

### Optional fun widgets

These are useful for atmosphere, but should remain optional and tasteful.

#### 1. Light fortune / mood card

Purpose: fun hook, not superstition-heavy.

Design rule:

- Treat as cultural/playful content, not prediction.
- Avoid making users anxious.
- Always convert into language learning.

Example:

```txt
今日のことば: 吉（きち）
Meaning: good fortune.
Phrase: 縁起がいいですね。
Mini lesson: words around luck and encouragement.
```

Possible categories:

- 今日のことば
- 今日の励まし
- 今日の小さな挑戦
- 今日のラッキーフレーズ

#### 2. Tiny challenge card

Purpose: increase action without pressure.

Examples:

- “Say this phrase aloud once.”
- “Create 3 cards from today’s news.”
- “Review 5 weak words before lunch.”
- “Win one bot battle using business expressions.”

#### 3. Mood-based study entry

Ask the user how they feel, then suggest mode:

| Mood | Suggested mode |
|---|---|
| tired | 3-minute review |
| motivated | focus sprint |
| curious | news reading |
| competitive | bot battle |
| anxious before test | weak-point practice |
| commuting | listening/shadowing |

### Home personalization rules

The home page should adapt based on:

- UI language
- explanation language
- current BJT target level
- timezone and rough region
- study streak
- weak skills
- preferred learning style
- recent searches
- active deck
- whether the user prefers serious mode or playful mode

Personalization must be explainable. Example:

```txt
Recommended because you often miss keigo questions in business email scenarios.
```

### Data model additions

```sql
CREATE SCHEMA IF NOT EXISTS daily;

CREATE TYPE daily.widget_kind AS ENUM (
  'time_greeting',
  'weather',
  'seasonal_word',
  'calendar_note',
  'life_situation',
  'business_phrase',
  'commute_phrase',
  'nhk_news',
  'fortune_word',
  'tiny_challenge'
);

CREATE TABLE daily.daily_widget_config (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  widget_kind daily.widget_kind NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  display_order SMALLINT NOT NULL DEFAULT 0,
  min_level TEXT,
  max_level TEXT,
  locale TEXT NOT NULL DEFAULT 'vi',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(widget_kind, locale)
);

CREATE TABLE daily.daily_content_item (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  widget_kind daily.widget_kind NOT NULL,
  content_date DATE NOT NULL,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT,
  japanese_text TEXT,
  reading_text TEXT,
  explanation_text TEXT,
  source_provider TEXT,
  source_ref TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(widget_kind, content_date, locale, source_ref)
);

CREATE TABLE daily.daily_learning_extraction (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  daily_content_item_id BIGINT NOT NULL REFERENCES daily.daily_content_item(id) ON DELETE CASCADE,
  extracted_entries JSONB NOT NULL DEFAULT '[]',
  extracted_kanji JSONB NOT NULL DEFAULT '[]',
  extracted_grammar JSONB NOT NULL DEFAULT '[]',
  suggested_flashcards JSONB NOT NULL DEFAULT '[]',
  suggested_quiz JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### API additions

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/daily/home` | Complete daily home payload for current user |
| GET | `/daily/widgets` | Enabled daily widgets and order |
| GET | `/daily/weather` | Weather snapshot and Japanese learning content |
| GET | `/daily/seasonal-word` | Seasonal word and phrase |
| GET | `/daily/calendar-note` | Holiday/culture/business calendar note |
| GET | `/daily/business-phrase` | Business phrase of the day |
| GET | `/daily/life-situation` | Rotating everyday scenario mini lesson |
| POST | `/daily/items/:id/generate-flashcards` | Generate flashcards from daily item |
| POST | `/daily/items/:id/quick-quiz` | Generate micro quiz |
| POST | `/daily/items/:id/mark-useful` | Feedback for personalization |

Admin APIs:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/admin/daily/widgets` | Manage daily widget configuration |
| PUT | `/admin/daily/widgets/:id` | Enable/disable/reorder widget |
| GET | `/admin/daily/content` | Browse generated/curated daily content |
| POST | `/admin/daily/content` | Create curated daily item |
| PUT | `/admin/daily/content/:id` | Edit daily item |
| POST | `/admin/daily/content/:id/publish` | Publish curated daily item |

### Provider architecture

```ts
export interface DailySignalProvider<TSnapshot> {
  code: string;
  fetchSnapshot(input: DailySignalInput): Promise<TSnapshot>;
  normalize(snapshot: TSnapshot): Promise<DailyContentItemDraft>;
}

export interface DailyLearningExtractor {
  extract(input: DailyContentItemDraft): Promise<DailyLearningExtractionDraft>;
}
```

Initial providers:

- `SystemTimeProvider`: no external API required.
- `StaticSeasonProvider`: curated by admin; no external API required.
- `WeatherProvider`: configurable external provider; fallback to static seasonal/weather phrase.
- `NHKProvider`: already planned RSS/content pipeline.
- `CalendarProvider`: Japan holidays and app-curated business calendar.
- `CuratedSituationProvider`: admin-managed life situations.

### Home UI design requirements

The daily hub should feel calm and premium:

- one hero card, not many competing banners
- compact daily strip near the top
- widgets in 2-column desktop layout, 1-column mobile layout
- every widget must have one clear primary action
- avoid red notification pressure
- use soft progress, subtle animation, and clear spacing
- weather/season cards can use gentle illustration or gradient, but not noisy stock images

Recommended home sections:

```txt
[Hero]
Today: 12 reviews due + one 5-minute BJT phrase lesson

[Daily strip]
Tokyo 07:40 | Cloudy 18°C | 今日の言葉: 調整 | Phrase: お疲れさまです

[Main grid]
- Continue Review
- Weather Japanese
- NHK News to Learn
- Business Phrase
- Life Situation
- BJT Mini Challenge

[Bottom]
Weekly progress + Skill garden + recent achievements
```

### Cursor implementation requirements

Cursor must implement the daily hub as a first-class homepage system:

- create `daily` module in NestJS
- create `daily` schema migrations in PostgreSQL
- create reusable widget components in web app
- create admin daily widget configuration screen
- implement system-time, static-season, curated-situation providers first
- design weather provider behind an interface, with fallback when no API key exists
- every daily content item must support “save to flashcards” and “quick quiz” where applicable
- daily widgets must be i18n-ready and not hard-code Japanese explanations
- analytics events must track widget impressions, clicks, flashcard generation, and quiz completion

Add events:

| Event | Trigger |
|---|---|
| `daily_widget_viewed` | widget appears in viewport |
| `daily_widget_clicked` | user clicks primary action |
| `daily_flashcards_generated` | user creates cards from daily item |
| `daily_quiz_started` | user starts daily micro quiz |
| `daily_quiz_completed` | user completes daily micro quiz |
| `daily_item_marked_useful` | user marks item useful |

### Scope guidance

Phase 1 should not require many external APIs. Start simple:

1. time/greeting
2. static seasonal word
3. business phrase of the day
4. curated life situation
5. NHK news to learn
6. flashcard generation from those items

Weather and richer local integrations can be Phase 2 once the core app is stable.

---


## 21.6 Final product review: missing product-readiness layers

Version 7 already defines the core product very well: PostgreSQL-first architecture, BJT learning domain, flashcards, realtime battle, admin analytics, daily life hub, i18n, image cards, admin RBAC, and analytics tracking. The remaining risk is not the main feature set; the remaining risk is that Cursor may build a feature-rich app that is still not launch-ready.

Therefore, v8 adds the following product-readiness layers:

- onboarding and placement diagnosis
- PWA/offline-first learning support
- notification and reminder system
- content rights, licensing, and external-provider governance
- account privacy, export, deletion, and consent flows
- observability, backup, restore, and operational readiness
- learner accessibility and inclusive design requirements
- launch checklist and phased MVP scope control

These layers should not make the MVP bloated. They define the correct architecture hooks so the app can start simple but scale safely.

---

## 21.7 Onboarding, placement test, and personalization

A BJT learning app should not drop a new learner directly into a dashboard full of choices. The first experience must answer three questions:

1. Who is this learner?
2. What level are they aiming for?
3. What should they study today?

### First-run onboarding flow

| Step | Screen | Purpose | Required output |
|---|---|---|---|
| 1 | Welcome | Set emotional tone and language | selected UI language |
| 2 | Goal | Choose target: BJT J5→J1+ or business Japanese | `target_bjt_band` |
| 3 | Current level | Self-reported level and confidence | `current_level_hint` |
| 4 | Study style | Choose daily rhythm | `daily_goal_cards`, `preferred_session_length` |
| 5 | Learning personality | Personalize motivation | `learning_personality` |
| 6 | Quick diagnosis | 8–15 questions | initial skill profile |
| 7 | First plan | Show today’s plan | generated daily plan |

### Placement diagnosis

The initial diagnosis should be short and friendly, not exam-like. Use adaptive branching later; MVP can use fixed questions.

Diagnosis should cover:

- vocabulary recognition
- kanji reading
- grammar choice
- keigo/business expression
- short reading comprehension
- listening readiness if audio is available

Result UX must avoid discouraging wording. Use language like:

- “You already have a good base in vocabulary.”
- “Your fastest improvement area is business expressions.”
- “Today we recommend a 12-minute plan.”

### Data model additions

```sql
CREATE TABLE learning.onboarding_state (
  user_id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'not_started',
  selected_ui_locale TEXT,
  selected_explanation_locale TEXT,
  target_bjt_band TEXT,
  current_level_hint TEXT,
  daily_goal_cards INTEGER,
  preferred_session_length_min INTEGER,
  learning_personality TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assessment.placement_attempt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  estimated_band TEXT,
  skill_snapshot JSONB NOT NULL DEFAULT '{}',
  recommendation JSONB NOT NULL DEFAULT '{}'
);
```

### APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/onboarding/state` | current onboarding state |
| POST | `/onboarding/start` | initialize onboarding |
| PUT | `/onboarding/preferences` | save language/goal/style/personality |
| POST | `/placement/start` | start placement diagnosis |
| POST | `/placement/:attemptId/answer` | submit diagnosis answer |
| POST | `/placement/:attemptId/complete` | finish and generate initial plan |
| GET | `/learning/initial-plan` | show first recommended study plan |

Cursor must implement onboarding as a real flow, not just a static page.

---

## 21.8 PWA and offline-friendly learning

The product is web-first, but learners in Japan often study during commute, short breaks, or places with unstable connectivity. The app should support progressive offline-friendly behavior without turning into a full native app.

### PWA requirements

- installable web app manifest
- app icons and theme color
- service worker through a Next.js-compatible PWA setup
- offline fallback page
- cache shell UI and static assets
- cache recently viewed dictionary entries
- cache due flashcards for short offline sessions
- queue offline review submissions and sync later

### Offline scope for MVP

MVP offline should support:

- review already-loaded flashcards
- view recently opened dictionary/grammar/kanji pages
- show today’s plan from cached data
- gracefully disable battle, live search, admin, and external image search

Do not support offline admin writes in MVP.

### Offline sync rules

| Operation | Offline behavior |
|---|---|
| flashcard review | queue locally, sync when online |
| bookmark | queue locally, optimistic UI |
| quiz attempt | only if fully preloaded; otherwise online-only |
| battle | online-only |
| admin write | online-only |
| image upload/search | online-only |

### Data integrity rule

Offline review sync must be idempotent. Each offline event must have a stable client-generated UUID.

```ts
type OfflineReviewEvent = {
  clientEventId: string;
  userCardId: string;
  rating: 'again' | 'hard' | 'good' | 'easy';
  answeredAt: string;
  responseTimeMs?: number;
};
```

---

## 21.9 Notification and reminder system

A learning app should not rely only on streak anxiety. Notifications must be gentle, useful, and user-controlled.

### Notification channels

| Channel | MVP? | Notes |
|---|---|---|
| in-app notification center | yes | safest and easiest |
| email digest | yes | weekly report, comeback summary |
| browser push | later | ask permission only after user sees value |
| LINE integration | future | Japan-friendly but not MVP |
| mobile native push | future | if native app is added later |

### Notification types

| Type | Example | Trigger |
|---|---|---|
| due review | “12 cards are ready. 5 minutes is enough.” | due cards > threshold |
| weekly report | “You improved business expression accuracy by 8%.” | weekly rollup |
| comeback | “Welcome back. Let’s restart with 3 easy cards.” | missed days |
| achievement | “You cleared your first BJT reading mission.” | milestone |
| daily life learning | “Today’s phrase: お足元の悪い中…” | daily widget |
| admin alert | import failed, queue lag, low content quality | ops/admin only |

### User controls

User must be able to configure:

- reminder time
- quiet hours
- notification language
- channels enabled
- weekly digest on/off
- streak pressure on/off

### Database additions

```sql
CREATE TABLE ops.notification_preference (
  user_id UUID PRIMARY KEY,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  browser_push_enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_time_local TIME,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  locale TEXT NOT NULL DEFAULT 'vi',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ops.notification_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  status TEXT NOT NULL DEFAULT 'unread',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
```

---

## 21.10 Content rights, licensing, and external provider governance

The platform uses source datasets, generated content, NHK/news-derived learning, external images, audio, and possibly AI enrichment. This requires explicit provenance and rights tracking from day one.

### Content provenance rules

Every content object should answer:

- Where did it come from?
- Who created or imported it?
- Can it be shown publicly?
- Can it be used in paid features?
- Can it be exported?
- Can it be used to generate derivative flashcards?

### Required metadata fields

For content, media, examples, questions, and generated learning items:

```ts
type Provenance = {
  sourceType: 'seed_json' | 'admin' | 'external_api' | 'ai_generated' | 'user_generated';
  sourceName?: string;
  sourceUrl?: string;
  licenseLabel?: string;
  licenseUrl?: string;
  rightsStatus: 'unknown' | 'internal_ok' | 'public_ok' | 'restricted' | 'needs_review';
  commercialUseAllowed?: boolean;
  derivativeUseAllowed?: boolean;
  attributionRequired?: boolean;
  attributionText?: string;
  reviewedBy?: string;
  reviewedAt?: string;
};
```

### External image search guardrails

- Never hotlink external images as final card images.
- Store selected images in object storage if license allows it.
- Keep provider, source URL, thumbnail URL, license, and selected timestamp.
- If license is unknown, allow personal-use draft card only or require admin review depending on product policy.
- Admin Media Library must have a “rights status” filter.

### News-derived learning

For NHK/news-style content:

- Store only allowed excerpts if full article redistribution is not permitted.
- Prefer storing extracted vocabulary, grammar, kanji, and short generated summaries rather than copying full articles.
- Keep source URL and retrieval timestamp.
- Provide “open original article” link where appropriate.

### Admin screens

Add admin screens:

- Content Rights Review
- Media Rights Review
- External Provider Settings
- Takedown Requests
- Attribution Manager

---

## 21.11 Account privacy, consent, export, and deletion

The app tracks a lot of learning behavior. This is valuable for coaching, but it must be transparent and controllable.

### User-facing privacy controls

User should be able to:

- see what analytics are collected at a high level
- choose public/private leaderboard display name
- hide from leaderboards
- choose whether battle history is public
- download personal learning data
- request account deletion
- delete avatar/media they uploaded
- control notification preferences

### Account deletion behavior

Deletion should support two modes:

| Mode | Purpose |
|---|---|
| soft delete | disable login and hide profile while preserving audit/legal records |
| anonymize learning data | remove personal identifiers but keep aggregate analytics |

### APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/privacy/settings` | current privacy settings |
| PUT | `/privacy/settings` | update privacy settings |
| POST | `/privacy/export` | request export job |
| GET | `/privacy/export/:jobId` | export job status |
| POST | `/privacy/delete-request` | request account deletion |
| POST | `/privacy/delete-request/cancel` | cancel within grace period |

### Admin requirements

- Support staff must not manually delete users without audit reason.
- User 360 must show privacy flags clearly.
- Export and deletion jobs must be logged.
- Analytics must aggregate by default.

### 21.11.1 Data retention and governance matrix

#### Data retention policy

| Data category | Retention | After expiry | Legal basis |
|---|---|---|---|
| User profile (name, email, avatar) | Until account deletion + 30 days grace | Anonymize or hard delete | Contract |
| Learning progress (SRS, mastery, streaks) | Until account deletion | Anonymize (keep aggregate) | Contract |
| Quiz/battle history | Until account deletion | Anonymize | Contract |
| Analytics events (raw) | 90 days | Archive or delete | Legitimate interest |
| Analytics aggregates | 2 years | Delete | Legitimate interest |
| Admin audit logs | 3 years | Archive | Legal obligation |
| Security audit logs | 1 year minimum | Archive | Legal obligation |
| Payment/billing records | 7 years (tax compliance) | Archive encrypted | Legal obligation |
| Session/refresh tokens | 30 days / on rotation | Hard delete | Contract |
| Import staging data | 30 days after import completion | Hard delete | Processing |
| Backup data | Per backup retention policy (7/30/90 days) | Overwrite | Legitimate interest |
| Media uploads (user) | Until account deletion or user deletes | Hard delete from storage | Consent |
| Reading assist interaction events | 30 days | Delete | Legitimate interest |

#### PII classification

| Classification | Fields | Handling |
|---|---|---|
| **Direct PII** | email, display name, avatar URL, IP address | Encrypt at rest, mask in logs, delete on account deletion |
| **Indirect PII** | user ID, device fingerprint, session ID | Pseudonymize in analytics, delete with account |
| **Sensitive** | OAuth tokens, password hash, payment info | Encrypt, never log, rotate regularly |
| **Learning data** | progress, scores, SRS state | Anonymizable, aggregate-safe |
| **Non-PII** | content IDs, feature flags, system metrics | No special handling |

#### Pseudonymization for analytics
- Analytics events must use pseudonymized user IDs (hash of user_id + rotating salt).
- Raw user_id may be stored in learning tables but must be pseudonymized before analytics export.
- Admin User 360 view requires explicit permission + audit reason to de-pseudonymize.

#### Data export format
- Format: JSON (structured, per-entity files) + optional CSV for tabular data.
- Include: profile, learning progress, flashcard decks, quiz history, battle history, reading assist preferences.
- Exclude: admin audit logs, system analytics, other users' data.
- Delivery: generate async, notify when ready, download link valid 48 hours.

#### Account deletion SLA
- Soft delete: immediate (disable login, hide profile).
- Grace period: 30 days (user can cancel and restore account).
- Hard deletion/anonymization: within 72 hours after grace period.
- Confirmation email sent at each stage.

#### Admin access controls for PII
- Admin must provide reason when accessing User 360 detail view.
- Access reason logged in admin audit log.
- PII access limited to `super_admin` and `admin` roles (not `editor` or `viewer`).
- Time-limited access sessions for sensitive operations.

#### Consent versioning
- Track consent version for privacy policy and terms of service.
- When policy version changes, prompt user to re-accept on next login.
- Store: `user_id`, `consent_type`, `version`, `accepted_at`, `ip_address`.
- Admin can view consent coverage (% of users on current version).

---

## 21.12 Accessibility and inclusive learning UX

A serious learning product should be comfortable for tired users, older users, neurodiverse learners, and learners studying after work.

### Accessibility requirements

- WCAG 2.2 AA target where practical
- keyboard navigation for core flows
- visible focus states
- sufficient color contrast
- reduced-motion setting
- captions/transcripts for audio where possible
- furigana toggle
- romaji toggle for beginners
- font size controls for Japanese text
- avoid information conveyed only by color

### Learning comfort settings

User can configure:

- show/hide furigana
- show/hide romaji
- Japanese font size
- compact/comfortable card layout
- reduced animations
- low-pressure mode for streaks and reminders
- battle mode visibility / disable competitive prompts

### UX principle

The app should create motivation through mastery, clarity, and small wins, not shame or anxiety.

---

## 21.13 Observability, backup, restore, and operational readiness

Cursor must not stop at “features work locally.” The app must be diagnosable and recoverable.

### Observability requirements

- structured logs with traceId
- request duration logging
- error tracking integration placeholder, for example Sentry-ready adapter
- OpenTelemetry-ready tracing hooks
- BullMQ queue dashboard or admin queue health page
- Meilisearch sync lag metric
- analytics rollup freshness metric
- import job error report

### Health endpoints

| Endpoint | Purpose |
|---|---|
| `/health/live` | process is alive |
| `/health/ready` | database/redis/search connectivity |
| `/health/version` | git sha, build time, migration version |
| `/health/metrics` | Prometheus-compatible metrics endpoint |
| `/admin/system/jobs` | queue health |
| `/admin/system/search-sync` | search projection health |
| `/admin/system/analytics-freshness` | rollup freshness |

### 21.13.1 Production metrics (must be instrumented)

The following metrics must be collected and exposed via Prometheus-compatible endpoint or structured log aggregation:

#### API performance metrics
| Metric | Type | Alert threshold |
|---|---|---|
| `api_request_duration_seconds` | Histogram (p50/p95/p99) | p99 > 2s for 5 min |
| `api_request_total` | Counter by status code | 5xx rate > 1% for 3 min |
| `api_4xx_total` | Counter by endpoint | Spike > 50/min |
| `api_5xx_total` | Counter by endpoint | Any > 10/min |
| `api_active_connections` | Gauge | > 80% of max |

#### Database metrics
| Metric | Type | Alert threshold |
|---|---|---|
| `db_query_duration_seconds` | Histogram | p95 > 500ms |
| `db_slow_query_total` | Counter (queries > 1s) | > 10/min |
| `db_connection_pool_active` | Gauge | > 90% of pool size |
| `db_connection_pool_waiting` | Gauge | > 0 for 30s |
| `prisma_query_duration_seconds` | Histogram by model | p95 > 200ms |

#### Redis metrics
| Metric | Type | Alert threshold |
|---|---|---|
| `redis_connection_failures_total` | Counter | > 3/min |
| `redis_cache_hit_ratio` | Gauge | < 80% |
| `redis_memory_usage_bytes` | Gauge | > 80% of max |

#### Queue metrics (BullMQ)
| Metric | Type | Alert threshold |
|---|---|---|
| `bullmq_queue_depth` | Gauge by queue | > 1000 |
| `bullmq_failed_jobs_total` | Counter by queue | > 10/hour |
| `bullmq_retry_count_total` | Counter | Spike > 50/hour |
| `bullmq_job_duration_seconds` | Histogram by job name | p95 > 30s |

#### Search metrics
| Metric | Type | Alert threshold |
|---|---|---|
| `meilisearch_indexing_lag_seconds` | Gauge | > 60s |
| `meilisearch_search_duration_seconds` | Histogram | p95 > 200ms |

#### WebSocket / Battle metrics
| Metric | Type | Alert threshold |
|---|---|---|
| `ws_active_connections` | Gauge | > 500 |
| `ws_disconnect_rate` | Counter per minute | > 10% of active |
| `ws_reconnect_total` | Counter | Spike > 20/min |
| `battle_rooms_active` | Gauge | Monitor only |

#### Frontend Web Vitals (collected client-side, reported to API)
| Metric | Target |
|---|---|
| LCP (Largest Contentful Paint) | < 2.5s |
| INP (Interaction to Next Paint) | < 200ms |
| CLS (Cumulative Layout Shift) | < 0.1 |
| TTFB (Time to First Byte) | < 800ms |

#### Business metrics (instrumented via analytics)
| Metric | Type |
|---|---|
| `payment_webhook_failure_rate` | Counter by provider |
| `ad_provider_failure_rate` | Counter by provider |
| `email_send_failure_rate` | Counter |
| `reading_assist_cache_miss_rate` | Gauge |

#### Critical alert rules
- **P1 (page immediately)**: Health ready check fails for 3 minutes, 5xx rate > 5%, database unreachable.
- **P2 (page within 15 min)**: p99 latency > 5s for 10 min, Redis connection failures, BullMQ failed jobs > 50/hour.
- **P3 (next business day)**: Cache hit ratio < 70%, slow query spike, Meilisearch lag > 5 min.

### Backup and restore

Minimum production plan:

- PostgreSQL daily backup
- object storage backup policy
- export/import seed data
- document restore procedure in README
- test restore in staging before real launch

### 21.13.2 Backup RPO/RTO and disaster recovery

#### Recovery objectives

| Tier | RPO (max data loss) | RTO (max downtime) | Applies to |
|---|---|---|---|
| MVP / small scale | 24 hours | 4 hours | Initial launch |
| Growth (1K+ DAU) | 1 hour | 1 hour | Post-product-market-fit |
| Scale (10K+ DAU) | 15 minutes | 15 minutes | Mature product |

#### Backup strategy

| Data | Method | Frequency | Retention |
|---|---|---|---|
| PostgreSQL | pg_dump (MVP) / WAL archiving + PITR (Growth+) | Daily (MVP), Continuous WAL (Growth+) | 7 days daily, 30 days weekly, 90 days monthly |
| Redis | RDB snapshots | Every 6 hours | 3 days |
| Object storage (MinIO/S3) | Versioning + cross-region replication (Growth+) | Continuous | 90 days |
| Meilisearch | Rebuild from PostgreSQL (no backup needed) | On demand | N/A |

#### Backup requirements
- All backups must be encrypted at rest (AES-256).
- Backup encryption keys stored separately from backup data.
- Automated backup verification job: restore to test instance weekly, validate row counts.
- PITR (Point-in-Time Recovery) for PostgreSQL when using managed DB service.
- Backup monitoring: alert if daily backup fails or is > 24h old.

#### Restore drill checklist
Perform quarterly (at minimum before any major release):
1. Provision clean environment.
2. Restore PostgreSQL from latest backup.
3. Verify migration version matches.
4. Verify row counts match expected.
5. Run health check endpoints.
6. Run smoke test suite.
7. Document restore time and any issues.
8. Archive drill report.

### Migration safety

- all migrations must be committed
- destructive migrations require explicit comment and backup note
- large backfills should run as jobs, not blocking startup
- analytics rollups must be backfillable

---

## 21.14 MVP scope control and launch checklist

Because the spec is intentionally rich, Cursor must build in phases. MVP should be impressive but not over-expanded.

### Recommended MVP must-have

- Auth-ready user profile with avatar and language settings
- Dictionary/Kanji/Grammar/Example browsing
- Unified search with Meilisearch
- Flashcards with SRS and image upload
- **Learning Path Engine with 3 seeded paths (J5/J4/J3), adaptive sequencer, competency radar**
- Basic BJT quiz
- Daily Life Hub with static/deterministic widgets
- Learner dashboard and basic analytics
- Admin CMS for content/users/media/i18n/import/audit
- **Admin path builder for learning paths**
- Professional admin analytics skeleton with real aggregate data for available features
- PWA shell and offline flashcard queue
- Notification preferences and in-app notification center
- Privacy settings and data export request placeholder
- **Production infrastructure: caching, circuit breakers, feature flags, PgBouncer, security headers, structured logging**

### Should be Phase 2+

- full realtime PvP between users
- advanced bot tuning
- external image provider integrations beyond one provider abstraction
- full weather API integration
- LINE notifications
- calibrated BJT score estimation
- advanced psychometrics
- paid subscription/billing
- native mobile apps

### Launch checklist

Before public release:

- no screen has hard-coded user-facing text outside i18n
- no admin write is unaudited
- no analytics drill-down bypasses permission checks
- seed/demo data can be reset
- backup/restore process is documented
- account export/deletion request flow exists
- content provenance is visible in admin
- external images have source/provenance metadata
- PWA install works
- core flows pass Playwright e2e
- README has exact setup, migration, seed, and troubleshooting commands

---

## 22. Recommended first command to give Cursor

```text
Start Phase 1 and Phase 2 from NihonGo BJT Cursor Master Specification v15.
Create the full Turborepo, Docker Compose, PostgreSQL + Prisma setup, raw SQL migrations for schemas/extensions/index placeholders, basic NestJS app, basic Next.js web/admin shells, shared packages, and README.
After creating files, run install/build/typecheck and fix all errors.
Do not implement MongoDB. Do not leave broken imports.
```



---

## 23. Cursor Agent Execution Pack

This section is intentionally written in a more structured, machine-friendly style. The main specification remains Markdown for humans, but Cursor should treat this section, `AGENTS.md`, and `.cursor/rules/*.mdc` as the execution contract.

### 23.1 Why this project uses structured Cursor instructions

For a large product spec, Cursor can drift if all requirements are presented as one long document. The project therefore uses:

- one human-readable master specification
- one repository-level `AGENTS.md`
- small `.cursor/rules/*.mdc` files grouped by concern
- phase-by-phase prompts
- explicit acceptance criteria and stop conditions

Do not convert the entire spec to XML. Use XML-style blocks only for high-priority execution contracts and prompts.

### 23.2 Master execution contract

```xml
<cursor_execution_contract version="1.0">
  <role>
    You are a senior full-stack product engineer, database architect, product designer, and QA-minded implementer.
  </role>

  <primary_goal>
    Build NihonGo BJT as a production-ready Japanese/BJT learning web application based on this specification.
  </primary_goal>

  <source_of_truth>
    <item>Use this master specification as the product and architecture source of truth.</item>
    <item>Use AGENTS.md as the repository-level operating guide.</item>
    <item>Use .cursor/rules/*.mdc as persistent implementation rules.</item>
    <item>Use phase prompts under docs/cursor-prompts/ to execute one phase at a time.</item>
  </source_of_truth>

  <tech_stack>
    <frontend>Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, i18n</frontend>
    <backend>NestJS, TypeScript, Prisma, PostgreSQL</backend>
    <search>Meilisearch projection index</search>
    <jobs>Redis, BullMQ</jobs>
    <realtime>Socket.IO for battle and realtime experiences</realtime>
    <storage>S3-compatible object storage, local MinIO in development</storage>
    <analytics>PostgreSQL event log, rollup jobs, admin dashboards</analytics>
  </tech_stack>

  <must_follow>
    <item>Use PostgreSQL as the source of truth.</item>
    <item>Do not use MongoDB or Mongoose.</item>
    <item>Do not hard-code user-facing UI text. Use i18n keys.</item>
    <item>Keep learner features and admin features permission-aware.</item>
    <item>Implement audit logs for admin writes.</item>
    <item>Keep search as projection, not source of truth.</item>
    <item>Keep media provenance/license metadata for user-uploaded and provider-sourced images.</item>
    <item>Implement in phases and verify each phase before moving forward.</item>
  </must_follow>

  <forbidden>
    <item>Do not silently remove features from the spec.</item>
    <item>Do not replace the architecture with a simpler unrelated stack.</item>
    <item>Do not create fake external integrations without provider abstraction.</item>
    <item>Do not implement placeholder admin analytics without real aggregate data paths.</item>
    <item>Do not bypass RBAC, audit logging, privacy, or content rights requirements.</item>
    <item>Do not leave broken imports, dead routes, or failing migrations.</item>
  </forbidden>

  <output_contract>
    <item>Before editing files, produce a concise implementation plan.</item>
    <item>After each phase, run format, lint, typecheck, tests, and migrations where applicable.</item>
    <item>Report changed files, completed acceptance criteria, commands run, and remaining risks.</item>
    <item>If a requirement is too large for the current phase, create a clear TODO with owner area and phase.</item>
  </output_contract>

  <quality_bar>
    <item>Production-shaped code, not demo-only code.</item>
    <item>Strong typing across frontend/backend/shared packages.</item>
    <item>Database migrations must be deterministic and committed.</item>
    <item>Core learning logic must have tests.</item>
    <item>Admin pages must not be empty shells; they must connect to real APIs or documented phase stubs.</item>
  </quality_bar>
</cursor_execution_contract>
```

### 23.3 Repository files Cursor should receive

Create or copy the following files into the repository root before starting implementation:

```text
AGENTS.md
.cursor/rules/00-project-contract.mdc
.cursor/rules/01-architecture-stack.mdc
.cursor/rules/02-database-postgresql-prisma.mdc
.cursor/rules/03-frontend-uiux-i18n.mdc
.cursor/rules/04-admin-rbac-analytics.mdc
.cursor/rules/05-learning-srs-bjt-battle.mdc
.cursor/rules/06-media-rights-privacy.mdc
.cursor/rules/07-testing-quality-ops.mdc
docs/cursor-prompts/phase-01-foundation.xml
docs/cursor-prompts/phase-02-core-content-search.xml
docs/cursor-prompts/phase-03-flashcards-srs.xml
docs/cursor-prompts/phase-04-bjt-quiz-study.xml
docs/cursor-prompts/phase-05-admin-cms-rbac.xml
docs/cursor-prompts/phase-06-analytics.xml
docs/cursor-prompts/phase-07-daily-life-hub.xml
docs/cursor-prompts/phase-08-battle-realtime.xml
docs/cursor-prompts/phase-09-product-readiness.xml
docs/cursor-prompts/phase-10-polish-qa.xml
docs/cursor-prompts/README.md
```

### 23.4 Cursor stop-and-verify rule

Cursor must not treat the entire product as one task. It must stop after every phase and verify:

- code compiles
- migrations are valid
- lint/typecheck passes or failures are listed clearly
- important tests pass
- changed files are summarized
- remaining risks are listed
- next phase is explicitly recommended

### 23.5 Recommended first Cursor prompt

```xml
<cursor_task>
  <context>
    You are working inside the NihonGo BJT repository. Read AGENTS.md, .cursor/rules/*.mdc, and the master specification.
  </context>
  <task>
    Execute phase 01 foundation only. Do not implement later phase features unless needed as lightweight placeholders for routing or schema consistency.
  </task>
  <must_do>
    <item>Create the monorepo structure.</item>
    <item>Create Docker Compose for PostgreSQL, Redis, Meilisearch, and MinIO.</item>
    <item>Create backend and frontend app shells.</item>
    <item>Create Prisma setup with PostgreSQL schemas and extensions.</item>
    <item>Create shared packages for types, config, i18n keys, and UI tokens.</item>
    <item>Create README setup commands.</item>
  </must_do>
  <must_not_do>
    <item>Do not use MongoDB.</item>
    <item>Do not hard-code UI text outside i18n files.</item>
    <item>Do not create fake finished features.</item>
  </must_not_do>
  <verify>
    <item>Run install.</item>
    <item>Run format/lint/typecheck where available.</item>
    <item>Run Prisma generate and migration validation.</item>
    <item>Report all changed files and remaining risks.</item>
  </verify>
</cursor_task>
```

---

## 24. Cursor one-click orchestration mode

This project is large, so the recommended workflow is still phased execution. However, Cursor can be driven with a single master orchestration prompt when the repository already contains `AGENTS.md`, `.cursor/rules`, and the phase prompts.

### 24.1 One-click goal

The one-click mode means: paste one master prompt into Cursor Agent once. Cursor should then:

1. read all rules and the master spec,
2. create an implementation plan,
3. execute phases 01 to 10 in order,
4. run quality gates after each phase,
5. stop only when a blocking error cannot be safely fixed,
6. produce a final report with completed phases, changed files, commands run, and remaining gaps.

It does not mean Cursor should skip validation or silently continue after broken migrations, failed tests, or architecture drift.

### 24.2 One-click guardrails

Cursor must not treat one-click mode as permission to create a messy prototype. The following gates are mandatory:

- after each phase: run typecheck, lint, relevant tests, and database checks when applicable;
- if a gate fails: try to fix it within the same phase;
- if the same gate fails twice: stop and report the blocker;
- never replace PostgreSQL with MongoDB;
- never remove i18n, RBAC, analytics, media rights, or privacy requirements to make the build easier;
- never hard-code UI text;
- never create placeholder dashboards without real API/schema/data contracts.

### 24.3 One-click files

The Cursor pack contains:

- `RUN_ALL_ONE_CLICK.md` — human instructions for running the project in one-shot mode.
- `docs/cursor-prompts/RUN_ALL_ONE_CLICK.xml` — master prompt for full one-shot execution.
- `docs/cursor-prompts/RUN_ALL_SAFE_MODE.xml` — safer master prompt with stricter stop conditions.
- `docs/cursor-prompts/phase-*.xml` — individual phase prompts if manual phase execution is needed.

### 24.4 Recommended usage

Use `RUN_ALL_ONE_CLICK.xml` when creating a new project from zero and you want Cursor to implement as much as possible in one pass.

Use `RUN_ALL_SAFE_MODE.xml` when the repository already contains code or when you care more about preserving quality than speed.



---

## 25. Production-grade baseline: no demo/prototype code

This project may start small and does not need premature large-scale infrastructure. However, Cursor must not implement the application as a demo. Every feature must be a minimal production-grade vertical slice.

### 25.1 Core principle

When a feature is too large, reduce the scope, but keep the slice real. One real workflow with database persistence, validation, API contract, and tests is better than ten static screens.

### 25.2 Definition of done for a feature

A feature is not done unless it includes the following where applicable:

- domain model and typed DTO/API contract
- PostgreSQL persistence or an explicit provider abstraction
- Prisma migration or documented raw SQL migration
- validation at API boundaries
- error handling with safe user-facing messages
- i18n keys for all user-facing text
- RBAC enforcement on backend for admin/sensitive operations
- audit logs for admin mutations and sensitive user operations
- tests for critical business logic
- seed/dev data through the real schema, not hard-coded UI arrays
- health/observability hooks for background jobs where relevant

### 25.3 Forbidden shortcuts

Cursor must not use these shortcuts as final implementation:

- fake static arrays as the source of truth for dictionary, kanji, grammar, quiz, flashcards, analytics, users, or admin data
- frontend-only RBAC or hiding buttons without backend permission enforcement
- fake analytics charts not backed by event/rollup tables or seeded rollup data
- direct import from raw JSON into canonical content tables without staging, profiling, validation, and transform
- localStorage-only persistence for learning state, deck state, admin settings, profile, or privacy settings
- empty catch blocks or swallowed errors
- TODO placeholders for required workflows
- mock external APIs without a provider interface
- deleting or weakening required architecture to make the app compile faster

### 25.4 Allowed temporary implementations

The following are allowed during early development:

- local/mock providers behind explicit interfaces when external API keys are unavailable
- seeded development data inserted through real schemas
- minimal UI that performs real end-to-end workflow
- simplified auth in local development if the code keeps a Keycloak-ready boundary and backend RBAC model
- single-instance deployment assumptions, as long as code avoids global in-memory state for persistent or audited data

### 25.5 Cursor behavior when scope is large

Cursor should follow this order:

1. implement the real schema and contracts
2. implement one real vertical slice
3. add tests and validation
4. connect minimal UI to the real API
5. seed data through the real schema
6. only then expand breadth

Example: for flashcards, implement one deck creation + card creation + SRS review flow using PostgreSQL before building many decorative screens.

### 25.6 Data import rule

Raw JSON learning data must go through staging tables first. The required import flow is:

```text
raw JSON files
→ content_import_batch / content_raw_item
→ data profiling report
→ mapping configuration
→ dry-run transform
→ validation
→ canonical content tables
→ Meilisearch projection
```

Cursor must never import raw JSON directly into canonical dictionary, kanji, grammar, example, quiz, or flashcard tables.

### 25.7 Early-stage scalability stance

Do not over-engineer for 100,000 users during MVP. But all code should remain upgradeable:

- API should be stateless where practical
- persistent state belongs in PostgreSQL, Redis, object storage, or Meilisearch
- background work belongs in BullMQ workers
- search belongs in Meilisearch projection
- analytics dashboards query rollups instead of raw events when possible
- global in-memory state is forbidden for domain data

### 25.8 Required Cursor rules

The Cursor pack must include:

```text
.cursor/rules/08-production-quality-no-demo.mdc
```

This rule is mandatory and must be applied together with the one-click and phase prompts.

---

## 26. Monetization, subscriptions, ads, entitlements, and quota system

The product should be monetization-ready from the beginning. This does **not** mean the MVP must integrate a real payment gateway or ad network immediately. It means the application architecture must support plans, entitlements, quotas, ads, billing history, admin controls, and auditability without a later rewrite.

### 26.1 Product decision: build monetization foundations early, provider integrations later

Monetization should be implemented in two layers:

1. **Internal monetization foundation**: plans, entitlements, quotas, usage metering, feature gating, admin configuration, audit logs, and analytics. This should be implemented early.
2. **External provider integration**: Stripe, app-store payments, Google AdSense, Google Ad Manager, or another ad provider. This can be added after the core product is stable.

Cursor must not hard-code `isPremium` booleans across the codebase. All paid/free behavior must go through a central entitlement and quota service.

### 26.2 Recommended early plan model

Use flexible plans instead of hard-coded user types.

| Plan | Purpose | Example limits |
|---|---|---|
| `free` | Allows users to try the app and learn daily | limited decks/cards, limited daily reviews, ads visible, limited BJT quizzes |
| `basic` | Affordable ad-light learning | higher flashcard/card limit, more quizzes, fewer ads |
| `standard` | Main paid plan | high limits, analytics, full BJT practice, no ads or minimal ads |
| `premium` | Heavy learners / future AI features | advanced coaching, AI card generation quota, priority features |
| `admin/internal` | Staff, testing, content operators | no billing, controlled by admin role, auditable |

Initial MVP may only expose `free` and `standard`, but the database and admin UI should allow more plans later.

### 26.3 Entitlements and feature gating

Every restricted feature must be checked server-side. The frontend can hide/disable buttons for UX, but backend must enforce the rule.

Example entitlement keys:

```text
flashcard.deck.create
flashcard.card.create
flashcard.image.auto_search
flashcard.image.upload
srs.review.daily
quiz.bjt.start
quiz.bjt.full_mock
analytics.advanced.view
battle.bot.play
battle.pvp.play
news.generate_flashcards
ai.card_generation
ads.remove
export.personal_data
```

Entitlement checks should be centralized:

```text
EntitlementService.can(userId, entitlementKey, context)
QuotaService.consume(userId, quotaKey, amount, idempotencyKey)
```

Never scatter plan checks like `if (user.plan === 'premium')` throughout controllers or UI components.

### 26.4 Quota model

Quotas should be configurable by plan and reset by period.

Example quotas:

| Quota key | Free example | Paid example |
|---|---:|---:|
| `flashcard.decks.total` | 5 | unlimited / high limit |
| `flashcard.cards.total` | 200 | 10,000+ |
| `flashcard.image_upload.monthly` | 20/month | 1,000/month |
| `flashcard.image_auto_search.daily` | 10/day | 200/day |
| `srs.reviews.daily` | 100/day | high/unlimited |
| `bjt.quiz.daily` | 3/day | high/unlimited |
| `bjt.full_mock.monthly` | 1/month | 20/month |
| `ai.card_generation.monthly` | 0 or low | plan-dependent |
| `battle.matches.daily` | 5/day | high/unlimited |

Important implementation rules:

- Quota consumption must be idempotent for retry-safe API calls.
- Quota checks must be transaction-safe for critical paths.
- The app should show friendly upgrade prompts before hard errors where possible.
- Admins should be able to grant temporary quota overrides.

### 26.5 PostgreSQL schema for monetization

Recommended schema namespace: `billing` or app-level Prisma models with clear `Billing` / `Monetization` prefixes.

Core tables:

```text
billing_plan
billing_plan_locale_text
billing_entitlement
billing_plan_entitlement
billing_quota_policy
billing_subscription
billing_subscription_event
billing_usage_counter
billing_usage_event
billing_invoice
billing_payment_provider_customer
billing_coupon
billing_promotion
billing_admin_override
billing_paywall_impression
billing_upgrade_event
```

#### `billing_plan`

Stores internal plan definitions.

Required fields:

```text
id
code
status: active | hidden | deprecated
price_amount
currency
billing_interval: month | year | one_time | free
trial_days
sort_order
created_at
updated_at
```

#### `billing_entitlement`

Stores feature keys.

Required fields:

```text
id
key
category
description
created_at
updated_at
```

#### `billing_plan_entitlement`

Maps plans to feature access.

Required fields:

```text
plan_id
entitlement_id
enabled
metadata_json
```

#### `billing_quota_policy`

Defines quota limits by plan.

Required fields:

```text
id
plan_id
quota_key
limit_value
period: lifetime | daily | weekly | monthly | yearly
reset_timezone
metadata_json
```

#### `billing_usage_counter`

Stores current counters for fast checks.

Required fields:

```text
id
user_id
quota_key
period_start
period_end
used_value
limit_value_snapshot
updated_at
```

#### `billing_usage_event`

Append-only usage log for audit/debugging.

Required fields:

```text
id
user_id
quota_key
amount
idempotency_key
source
metadata_json
created_at
```

Use a unique constraint on `(user_id, quota_key, idempotency_key)`.

### 26.6 Free-user restrictions and upgrade UX

Free restrictions should feel fair, not hostile. The product goal is to convert motivated users, not punish beginners.

Good upgrade triggers:

- user reaches card/deck limit
- user tries full BJT mock exam
- user wants advanced analytics/coaching
- user wants auto image search or more image uploads
- user wants no ads
- user wants higher daily review/quiz limits

Upgrade prompt copy should be respectful:

```text
Bạn đã dùng hết giới hạn miễn phí hôm nay. Hãy quay lại ngày mai hoặc nâng cấp để tiếp tục luyện BJT không giới hạn.
```

Avoid dark patterns:

- do not block access after learning streak completion in a way that feels punitive
- do not hide already-created user data behind surprise paywalls
- do not show misleading countdowns
- do not make cancellation or downgrade intentionally difficult

### 26.7 Ads architecture

Ads should be provider-ready, privacy-aware, and configurable from admin. The app should not hard-code ad snippets inside random components.

Recommended abstraction:

```text
AdProvider
AdPlacementService
AdDecisionService
AdImpressionTracker
```

Ad placements:

```text
home_feed_inline
dictionary_result_inline
dictionary_detail_bottom
flashcard_session_end
quiz_result_bottom
daily_life_hub_inline
free_user_upgrade_panel
```

Avoid ad placements that harm learning:

- no ads in the middle of a flashcard answer reveal
- no ads during timed BJT quiz questions
- no intrusive popups during study focus mode
- no misleading ad styling that looks like a lesson button

### 26.8 Ad display rules by plan

| Plan | Ad behavior |
|---|---|
| `free` | ads enabled, frequency capped |
| `basic` | reduced ads or ad-light |
| `standard` | no ads by default |
| `premium` | no ads |
| `admin/internal` | no ads |

Ad frequency caps should be configurable:

```text
max_ads_per_session
max_ads_per_day
min_minutes_between_ads
blocked_routes
blocked_study_modes
```

### 26.9 Ad privacy and consent

The app must support privacy-safe ad behavior.

Requirements:

- separate personalized and non-personalized ads when provider supports it
- respect user privacy settings and applicable consent state
- do not send sensitive learning content or private notes to ad providers
- do not expose raw search queries if they may contain personal information
- store ad impressions/clicks with minimal necessary data
- provide an admin-level placement kill switch

### 26.10 Admin monetization management

Admin must include a dedicated monetization area.

Recommended admin sections:

```text
/admin/monetization/overview
/admin/monetization/plans
/admin/monetization/entitlements
/admin/monetization/quotas
/admin/monetization/subscriptions
/admin/monetization/users
/admin/monetization/coupons
/admin/monetization/ads/placements
/admin/monetization/ads/performance
/admin/monetization/paywall
/admin/monetization/revenue-analytics
/admin/monetization/audit
```

Admin capabilities:

- create/edit/hide plans
- configure entitlement per plan
- configure quota limits per plan
- grant temporary quota overrides
- inspect a user’s subscription and quota usage
- manage coupons/promotions
- configure ad placements and frequency caps
- disable an ad placement globally
- review revenue analytics
- review paywall conversion analytics
- audit monetization-related admin actions

### 26.11 Monetization RBAC

Required permissions:

```text
billing.plan.view
billing.plan.manage
billing.subscription.view
billing.subscription.manage
billing.quota.view
billing.quota.override
billing.coupon.manage
ads.placement.view
ads.placement.manage
ads.performance.view
revenue.analytics.view
monetization.audit.view
```

Rules:

- only trusted admin roles can manage plans/prices/entitlements
- support staff may view subscription state but should not change plan pricing
- quota overrides must require reason text and audit log
- ad placement changes must be audited

### 26.12 Monetization analytics

Track monetization without making analytics invasive.

Events:

```text
paywall_viewed
upgrade_clicked
checkout_started
checkout_completed
checkout_failed
subscription_started
subscription_renewed
subscription_cancelled
subscription_expired
quota_limit_reached
quota_upgrade_prompt_viewed
ad_placement_rendered
ad_impression_recorded
ad_clicked
ad_blocked_by_plan
ad_blocked_by_frequency_cap
coupon_applied
admin_quota_override_created
```

Dashboards:

- MRR / ARR when payment provider is integrated
- free-to-paid conversion
- trial conversion
- churn/cancellation trend
- revenue by plan
- quota limit hit rate
- paywall impressions → upgrade clicks → checkout starts → completed purchases
- ads impressions/clicks/revenue by placement
- ad impact on learning retention and session completion
- coupon/promotion performance

### 26.13 Payment provider architecture

Use provider abstraction from the beginning.

```text
PaymentProvider
CheckoutProvider
SubscriptionSyncProvider
WebhookVerifier
InvoiceProvider
```

Initial local/dev provider:

```text
LocalBillingProvider
```

This provider can simulate checkout success/failure in development while using the real subscription and entitlement tables.

Production providers can be added later:

```text
StripeBillingProvider
AppStoreBillingProvider
GooglePlayBillingProvider
```

Do not design the app around one provider’s data model only. Store provider-specific IDs in `billing_payment_provider_customer` and `billing_subscription_event` metadata.

### 26.14 Webhook and billing safety

When real payment provider integration is added:

- verify webhook signatures
- store raw webhook event IDs to prevent duplicate processing
- process webhooks idempotently
- never trust frontend checkout success alone
- subscription state should be updated from provider webhooks or verified provider API calls
- log billing state transitions
- do not delete billing history when user cancels

### 26.15 MVP monetization scope

For MVP, implement:

- plan and entitlement tables
- quota service and backend enforcement
- free vs paid plan behavior
- admin plan/entitlement/quota management
- local/dev billing provider
- upgrade/paywall UI
- ad placement abstraction
- admin ad placement config
- monetization analytics events

Provider integrations can be phase 2:

- Stripe checkout
- real ad network integration
- coupons/promotions beyond basic manual config
- tax invoice complexity
- app-store purchase sync

### 26.16 Cursor implementation requirements

Cursor must implement monetization as a real subsystem, not as scattered UI conditions.

Minimum requirements:

- `MonetizationModule` or equivalent backend module
- `EntitlementService`
- `QuotaService`
- `BillingProvider` interface
- `LocalBillingProvider` for dev
- `AdProvider` interface
- `LocalAdProvider` or placeholder-safe ad provider for dev
- admin monetization routes and RBAC
- frontend `useEntitlement` / `useQuota` hooks that call real API
- backend guards/interceptors for entitlement/quota checks
- tests for entitlement resolution and quota consumption
- audit logs for admin monetization mutations

Forbidden:

- frontend-only paid/free gating
- hard-coded `isPremium` branches everywhere
- fake payment success without updating subscription tables
- ad components inserted directly without placement config
- blocking user-created existing content without a clear migration/paywall policy



---

## 27. Social login, referral growth, SNS sharing, and shareable learning postcards

This application should be designed as a serious BJT learning product, but it should also support organic user growth through low-friction login and beautiful, privacy-safe sharing. Social login and SNS sharing must be implemented as product-grade infrastructure, not as UI-only buttons.

### 27.1 Product decision

Social login should be supported from the beginning as an authentication option, but it should not replace email/password or passkey-ready account architecture.

Recommended MVP login methods:

- email/password or passwordless email link
- Google OAuth
- Apple OAuth if iOS/PWA/mobile users are expected
- Facebook OAuth optional, depending on target user demographics

Recommended later options:

- LINE login for Japan/Vietnam users living in Japan
- GitHub login only if developer community use cases emerge
- passkeys/WebAuthn

Rationale:

- Google login reduces onboarding friction significantly.
- Apple login is important if the product later becomes an iOS app or is used heavily on Safari/iPhone.
- Facebook login may help Vietnamese learners, but it is less essential than Google and Apple for a professional learning product.
- LINE login can be powerful in Japan, but it should be treated as Phase 2 unless the launch audience strongly depends on LINE.

### 27.2 Authentication architecture

The auth system must support multiple identity providers per user. Users must be able to link/unlink providers safely.

Do not model auth as one provider column on the user table. Use a separate identity table.

Recommended tables:

```sql
identity_provider_account
- id
- user_id
- provider -- google, apple, facebook, line, email, passkey
- provider_subject
- provider_email
- provider_email_verified
- provider_display_name
- provider_avatar_url
- raw_profile_json
- linked_at
- last_login_at
- revoked_at
- created_at
- updated_at

login_event
- id
- user_id nullable
- provider
- result -- success, failed, linked, blocked
- failure_reason nullable
- ip_hash
- user_agent_hash
- occurred_at
```

Rules:

- Match by verified email only when safe.
- If the same email exists but is not verified, require explicit account linking.
- Never expose raw OAuth profile data to the frontend.
- Do not trust provider avatar forever; copy user-selected avatar to object storage if needed.
- All login/link/unlink events must be auditable.
- A user must not be able to unlink the last available login method without adding another method first.

### 27.3 Account linking UX

User settings should include `Connected accounts`:

- Google: connected / connect / disconnect
- Apple: connected / connect / disconnect
- Facebook: connected / connect / disconnect
- LINE: future-ready
- Email login: enabled / disabled
- Passkey: future-ready

UX rules:

- Connecting an account should show clear provider branding.
- Disconnecting an account should warn if it is the last login method.
- If a provider email matches an existing account, use a secure confirmation flow.
- If account linking fails, show a recoverable error, not a dead end.

### 27.4 Admin management for authentication

Admin must include authentication diagnostics, but only for authorized roles.

Admin pages:

| Page | Purpose |
|---|---|
| `/admin/users/:id/identities` | See connected login providers for a user |
| `/admin/auth/login-events` | Review login events and provider failures |
| `/admin/auth/provider-settings` | Enable/disable providers and configure rollout |
| `/admin/auth/security` | See suspicious login patterns and blocked attempts |

RBAC permissions:

- `auth.identity.view`
- `auth.identity.manage`
- `auth.provider.manage`
- `auth.login_event.view`
- `auth.security.view`

Privacy:

- Admin must not see provider access tokens.
- OAuth tokens must be encrypted at rest if stored; preferably avoid storing long-lived tokens unless required.
- Login event IP/user-agent should be hashed or minimized according to privacy policy.

### 27.5 SNS sharing strategy

Sharing should become a native growth loop. The product should let users share achievements, study progress, battle results, daily Japanese phrases, and generated learning postcards.

Shareable moments:

| Moment | Example share |
|---|---|
| Daily streak | “7日連続でBJT日本語を学習中” |
| Flashcard milestone | “今日50枚復習しました” |
| BJT quiz result | “ビジネス敬語セクションで85%達成” |
| Battle win | “BJT Battleで3連勝” |
| Skill mastery | “会議表現スキルがLevel 4になりました” |
| Daily phrase | “今日のビジネス日本語: 念のため確認させてください” |
| News-to-card | “NHKニュースから5枚のカードを作成” |
| Comeback mode | “3日ぶりに学習再開” |

Supported share targets:

- native Web Share API
- copy link
- download postcard image
- X/Twitter
- Facebook
- LINE
- LinkedIn for professional BJT achievements

Implementation rule:

- Sharing must work even if external SNS SDKs are not configured.
- Web Share API + generated image download + copy link must be the baseline.
- SNS-specific integrations should be provider abstractions.

### 27.6 Shareable postcard generator

The application should generate visually polished share cards/postcards. These should look like elegant Japanese study achievement cards, not generic screenshots.

Recommended postcard types:

| Type | Purpose |
|---|---|
| `achievement_card` | streak, level-up, milestone |
| `bjt_score_card` | quiz/mock test result |
| `battle_result_card` | battle win/loss/rematch invite |
| `daily_phrase_card` | phrase of the day |
| `news_learning_card` | learned from NHK/news |
| `skill_radar_card` | monthly progress snapshot |
| `invitation_card` | referral or challenge invitation |

Postcard design principles:

- Japanese minimal premium design
- warm off-white background
- indigo/matcha/sakura accent palette
- clear Japanese phrase typography with optional furigana
- small Vietnamese explanation when locale is Vietnamese
- no clutter
- strong visual hierarchy
- tasteful badge/stamp style elements
- optional QR code/deep link
- product logo and domain subtly placed

Generated image sizes:

- square: 1080x1080 for Instagram/Facebook feed
- portrait: 1080x1350 for mobile feed
- story: 1080x1920 for story/reel format
- OG image: 1200x630 for link preview

Recommended rendering approach:

- Use server-side image generation via Satori/Resvg or equivalent.
- Do not rely on client screenshot hacks for core share images.
- Store generated share images in object storage with short-to-medium retention.
- Deduplicate by share event hash when possible.

### 27.7 Share page and Open Graph

Each shareable item should have a public, privacy-safe landing page.

Example routes:

```text
/share/achievement/:shareId
/share/bjt-result/:shareId
/share/battle/:shareId
/share/daily-phrase/:shareId
/share/invite/:shareId
```

Each share page must include:

- Open Graph title
- Open Graph description
- Open Graph image
- Twitter/X card metadata
- canonical URL
- app install/open CTA
- privacy-safe summary only
- CTA to start learning or join challenge

Do not expose:

- detailed mistake history
- private deck content
- exact learning schedule
- email/name unless user explicitly permits
- private battle opponent data unless both sides allow public sharing

### 27.8 Referral and invitation system

Social sharing should connect to referral growth, but without dark patterns.

Recommended tables:

```sql
referral_code
- id
- owner_user_id
- code
- campaign
- max_uses nullable
- used_count
- active
- created_at
- expires_at

referral_event
- id
- referral_code_id
- inviter_user_id
- invitee_user_id nullable
- event_type -- link_opened, signup_started, signup_completed, first_review_completed, converted_paid
- metadata_json
- occurred_at
```

Referral rewards should be simple and learning-friendly:

- extra image-search quota
- temporary premium trial
- bonus postcard themes
- unlock special badge
- additional mock test attempt

Avoid rewards that harm learning quality or create spam.

### 27.9 Share privacy and consent

Before first share, show a simple confirmation:

- what will be shared
- whether profile display name/avatar appears
- whether result percentage appears
- whether the share link is public
- how to delete the share later

User settings:

- allow public profile in share cards
- show avatar in share cards
- show display name in share cards
- show exact score or only badge/rank
- allow battle result sharing
- allow ranking/leaderboard visibility

Every public share item should support deletion or disabling by the owner.

### 27.10 Share analytics

Track sharing as a growth funnel:

Events:

- `share_card_generated`
- `share_card_downloaded`
- `share_link_copied`
- `share_target_clicked`
- `share_page_viewed`
- `share_signup_clicked`
- `share_signup_completed`
- `referral_reward_granted`

Admin analytics:

| Metric | Purpose |
|---|---|
| share cards generated | engagement signal |
| shares by type | which achievements motivate users |
| shares by target | LINE/X/Facebook/etc effectiveness |
| share page CTR | landing page quality |
| signup conversion | referral effectiveness |
| paid conversion | monetization impact |
| viral coefficient proxy | growth potential |

### 27.11 Admin sharing management

Admin pages:

| Page | Purpose |
|---|---|
| `/admin/growth/share-templates` | manage share card templates |
| `/admin/growth/share-campaigns` | manage campaigns and CTA copy |
| `/admin/growth/referrals` | referral codes and usage |
| `/admin/growth/share-analytics` | share funnel analytics |
| `/admin/growth/moderation` | disable inappropriate public share pages |

Admin should be able to:

- preview postcard templates in multiple locales
- enable/disable share types
- configure CTA copy
- configure default privacy settings
- disable a public share page
- inspect aggregate share performance

RBAC permissions:

- `growth.share_template.view`
- `growth.share_template.manage`
- `growth.referral.view`
- `growth.referral.manage`
- `growth.share_analytics.view`
- `growth.share_moderation.manage`

### 27.12 Cursor implementation requirements

Cursor must implement this as production-grade growth infrastructure, not only share buttons.

Minimum MVP deliverables:

- Google OAuth provider abstraction
- account linking table/schema
- connected accounts UI
- public share page model
- share card generation service interface
- at least 3 postcard templates: streak, BJT quiz result, daily phrase
- Web Share API support
- copy link support
- download image support
- basic referral code model
- admin share template preview page
- share analytics events
- privacy settings for public sharing

Provider abstractions:

```text
AuthProvider
OAuthProvider
ShareImageRenderer
SocialShareTargetProvider
ReferralRewardProvider
```

Forbidden shortcuts:

- Do not implement fake social login buttons without backend OAuth flow.
- Do not expose private learning data in public share URLs.
- Do not generate share images by screenshotting arbitrary private pages.
- Do not require external SNS SDK for baseline sharing.
- Do not hard-code share templates in random React components; use template config/model.
- Do not make referral rewards change entitlements without audit trail.


---

## 28. Reading Assist — Tap-to-Understand Japanese Text

Because NihonGo BJT serves learners at many levels, the application must provide a site-wide Japanese reading assist system. Users should be able to click, tap, or hover over Japanese text to see pronunciation, meaning, examples, and learning actions without leaving the current screen.

This feature is not a decorative tooltip. It is a core learning layer that turns the whole website into a living Japanese learning environment.

### 28.1 Product goal

The goal is to reduce friction for learners who encounter unknown Japanese words across the app:

- dictionary examples
- grammar explanations
- BJT quiz explanations
- Daily Life Hub cards
- NHK/news-derived content
- battle messages and result screens
- admin-authored lesson content
- achievement postcards
- onboarding and dashboard text

Users should never feel blocked because they cannot read a kanji word. The app should provide help at the exact moment of confusion.

### 28.2 Interaction model

Support multiple interaction modes because desktop and mobile behavior differ.

| Device / context | Interaction | Behavior |
|---|---|---|
| Desktop | hover | show compact reading tooltip after short delay |
| Desktop | click | pin detailed word card |
| Mobile | tap | open bottom sheet word card |
| Keyboard | focus + Enter | open word card for accessibility |
| Reading mode | furigana toggle | show furigana above Japanese text |
| Exam mode | disabled or limited | do not reveal answer during active test unless configured as practice mode |

### 28.3 Reading assist modes

Users can choose how much assistance they want.

| Mode | Description |
|---|---|
| Off | no annotation except explicitly marked vocabulary |
| Hover / tap only | default recommended mode |
| Furigana for difficult words | show furigana only for kanji above user level |
| Full furigana | show furigana for all parsed kanji terms |
| Beginner mode | show furigana + Vietnamese meaning for more terms |
| Exam practice mode | show only after answering, not during timed question |

The default should be `hover_tap_only` to keep the UI clean and premium.

### 28.4 Word card content

When the user opens a word card, show:

- surface form
- reading in kana
- romaji only if user enabled romaji
- Vietnamese meaning
- Japanese simple explanation when available
- part of speech
- JLPT/BJT/business level if available
- example sentence
- highlight of the original sentence
- related kanji
- related grammar if available
- action buttons:
  - Add to flashcard
  - Add sentence to flashcard
  - Open dictionary detail
  - Listen pronunciation if audio exists
  - Mark as known
  - Report incorrect reading/meaning

Example word card:

```text
確認（かくにん）
Meaning: xác nhận, kiểm tra lại
Business nuance: dùng nhiều trong email và họp
Example: 念のため確認させてください。
Actions: Add word / Add sentence / Open detail
```

### 28.5 Japanese text parsing architecture

Do not wrap every character manually in React components. Use a text processing pipeline.

Recommended architecture:

```text
JapaneseTextRenderer
→ JapaneseTextAnalyzer
→ TokenizationProvider
→ DictionaryLookupService
→ UserLevelAssistPolicy
→ AnnotatedTextRenderer
→ ReadingAssistTooltip / BottomSheet
```

### 28.6 Tokenization provider

The system should support provider abstraction.

| Provider | Purpose |
|---|---|
| Local lightweight tokenizer | MVP fallback for known dictionary terms |
| Kuromoji / Sudachi-compatible tokenizer | richer Japanese tokenization |
| Server-side analyzer | stable production behavior and caching |
| Precomputed annotation | for CMS content, quiz explanations, news-derived content |

Cursor must not hard-code a naive regex-only solution as the final implementation. Regex may be used only as a fallback for detecting Japanese text ranges.

### 28.7 Database additions

Add a dedicated reading assist schema or models.

Suggested tables:

```sql
reading_assist_cache
reading_assist_user_preference
reading_assist_known_term
reading_assist_interaction_event
content_text_annotation
content_text_annotation_token
```

#### `reading_assist_cache`

Stores analyzed text result to avoid repeated tokenization.

| Field | Purpose |
|---|---|
| id | primary key |
| text_hash | deterministic hash of normalized text |
| locale | UI/explanation locale |
| source_type | dictionary, grammar, quiz, daily, news, admin, etc. |
| source_id | optional source id |
| analyzer_version | tokenizer / dictionary version |
| tokens_json | token list and metadata |
| created_at | created timestamp |
| expires_at | optional cache expiry |

#### `reading_assist_user_preference`

| Field | Purpose |
|---|---|
| user_id | user |
| assist_mode | off, hover_tap_only, difficult_only, full_furigana, beginner |
| meaning_language | vi, ja, en-ready |
| show_romaji | boolean |
| show_furigana | boolean |
| known_word_policy | hide, dim, show |
| exam_mode_policy | disabled_during_exam, allow_after_answer |

#### `reading_assist_known_term`

Allows personalization.

| Field | Purpose |
|---|---|
| user_id | user |
| term_key | normalized term key |
| reading | reading |
| status | known, learning, ignored |
| confidence | optional mastery score |
| updated_at | timestamp |

#### `content_text_annotation`

Precomputed annotations for long content such as news and admin CMS lessons.

| Field | Purpose |
|---|---|
| content_id | content reference |
| content_type | news, grammar, example, quiz_explanation, daily_item |
| text_hash | normalized text hash |
| analyzer_version | analyzer version |
| created_at | timestamp |

### 28.8 API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/reading-assist/analyze` | analyze arbitrary text and return tokens |
| GET | `/reading-assist/preferences/me` | get current assist preferences |
| PUT | `/reading-assist/preferences/me` | update assist preferences |
| POST | `/reading-assist/known-terms` | mark term as known/learning/ignored |
| POST | `/reading-assist/add-to-flashcard` | create card from selected token/sentence |
| GET | `/admin/reading-assist/reports` | admin reports on unknown/failed terms |
| POST | `/admin/reading-assist/rebuild-cache` | rebuild annotation cache |

### 28.9 Frontend components

Reusable components:

```text
JapaneseText
AnnotatedJapaneseText
ReadingAssistProvider
ReadingAssistTooltip
ReadingAssistBottomSheet
FuriganaText
WordCardPopover
AddToFlashcardFromTextButton
ReadingAssistPreferencePanel
```

Usage example:

```tsx
<JapaneseText
  text="念のため確認させてください。"
  sourceType="business_phrase"
  sourceId={phrase.id}
  assistMode="user_default"
/>
```

### 28.10 UX rules

- Tooltips must be subtle and not obscure the main text.
- Delay hover tooltip slightly to avoid flickering.
- On mobile, prefer bottom sheet instead of tiny popover.
- Provide a setting to disable the feature.
- Do not underline every Japanese word too aggressively.
- Use a soft dotted underline only when needed.
- Respect user level: beginner users get more help, advanced users get less noise.
- Support keyboard navigation and screen readers.
- In timed BJT exam mode, do not reveal meaning before answering unless it is a practice/help mode.

### 28.11 Learning loop integration

Reading assist should connect directly to learning actions.

Important flows:

```text
Unknown word on page
→ user clicks word
→ sees reading and meaning
→ adds word/sentence to flashcard
→ SRS schedules review
→ analytics tracks assist-to-learning conversion
```

```text
User repeatedly opens the same word
→ system suggests adding it to Mistake Notebook or flashcard
```

```text
User marks term as known
→ future text reduces visual assistance for that term
```

### 28.12 Admin and content quality

Admin should have a Reading Assist section:

```text
/admin/reading-assist/overview
/admin/reading-assist/unknown-terms
/admin/reading-assist/failed-tokenization
/admin/reading-assist/dictionary-gaps
/admin/reading-assist/reported-meanings
/admin/reading-assist/cache-status
```

Admin metrics:

- most clicked unknown words
- terms with missing reading
- terms with missing Vietnamese meaning
- terms frequently added to flashcards
- failed tokenization cases
- reported incorrect meanings
- assist usage by learner level
- assist-to-flashcard conversion rate

This helps improve dictionary and content quality over time.

### 28.13 Analytics events

Track reading assist events:

```text
reading_assist_tooltip_viewed
reading_assist_word_card_opened
reading_assist_furigana_toggled
reading_assist_term_marked_known
reading_assist_add_to_flashcard_clicked
reading_assist_dictionary_detail_opened
reading_assist_report_submitted
reading_assist_cache_miss
reading_assist_cache_rebuilt
```

Never log entire private user text if the source is user-generated private content. Use text hash and token metadata where possible.

### 28.14 Performance requirements

This feature can become expensive if implemented poorly. Cursor must follow these rules:

- cache analyzed text by normalized text hash
- do not analyze the same text repeatedly on every render
- use server-side precomputation for long CMS/news content
- lazy-load tooltip details
- virtualize long annotated content if needed
- do not wrap extremely long documents token-by-token without chunking
- avoid hydration mismatch in Next.js rendering
- keep rendering accessible and stable

### 28.15 Monetization and entitlement considerations

Reading assist should be available to free users because it is essential for learning. However advanced features may be plan-limited.

Recommended model:

| Feature | Free | Paid |
|---|---|---|
| click/tap reading and basic meaning | yes | yes |
| full furigana mode | yes | yes |
| add limited words to flashcards | quota-limited | higher/unlimited quota |
| AI-generated explanations | quota-limited | higher quota |
| advanced example generation | limited | paid |
| batch annotation for imported text | limited | paid/admin |

Do not make basic reading support a hard paywall because it harms beginner onboarding.

### 28.16 Cursor implementation requirements

Cursor must implement this as a production-grade vertical slice:

- backend analyzer endpoint with typed DTOs
- user preference persistence
- cache table or Prisma model
- frontend provider and reusable text component
- desktop tooltip and mobile bottom sheet behavior
- add-to-flashcard integration
- basic admin report screen
- tests for analyzer, preference, permission, and rendering behavior
- analytics event tracking

Temporary fallback allowed:

- use existing dictionary tables as primary lookup
- use a simple tokenizer only as a fallback
- use LocalReadingAssistProvider before integrating a stronger Japanese tokenizer

Forbidden:

- no pure CSS-only tooltip with hard-coded readings
- no frontend-only fake dictionary
- no wrapping every kanji character as a separate word without tokenization
- no leaking private user text into analytics logs
- no enabling answer-revealing assist during active BJT exam mode

---
---

## 29. Learning Path Engine — Adaptive Curriculum and Competency-Based Progression

The current spec has BJT levels, SRS flashcards, daily missions, and skill radar, but lacks a **structured curriculum engine**. Without it, users have scattered content but no coherent learning journey. The Learning Path Engine is the missing backbone that ties all content, skills, and assessments into a personalized, structured path from J5 to J1+.

### 29.1 Product goal

The Learning Path Engine answers the learner's most important question: **"What should I study next, and why?"**

It provides:

- Structured curricula organized by BJT level, skill domain, and real-world scenarios.
- Prerequisite dependencies between learning units so content is sequenced correctly.
- Adaptive path selection based on placement test, skill mastery, and learning behavior.
- Competency-based progression: advance when mastery is demonstrated, not just when content is consumed.
- Personalized recommendations that adapt to weakness, schedule, and goals.
- Integration with flashcards, quizzes, daily missions, and analytics.

### 29.2 Core concepts

| Concept | Definition |
|---|---|
| **Learning Path** | A structured curriculum from start to finish for a goal (e.g., "J5→J3 Business Japanese"). A path contains ordered stages. |
| **Path Stage** | A major milestone within a path (e.g., "Stage 1: Foundation Vocabulary", "Stage 5: Business Email Mastery"). Contains ordered units. |
| **Learning Unit** | An atomic lesson/activity. Can be: vocabulary set, grammar lesson, listening exercise, reading passage, keigo practice, BJT mock section, or a curated combination. |
| **Prerequisite** | A dependency between units or stages. Unit B requires completion/mastery of Unit A. |
| **Competency** | A measurable skill dimension (e.g., `vocabulary.business.j3`, `keigo.email`, `listening.meeting`). Tracked per user. |
| **Mastery Threshold** | The minimum competency score required to unlock the next unit/stage. |
| **Path Assignment** | A user's enrollment in a path, with tracked progress. |
| **Adaptive Sequencer** | The algorithm that decides what the user should study next based on their current competency, schedule, and goals. |

### 29.3 Path types

| Path type | Description | Example |
|---|---|---|
| `bjt_level` | Full curriculum for a BJT level | "BJT J3 Complete Path" |
| `skill_focused` | Deep-dive into one skill domain | "Business Keigo Mastery" |
| `scenario_based` | Learn through real-world situations | "First 90 Days at Japanese Company" |
| `exam_prep` | Focused BJT test preparation | "BJT J2 Mock Exam Sprint (4 weeks)" |
| `remediation` | Auto-generated from weakness analysis | "Your Weak Points: Listening + Keigo" |
| `custom` | Admin-created or user-assembled | Custom learning journey |
| `onboarding` | First-time learner guided path | "Quick Start: Business Japanese Basics" |

### 29.4 PostgreSQL schema

```sql
CREATE SCHEMA IF NOT EXISTS curriculum;

-- Learning Path definition
CREATE TABLE curriculum.learning_path (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  path_type TEXT NOT NULL, -- bjt_level, skill_focused, scenario_based, exam_prep, remediation, custom, onboarding
  status TEXT NOT NULL DEFAULT 'draft', -- draft, published, archived
  target_bjt_band TEXT, -- J5, J4, J3, J2, J1, J1+
  difficulty_level SMALLINT NOT NULL DEFAULT 1, -- 1-10
  estimated_hours NUMERIC(6,1),
  estimated_weeks SMALLINT,
  prerequisite_path_id UUID REFERENCES curriculum.learning_path(id),
  cover_image_asset_id UUID,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_adaptive BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Localized path text
CREATE TABLE curriculum.learning_path_locale (
  path_id UUID NOT NULL REFERENCES curriculum.learning_path(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  learning_outcomes TEXT[], -- array of outcome descriptions
  PRIMARY KEY (path_id, locale)
);

-- Path Stage (major milestone)
CREATE TABLE curriculum.path_stage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID NOT NULL REFERENCES curriculum.learning_path(id) ON DELETE CASCADE,
  stage_number SMALLINT NOT NULL,
  code TEXT NOT NULL,
  unlock_rule TEXT NOT NULL DEFAULT 'sequential', -- sequential, mastery_threshold, manual, time_based
  mastery_threshold NUMERIC(5,4) DEFAULT 0.70,
  estimated_hours NUMERIC(5,1),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(path_id, stage_number)
);

CREATE TABLE curriculum.path_stage_locale (
  stage_id UUID NOT NULL REFERENCES curriculum.path_stage(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  milestone_label TEXT, -- "Congratulations! You can now handle basic business introductions."
  PRIMARY KEY (stage_id, locale)
);

-- Learning Unit (atomic lesson/activity)
CREATE TABLE curriculum.learning_unit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  unit_type TEXT NOT NULL, -- vocabulary_set, grammar_lesson, listening_exercise, reading_passage, keigo_practice, bjt_mock_section, mixed_practice, scenario_roleplay, review_session
  stage_id UUID NOT NULL REFERENCES curriculum.path_stage(id) ON DELETE CASCADE,
  unit_order SMALLINT NOT NULL,
  estimated_minutes SMALLINT,
  xp_reward SMALLINT NOT NULL DEFAULT 10,
  required_mastery NUMERIC(5,4) DEFAULT 0.70,
  max_attempts SMALLINT, -- null = unlimited
  content_config JSONB NOT NULL DEFAULT '{}', -- configures what content to load
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stage_id, unit_order)
);

CREATE TABLE curriculum.learning_unit_locale (
  unit_id UUID NOT NULL REFERENCES curriculum.learning_unit(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  instruction TEXT, -- what the learner should do
  completion_message TEXT,
  PRIMARY KEY (unit_id, locale)
);

-- Unit content links (what content this unit teaches)
CREATE TABLE curriculum.unit_content_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES curriculum.learning_unit(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL, -- lexeme, kanji, grammar_point, example_sentence, bjt_question
  content_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'primary', -- primary, supplementary, review, challenge
  sort_order SMALLINT NOT NULL DEFAULT 0,
  UNIQUE(unit_id, content_type, content_id)
);

-- Prerequisite graph
CREATE TABLE curriculum.unit_prerequisite (
  unit_id UUID NOT NULL REFERENCES curriculum.learning_unit(id) ON DELETE CASCADE,
  prerequisite_unit_id UUID NOT NULL REFERENCES curriculum.learning_unit(id) ON DELETE CASCADE,
  prerequisite_type TEXT NOT NULL DEFAULT 'completion', -- completion, mastery, exposure
  required_mastery NUMERIC(5,4), -- only for mastery type
  PRIMARY KEY (unit_id, prerequisite_unit_id),
  CHECK (unit_id != prerequisite_unit_id)
);

-- Competency definitions
CREATE TABLE curriculum.competency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- e.g. vocabulary.business.j3, keigo.email, listening.meeting
  category TEXT NOT NULL, -- vocabulary, kanji, grammar, keigo, listening, reading, writing, business_culture
  subcategory TEXT,
  bjt_relevance NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  description_vi TEXT,
  description_ja TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Which competencies a unit develops
CREATE TABLE curriculum.unit_competency (
  unit_id UUID NOT NULL REFERENCES curriculum.learning_unit(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES curriculum.competency(id) ON DELETE CASCADE,
  weight NUMERIC(3,2) NOT NULL DEFAULT 1.0, -- how much this unit contributes
  PRIMARY KEY (unit_id, competency_id)
);

-- User path enrollment and progress
CREATE TABLE curriculum.user_path_assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  path_id UUID NOT NULL REFERENCES curriculum.learning_path(id),
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, completed, abandoned
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  current_stage_id UUID REFERENCES curriculum.path_stage(id),
  current_unit_id UUID REFERENCES curriculum.learning_unit(id),
  overall_progress NUMERIC(5,4) NOT NULL DEFAULT 0,
  total_xp BIGINT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, path_id)
);

-- Per-unit progress tracking
CREATE TABLE curriculum.user_unit_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  unit_id UUID NOT NULL REFERENCES curriculum.learning_unit(id),
  status TEXT NOT NULL DEFAULT 'locked', -- locked, available, in_progress, completed, mastered, skipped
  attempts INTEGER NOT NULL DEFAULT 0,
  best_score NUMERIC(5,4),
  last_score NUMERIC(5,4),
  mastery_level NUMERIC(5,4) NOT NULL DEFAULT 0,
  xp_earned BIGINT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_attempted_at TIMESTAMPTZ,
  time_spent_seconds BIGINT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, unit_id)
);

-- User competency record (aggregated from unit progress)
CREATE TABLE curriculum.user_competency_record (
  user_id UUID NOT NULL,
  competency_id UUID NOT NULL REFERENCES curriculum.competency(id),
  mastery_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  last_assessed_at TIMESTAMPTZ,
  assessment_count INTEGER NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'stable', -- improving, stable, declining
  metadata JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, competency_id)
);

-- Adaptive path recommendation log
CREATE TABLE curriculum.path_recommendation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  recommended_path_id UUID NOT NULL REFERENCES curriculum.learning_path(id),
  reason_code TEXT NOT NULL, -- placement_result, weakness_detected, goal_change, admin_assigned, onboarding
  reason_detail TEXT,
  confidence NUMERIC(5,4),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, declined, expired
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- Unit attempt detail (for scoring and analytics)
CREATE TABLE curriculum.unit_attempt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  unit_id UUID NOT NULL REFERENCES curriculum.learning_unit(id),
  attempt_number INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  score NUMERIC(5,4),
  time_spent_seconds INTEGER,
  answers JSONB NOT NULL DEFAULT '{}',
  feedback JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (started_at);

CREATE INDEX idx_unit_attempt_user ON curriculum.unit_attempt (user_id, started_at DESC);
CREATE INDEX idx_user_path_assignment_active ON curriculum.user_path_assignment (user_id) WHERE status = 'active';
CREATE INDEX idx_user_unit_progress_available ON curriculum.user_unit_progress (user_id, status) WHERE status IN ('available', 'in_progress');
CREATE INDEX idx_user_competency_low ON curriculum.user_competency_record (user_id, mastery_score) WHERE mastery_score < 0.5;
```

### 29.5 Adaptive sequencing algorithm

The sequencer decides what the user should study next. It must balance:

1. **Prerequisite satisfaction**: never suggest a unit whose prerequisites are incomplete.
2. **Spaced repetition alignment**: if SRS cards are due, prioritize review before new content.
3. **Weakness targeting**: prioritize units that address the user's weakest competencies.
4. **Time budget**: respect the user's daily goal and session length preference.
5. **Variety**: avoid monotonous sessions (e.g., 30 vocabulary sets in a row).
6. **BJT exam proximity**: if exam date is set, shift toward exam-relevant content.

#### Sequencer logic (pseudocode)

```text
function getNextStudyPlan(userId, sessionConfig):
  1. Load active path assignment
  2. Load all unit progress for current stage
  3. Filter units where status = 'available' or 'in_progress'
  4. If SRS due cards > threshold → insert review block first
  5. Sort available units by:
     a. Units addressing weakest competency (weight × inverse mastery)
     b. Units with closest prerequisite chain (prefer natural order)
     c. Units matching user's preferred activity type if set
     d. Variety penalty: reduce score of units with same type as last N completed
  6. Build session plan:
     - Warm-up: 2-3 review items from previous stage
     - Core: 1-2 new units
     - Practice: quick quiz or flashcard set from unit content
     - Cool-down: preview of next unit or daily life phrase
  7. Respect time budget from sessionConfig
  8. Return ordered plan with estimated minutes per block
```

#### Mastery calculation

```text
unit_mastery = weighted_average(
  quiz_score_on_unit_content × 0.35,
  srs_retention_rate_for_unit_cards × 0.30,
  response_speed_normalized × 0.10,
  repetition_consistency × 0.15,
  time_since_last_review_penalty × 0.10
)
```

#### Competency aggregation

```text
competency_mastery = weighted_average(
  for each unit linked to this competency:
    unit.mastery_level × unit_competency.weight
) adjusted by recency decay
```

#### Stage unlock rules

| Rule | Behavior |
|---|---|
| `sequential` | Complete all units in the current stage to unlock next |
| `mastery_threshold` | Average mastery of stage units >= threshold to unlock |
| `partial_completion` | Complete N% of units (e.g., 80%) to unlock |
| `time_based` | Unlock after N days regardless of mastery |
| `manual` | Admin or user explicitly unlocks |

### 29.6 Path generation from placement test

After the onboarding placement test (Section 21.7):

1. Map placement answers to competency scores.
2. Identify the closest matching BJT level path.
3. Skip stages/units where competency already exceeds mastery threshold.
4. Mark skipped units as `skipped` with reason `placement_test`.
5. Set the user's starting point at the first non-mastered stage.
6. Generate a `path_recommendation` with `reason_code = 'placement_result'`.

### 29.7 Remediation path generation

When analytics detect weakness:

1. Identify competencies with mastery < 0.4 and declining trend.
2. Find units that train those competencies.
3. Create or select a remediation path.
4. Show recommendation: "We noticed your keigo skills need attention. Here's a focused 2-week path."
5. User can accept, modify, or decline.

### 29.8 Integration with existing systems

| System | Integration |
|---|---|
| **SRS/Flashcard** | Units generate flashcard decks automatically. SRS review status feeds into unit mastery calculation. |
| **BJT Quiz** | Quiz results update competency records. Failed questions link back to relevant units for remediation. |
| **Daily Missions** | Missions are generated from the current active path unit. "Complete Unit 3.2" or "Review Stage 2 vocabulary." |
| **Skill Radar** | Competency records power the skill radar chart directly. |
| **Analytics** | Path progress, drop-off, and completion feed into admin analytics dashboards. |
| **Achievements** | Stage completions and path milestones trigger achievements. |
| **Smart Coaching** | Coaching messages reference path progress: "You're 3 units away from completing Stage 4!" |
| **Daily Life Hub** | Daily content can be linked to current path theme (e.g., if user is on "Business Email" stage, daily phrase focuses on email). |

### 29.9 API endpoints

#### Learner APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/learning-paths` | public | Browse available paths |
| GET | `/learning-paths/:id` | public | Path detail with stages and units |
| GET | `/learning-paths/recommended` | JWT | Personalized path recommendations |
| POST | `/learning-paths/:id/enroll` | JWT | Enroll in a path |
| DELETE | `/learning-paths/:id/unenroll` | JWT | Leave a path |
| GET | `/learning-paths/my` | JWT | My active/completed paths |
| GET | `/learning-paths/my/:assignmentId/progress` | JWT | Detailed progress for assignment |
| GET | `/learning-paths/my/next-session` | JWT | Get next study session plan from sequencer |
| POST | `/learning-paths/units/:unitId/start` | JWT | Start a unit |
| POST | `/learning-paths/units/:unitId/complete` | JWT | Complete a unit with score |
| GET | `/learning-paths/units/:unitId/content` | JWT | Load unit content (vocabulary, grammar, questions, etc.) |
| GET | `/competencies/me` | JWT | My competency profile |
| GET | `/competencies/me/radar` | JWT | Skill radar data from competencies |
| GET | `/competencies/me/weaknesses` | JWT | Weakest competencies with recommended actions |

#### Admin APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/learning-paths` | admin.content | List all paths |
| POST | `/admin/learning-paths` | admin.content | Create path |
| PUT | `/admin/learning-paths/:id` | admin.content | Update path |
| POST | `/admin/learning-paths/:id/publish` | admin.content | Publish path |
| GET | `/admin/learning-paths/:id/stages` | admin.content | Manage stages |
| POST | `/admin/learning-paths/:id/stages` | admin.content | Create stage |
| PUT | `/admin/learning-paths/stages/:stageId` | admin.content | Update stage |
| GET | `/admin/learning-paths/stages/:stageId/units` | admin.content | Manage units |
| POST | `/admin/learning-paths/stages/:stageId/units` | admin.content | Create unit |
| PUT | `/admin/learning-paths/units/:unitId` | admin.content | Update unit |
| POST | `/admin/learning-paths/units/:unitId/content-links` | admin.content | Link content to unit |
| GET | `/admin/competencies` | admin.content | Manage competencies |
| POST | `/admin/competencies` | admin.content | Create competency |
| GET | `/admin/learning-paths/analytics` | viewer.analytics | Path analytics dashboard |
| GET | `/admin/learning-paths/:id/analytics` | viewer.analytics | Per-path analytics |
| POST | `/admin/learning-paths/generate-remediation` | admin.content | Generate remediation path from weakness data |
| GET | `/admin/learning-paths/prerequisite-graph/:pathId` | admin.content | Visualize prerequisite DAG |

### 29.10 Learner UI

#### Path catalog `/learning-paths`

- Browse published paths as cards with cover image, title, BJT level, estimated time, difficulty.
- Filter by path type, BJT level, skill domain.
- Show "Recommended for you" section based on placement/competency.
- Show enrollment status and progress bar for enrolled paths.

#### Path detail `/learning-paths/:id`

- Hero with path title, description, learning outcomes.
- Visual stage map (vertical timeline or horizontal roadmap).
- Each stage shows: title, unit count, estimated time, unlock status.
- Expand stage to see units with status icons (locked/available/completed/mastered).
- Progress bar and mastery indicators.
- "Continue Learning" button jumps to next available unit.
- Prerequisite path shown if applicable.

#### Unit view `/learning-paths/units/:unitId`

- Unit instruction and content.
- Content rendered based on unit_type:
  - `vocabulary_set`: card grid with pronunciation, meaning, example.
  - `grammar_lesson`: explanation + pattern + examples + mini quiz.
  - `listening_exercise`: audio player + comprehension questions.
  - `reading_passage`: Japanese text with reading assist + questions.
  - `keigo_practice`: scenario + choose appropriate expression.
  - `bjt_mock_section`: timed section from BJT format.
  - `mixed_practice`: combination of vocabulary + grammar + listening.
  - `scenario_roleplay`: situational dialogue with choices.
  - `review_session`: SRS review of unit content.
- Progress indicator within unit.
- Score/mastery display after completion.
- "Next Unit" navigation.

#### Study session from path `/study/session`

When user clicks "Continue Learning" or "Start Today's Session":

1. Sequencer generates session plan.
2. Show plan preview: "Today: 3 review items → Unit 4.2 Grammar → 5 flashcards → Daily phrase"
3. Execute each block.
4. Show session summary with mastery updates.
5. Show encouragement and next session preview.

#### Competency radar `/analytics/skills`

- Radar chart powered by `user_competency_record`.
- Each axis = one competency category.
- Click on axis → drill into that competency → see related units, weak areas, recommended practice.
- Compare with previous period.

#### Path roadmap `/analytics/roadmap`

- Visual J5→J1+ roadmap showing all enrolled paths.
- Current position highlighted.
- Estimated time to next milestone.
- Completed stages as checkpoints with dates.

### 29.11 Admin UI

#### Path builder `/admin/learning-paths/builder`

- Drag-and-drop stage ordering.
- Unit ordering within stages.
- Content linking: search and link lexemes, grammar, kanji, questions to units.
- Prerequisite graph editor: visual DAG for unit dependencies.
- Competency assignment to units.
- Preview as learner.
- Localization: side-by-side VI/JA/EN editing.
- Publish workflow: draft → review → published.

#### Path analytics `/admin/analytics/learning-paths`

| Metric | Purpose |
|---|---|
| Enrollment rate | How many users start each path |
| Completion rate | How many finish |
| Drop-off by stage | Where users abandon |
| Average time per unit | Content difficulty signal |
| Mastery distribution | How well users learn |
| Remediation path acceptance | Do users take recommended paths |
| Competency improvement | Pre/post competency delta |
| Path-to-quiz correlation | Do paths improve BJT scores |

#### Prerequisite graph visualization `/admin/learning-paths/prerequisite-graph/:pathId`

- Interactive DAG showing all units and their prerequisites.
- Color-coded by stage.
- Highlight circular dependency warnings.
- Click unit to edit.

### 29.12 Seed data

Cursor must seed at least:

- 3 default paths: "BJT J5 Foundation", "BJT J4 Business Basics", "BJT J3 Professional"
- Each path with 3-5 stages
- Each stage with 3-8 units
- 15-20 competencies covering vocabulary, kanji, grammar, keigo, listening, reading, business_culture
- Unit-content links to existing seeded dictionary/grammar/kanji
- One onboarding path for new users

### 29.13 Analytics events

```text
learning_path_viewed
learning_path_enrolled
learning_path_unenrolled
learning_path_completed
learning_path_abandoned
path_stage_started
path_stage_completed
learning_unit_started
learning_unit_completed
learning_unit_failed
learning_unit_skipped
study_session_planned
study_session_plan_modified
competency_updated
competency_milestone_reached
remediation_path_recommended
remediation_path_accepted
remediation_path_declined
sequencer_plan_generated
```

### 29.14 Cursor implementation requirements

The Learning Path Engine must be a real subsystem:

- `CurriculumModule` in NestJS
- Full Prisma models for all curriculum tables
- Sequencer service with the adaptive algorithm
- Competency aggregation service
- Mastery calculation service
- Path recommendation service
- Integration hooks with SRS, quiz, daily missions
- Admin path builder UI
- Learner path catalog and unit viewer
- Competency radar component
- Path progress tracking
- Seed data for 3 default paths
- Tests for sequencer logic, mastery calculation, prerequisite validation
- Analytics event tracking

Forbidden:
- Static hardcoded paths in frontend
- Frontend-only progress tracking
- Ignoring prerequisites in the sequencer
- Paths that don't connect to real content

---

## 30. Production Infrastructure Hardening

### 30.1 Caching strategy

Redis is mentioned as cache layer but lacks concrete caching rules.

#### Cache key design

```text
Pattern: {service}:{entity}:{id}:{variant}
Examples:
  dictionary:entry:uuid-123:full
  dictionary:search:hash(query+filters):page1
  kanji:detail:uuid-456:with-strokes
  user:profile:uuid-789:summary
  srs:due-count:uuid-789:today
  path:progress:uuid-789:path-123
  daily:weather:tokyo:2026-04-27
  meili:health:status
```

#### TTL policy

| Data type | TTL | Invalidation |
|---|---|---|
| Dictionary entry detail | 1 hour | On content update via outbox event |
| Search results | 5 minutes | Time-based expiry |
| User profile summary | 15 minutes | On profile update |
| SRS due count | 2 minutes | On review submission |
| Daily widgets | 30 minutes | Time-based |
| BJT level content | 1 hour | On content publish |
| Meilisearch health | 30 seconds | Polling |
| Admin analytics aggregates | 10 minutes | On rollup completion |
| Learning path progress | 5 minutes | On unit completion |

#### Cache invalidation patterns

- **Write-through**: User profile, learning progress (write to DB + invalidate cache).
- **Event-driven**: Content updates trigger outbox event → worker invalidates relevant cache keys.
- **TTL-only**: Search results, external API snapshots (weather).
- **Cache warming**: On application startup, warm frequently accessed paths, BJT level content, and preset decks.

#### Cache stampede prevention

- Use `singleflight` pattern for concurrent cache misses on the same key.
- For expensive queries (analytics aggregates), use stale-while-revalidate with background refresh.

### 30.2 API resilience and circuit breakers

#### Circuit breaker for external services

```text
CircuitBreakerProvider
├── MeilisearchCircuitBreaker
├── WeatherApiCircuitBreaker
├── ExternalImageSearchCircuitBreaker
├── KeycloakCircuitBreaker
├── ObjectStorageCircuitBreaker
└── EmailProviderCircuitBreaker
```

States: `closed` (normal) → `open` (failing, skip calls) → `half-open` (test recovery).

Configuration per service:

| Service | Failure threshold | Reset timeout | Fallback |
|---|---|---|---|
| Meilisearch | 5 failures / 30s | 60s | PostgreSQL trigram search |
| Weather API | 3 failures / 60s | 300s | Static seasonal content |
| External image search | 3 failures / 60s | 300s | Show "search unavailable" |
| Keycloak | 5 failures / 30s | 120s | Cached JWT validation |
| Object storage | 5 failures / 30s | 60s | Return placeholder image URL |
| Email | 3 failures / 60s | 300s | Queue for retry |

#### Retry policy

```ts
interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[]; // error codes/types
}
```

Default: 3 retries, 200ms base, 5000ms max, 2x backoff.

#### Graceful degradation matrix

| Dependency down | User impact | Degraded behavior |
|---|---|---|
| Meilisearch | Search slower | Use PostgreSQL fallback, show "degraded: true" |
| Redis | Cache miss, no realtime | Direct DB queries, disable battle lobby |
| Object storage | No images/audio | Show placeholder, disable upload |
| Keycloak | No new login | Accept cached valid JWTs, block new auth |
| BullMQ workers | No background jobs | API works, imports/enrichment paused |
| Weather API | No weather widget | Show static seasonal content |

### 30.3 Database connection pooling

```yaml
# docker-compose.yml addition
pgbouncer:
  image: edoburu/pgbouncer:latest
  environment:
    DATABASE_URL: postgres://user:pass@postgres:5432/nihongo_bjt
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 200
    DEFAULT_POOL_SIZE: 25
    MIN_POOL_SIZE: 5
  ports:
    - "6432:6432"
```

Prisma connection:

```text
DATABASE_URL=postgres://user:pass@pgbouncer:6432/nihongo_bjt?pgbouncer=true
```

Rules:
- Use `transaction` pool mode for Prisma compatibility.
- Set `DEFAULT_POOL_SIZE` based on expected concurrent API connections.
- Monitor connection pool utilization in ops dashboard.

### 30.4 Security headers hardening

```ts
// NestJS middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-{dynamic}'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // for Tailwind
      imgSrc: ["'self'", "data:", "blob:", "*.minio.local", "*.s3.amazonaws.com"],
      connectSrc: ["'self'", "wss:", process.env.API_URL, process.env.MEILI_URL],
      fontSrc: ["'self'", "fonts.googleapis.com", "fonts.gstatic.com"],
      mediaSrc: ["'self'", "blob:", "*.minio.local"],
      frameSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// CORS
app.enableCors({
  origin: [process.env.WEB_URL, process.env.ADMIN_URL],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Trace-Id'],
  maxAge: 86400,
});
```

Additional security:
- Rate limit by user ID for authenticated endpoints, by IP for public.
- Request body size limit: 1MB default, 10MB for file upload endpoints.
- SQL injection protection via Prisma parameterized queries.
- XSS prevention via DOMPurify for all user-generated HTML/SVG.
- CSRF protection for cookie-based auth if used.

### 30.5 Cursor-based pagination

For large datasets, offset pagination becomes slow. Implement cursor-based pagination.

```ts
interface CursorPaginationInput {
  cursor?: string; // opaque, base64-encoded
  limit: number;   // max 100
  direction: 'forward' | 'backward';
}

interface CursorPaginationOutput<T> {
  items: T[];
  nextCursor: string | null;
  previousCursor: string | null;
  hasMore: boolean;
  totalCount?: number; // optional, expensive for large tables
}
```

Apply cursor-based pagination to:
- Dictionary search results
- Review event history
- Audit log
- Analytics event log
- Battle match history
- Admin user list (large scale)

Keep offset pagination for:
- Small admin lists (quiz templates, battle configs)
- Fixed-size content (BJT levels, grammar by level)

### 30.6 Feature flag system

```sql
CREATE TABLE ops.feature_flag (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percentage SMALLINT NOT NULL DEFAULT 0, -- 0-100
  target_user_ids UUID[] DEFAULT '{}',
  target_roles TEXT[] DEFAULT '{}',
  target_locales TEXT[] DEFAULT '{}',
  target_bjt_levels TEXT[] DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

```ts
interface FeatureFlagService {
  isEnabled(key: string, context: FeatureFlagContext): Promise<boolean>;
  getAllFlags(context: FeatureFlagContext): Promise<Record<string, boolean>>;
}
```

Initial feature flags:
- `battle.pvp.enabled`
- `weather.api.enabled`
- `external_image_search.enabled`
- `ai.card_generation.enabled`
- `reading_assist.advanced.enabled`
- `learning_path.adaptive.enabled`
- `ads.enabled`
- `billing.stripe.enabled`

Admin UI: `/admin/operations/feature-flags` with toggle, rollout slider, and target rules.

#### 30.6.1 Module-level kill switches

Kill switches are a special class of feature flags that can disable entire modules without redeployment. They are designed for incident response and must be operable by on-call engineers with minimal context.

| Kill switch key | Module disabled | Fallback behavior |
|---|---|---|
| `battle.pvp.enabled` | PvP battle arena (Socket.IO rooms) | Show "Battle mode is temporarily unavailable" |
| `external_image_search.enabled` | External image search for flashcard creation | Hide search button, only allow upload |
| `ads.enabled` | All ad placements (free tier) | Hide ad slots, show clean layout |
| `payment.provider.enabled` | All payment processing | Show "Payments temporarily unavailable", extend existing subscriptions |
| `nhk_sync.enabled` | NHK news article sync job | Stop sync job, show cached articles only |
| `ai.enrichment.enabled` | AI-powered card generation, auto-tagging | Disable "Generate" buttons, admin-only manual flow |
| `notifications.push.enabled` | Push notifications (all channels) | Queue notifications for later delivery |
| `reading_assist.enabled` | Reading assist overlay (browser extension/web) | Hide reading assist UI entirely |
| `realtime.chat.enabled` | Realtime chat in battle/study rooms | Show "Chat is unavailable" in room UI |
| `weather.api.enabled` | Weather-based contextual content | Fall back to static seasonal content |
| `billing.stripe.enabled` | Stripe-specific payment flow | Switch to alternative provider or disable payments |
| `learning_path.adaptive.enabled` | Adaptive learning path engine | Fall back to static curriculum order |

**Kill switch rules:**
- All kill switches default to `true` (enabled) in production.
- Disabling a kill switch must be instant (cached flag, < 5 second propagation).
- Every kill switch change is logged in `admin_audit_log` with operator, reason, and timestamp.
- Kill switch state must survive application restart (stored in database, not memory).
- Admin UI must have a dedicated "Kill Switches" panel separate from gradual rollout flags.
- On-call runbook must document when to use each kill switch.

### 30.7 Content versioning

```sql
CREATE TABLE ops.content_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL, -- full entity state at this version
  change_summary TEXT,
  changed_by UUID,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, version_number)
);

CREATE INDEX idx_content_version_entity ON ops.content_version (entity_type, entity_id, version_number DESC);
```

Rules:
- Auto-increment version on every admin content update.
- Store full snapshot (not diff) for easy rollback.
- Admin can view version history and restore any version.
- Rollback creates a new version with `change_reason = 'rollback from version N'`.
- Keep last 50 versions per entity; archive older versions.

### 30.8 Email service abstraction

```ts
interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
  sendBatch(messages: EmailMessage[]): Promise<EmailSendResult[]>;
}

interface EmailMessage {
  to: string;
  subject: string;
  template: string;
  locale: string;
  variables: Record<string, unknown>;
  category: 'transactional' | 'digest' | 'marketing' | 'notification';
}
```

Email types:
- Welcome / registration confirmation
- Weekly learning digest
- Comeback reminder
- Achievement notification
- Password reset / email verification
- Admin import job completion
- Export ready download link

Providers:
- `ConsoleEmailProvider` for development
- `SmtpEmailProvider` for basic SMTP
- `SendgridEmailProvider` / `SesEmailProvider` for production

Job queue: `email` queue in BullMQ with retry and rate limiting.

### 30.9 CI/CD pipeline specification

```yaml
# .github/workflows/ci.yml structure
name: CI
on: [push, pull_request]

jobs:
  lint-typecheck:
    - pnpm install (cached)
    - pnpm lint
    - pnpm typecheck

  prisma-check:
    - pnpm prisma validate
    - pnpm prisma generate
    - pnpm prisma migrate diff (detect unapplied changes)

  openapi-check:
    - pnpm build:api
    - pnpm openapi:generate
    - diff openapi.json against committed spec (fail on drift)

  test-unit:
    - pnpm test

  test-contract:
    - pnpm test:contract (validate responses against OpenAPI schema)

  test-integration:
    services: [postgres, redis, meilisearch]
    - pnpm prisma migrate deploy
    - pnpm test:integration

  test-e2e:
    services: [postgres, redis, meilisearch, minio]
    - pnpm prisma migrate deploy
    - pnpm seed
    - pnpm build
    - pnpm test:e2e
    - pnpm test:accessibility (axe-core via Playwright)

  security-scan:
    - pnpm audit --audit-level=high (fail on high/critical)
    - trivy image scan on Docker images
    - gitleaks for secret scanning in commits
    - license-checker (fail on copyleft in production deps)

  build:
    - pnpm build
    - docker build (multi-stage, all apps)

  # Staging deploy (on merge to develop)
  deploy-staging:
    needs: [all above jobs]
    - docker push to registry
    - run database migrations
    - deploy to staging
    - health check (fail → auto-rollback)
    - smoke test suite against staging URL

  # Production deploy (manual approval from main)
  deploy-production:
    needs: [deploy-staging passes]
    - manual approval gate
    - blue-green or rolling deployment
    - run database migrations
    - health check (fail → auto-rollback)
    - smoke test suite
    - notify team on success/failure
```

#### PR pipeline summary (must all pass to merge)
1. Install (cached pnpm)
2. Lint + typecheck (parallel)
3. Prisma validate + generate check
4. OpenAPI generation check
5. Unit tests (parallel per app)
6. Contract tests
7. Integration tests (with Docker services)
8. E2E tests + accessibility
9. Security scan (npm audit + secret scan)
10. Dependency vulnerability scan
11. License compliance check
12. Build all apps + Docker images

#### Deployment promotion
```text
feature branch → PR → develop (auto-deploy staging) → main (manual promote production)
```

#### Rollback strategy
- Keep previous 3 Docker image versions tagged.
- Database migrations must be backward-compatible (see Section 30.13).
- Rollback command: redeploy previous image version.
- If migration is not backward-compatible: use feature flags to disable new code, then fix forward.
- Document rollback procedure in `docs/deployment.md`.

Deployment stages:
- `develop` → auto-deploy to staging
- `main` → manual promote to production
- Database migrations run before app deploy
- Health check after deploy
- Rollback on health check failure

### 30.10 Structured logging and distributed tracing

```ts
interface LogContext {
  traceId: string;      // propagated from X-Trace-Id or generated
  requestId: string;    // per-request unique ID
  userId?: string;
  sessionId?: string;
  module: string;
  action: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}
```

Rules:
- Every HTTP request gets a `requestId` and `traceId`.
- Frontend includes `X-Trace-Id` header for correlation.
- Workers inherit `traceId` from job metadata.
- Socket.IO events include `traceId` in handshake.
- Logs are structured JSON (Pino).
- Log levels: `fatal`, `error`, `warn`, `info`, `debug`.
- Never log passwords, tokens, or raw PII.

### 30.11 Dead letter queue and failed job recovery

```sql
CREATE TABLE ops.dead_letter_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name TEXT NOT NULL,
  job_name TEXT NOT NULL,
  job_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'failed', -- failed, retried, resolved, discarded
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
```

Admin UI: `/admin/operations/dead-letter-queue`
- View failed jobs with error details
- Retry individual or batch
- Discard with reason
- Filter by queue, job name, error type

### 30.12 CDN and static asset strategy

| Asset type | Strategy | Cache |
|---|---|---|
| Next.js static assets | CDN edge cache | immutable, content-hash filenames |
| User-uploaded images | Object storage + CDN | 1 year, cache-busted by version |
| SVG stroke order | Object storage + CDN | 1 year, immutable |
| Audio files | Object storage + CDN | 1 year, immutable |
| Share postcard images | Object storage + CDN | 30 days |
| API responses | No CDN (dynamic) | Redis cache |

CDN configuration should be provider-agnostic. Use environment variables for CDN base URL.

```ts
// packages/shared/src/cdn.ts
export function cdnUrl(storagePath: string): string {
  const base = process.env.CDN_BASE_URL || process.env.STORAGE_PUBLIC_URL;
  return `${base}/${storagePath}`;
}
```

### 30.13 Zero-downtime database migration strategy

Rules:
- Never drop a column in the same deploy that stops writing to it.
- Use a 3-step approach for breaking changes:
  1. **Deploy A**: Add new column/table, dual-write.
  2. **Deploy B**: Backfill data, switch reads to new column.
  3. **Deploy C**: Remove old column after verification.
- Never run `ALTER TABLE ... ADD COLUMN ... NOT NULL` without a default value on large tables.
- Use `CREATE INDEX CONCURRENTLY` for production indexes.
- Partition management DDL should run in maintenance windows or be non-blocking.

### 30.14 Cursor implementation requirements for production infrastructure

Cursor must implement:
- Redis caching service with key builder and TTL config
- Circuit breaker wrapper for external services
- PgBouncer in Docker Compose
- Helmet + CORS configuration
- Cursor-based pagination utility
- Feature flag table and service
- Content version table and admin version history UI
- Email provider interface with console dev provider
- CI workflow YAML template
- Structured logging with Pino and trace context
- Dead letter queue table and admin page
- CDN URL utility


## 31. Legal, Compliance, and Commerce

This section covers legal requirements for operating a paid learning platform targeting Japanese and Vietnamese markets.

### 31.1 Terms of Service and Privacy Policy

### Requirements
- Terms of Service and Privacy Policy pages must be published before any user can register.
- Both must be versioned (see consent versioning in Section 21.11.1).
- Available in Vietnamese (primary) and Japanese (secondary).
- Must cover: data collection, learning analytics, third-party services, payment terms, dispute resolution.
- Must be reviewed by legal counsel before production launch.

### Technical implementation
- Store policy versions in database: `legal.policy_version(id, type, version, content_url, published_at, is_current)`.
- On signup: require explicit checkbox acceptance (not pre-checked).
- On policy update: prompt re-acceptance on next login; block access until accepted.
- Store acceptance records: `legal.user_consent(user_id, policy_type, policy_version_id, accepted_at, ip_address, user_agent)`.

### 31.2 Cookie and tracking consent

### Requirements
- Display cookie consent banner on first visit (before any non-essential tracking).
- Categories: **Essential** (always on), **Analytics** (opt-in), **Marketing/Ads** (opt-in).
- Consent choice must be stored and respected server-side (not just client cookie).
- Must comply with Japan APPI (Act on the Protection of Personal Information) and EU GDPR if serving EU users.
- Provide "Manage consent" link in footer/settings.

### Technical implementation
- `legal.cookie_consent(user_id, session_id, analytics_accepted, marketing_accepted, consented_at, ip_address)`.
- Conditional loading of analytics/ad scripts based on consent state.
- Server-side middleware checks consent before writing analytics events.

### 31.3 特定商取引法 (Tokutei Shoutorihiki-hou) — Japanese commerce law

Any subscription-based service sold to Japanese residents must publish the following (required by Japanese law):

| Required item | Content |
|---|---|
| 販売業者 (Seller) | Company/individual name |
| 代表者 (Representative) | Name of responsible person |
| 所在地 (Address) | Business address (can omit for individuals if privacy applies) |
| 電話番号 (Phone) | Contact phone number |
| メールアドレス (Email) | Contact email |
| 販売価格 (Price) | Price including tax for each plan |
| 支払方法 (Payment method) | Credit card, convenience store, etc. |
| 商品引渡時期 (Delivery timing) | "Immediate access upon payment confirmation" |
| 返品・キャンセル (Returns/Cancellation) | Cancellation policy (see 31.4) |
| 動作環境 (System requirements) | Supported browsers and devices |

### Technical implementation
- Dedicated page: `/legal/tokushoho` (Japanese only is acceptable, but Vietnamese translation recommended).
- Must be linked from: footer, checkout page, payment confirmation email.
- Content stored in CMS or static page (admin-editable).

### 31.4 Refund and cancellation policy

### Policy rules
- **Free trial**: No charge during trial. Cancel anytime.
- **Monthly subscription**: Cancel anytime. Access continues until end of billing period. No prorated refund.
- **Annual subscription**: Cancel anytime. Access continues until end of annual period. Prorated refund available within first 14 days.
- **Coin/point purchases**: Non-refundable after use. Unused coins refundable within 7 days of purchase.
- **Dispute resolution**: Respond to chargebacks within 48 hours. Provide usage evidence.

### APIs
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/billing/cancel` | Cancel current subscription |
| POST | `/billing/refund-request` | Request refund (within policy) |
| GET | `/billing/refund-request/:id` | Refund request status |

### Admin requirements
- Admin can process manual refunds with audit reason.
- Refund decisions logged in `billing.refund_log(id, user_id, subscription_id, amount, reason, decided_by, decided_at)`.

### 31.5 Invoice and receipt

### Requirements
- Generate invoice/receipt PDF for every payment.
- Include: transaction ID, date, amount (tax-inclusive), tax breakdown, service description, buyer info.
- Downloadable from user billing settings page.
- Send receipt email on successful payment.

### APIs
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/billing/invoices` | List user invoices |
| GET | `/billing/invoices/:id/pdf` | Download invoice PDF |

### Admin
- Admin can regenerate/resend invoices.
- Bulk invoice export for accounting (CSV/PDF zip).

### 31.6 Tax handling

### Current scope
- Japan: consumption tax (消費税) 10% — must be included in displayed price (税込表示 required by law).
- Vietnam: VAT as applicable.
- If using Stripe: Stripe Tax or manual tax calculation.
- Store tax rate and amount per transaction for reporting.

### Future scope (placeholder)
- Multi-country tax compliance if expanding beyond Japan/Vietnam.
- Tax ID (インボイス制度) for Japanese B2B customers.

### 31.7 Apple/Google IAP compliance (future)

If the app is distributed via app stores:
- In-app purchases must go through Apple/Google IAP for digital goods.
- 15-30% platform commission applies.
- Must use platform-provided subscription management APIs.
- Cannot link to external payment page from within the app.
- Server-side receipt validation required.
- This is a **future consideration** — web-first launch does not require IAP.

### 31.8 Entitlement grace period and payment failure handling

### Grace period rules
- On payment failure (card declined, expired): grant 3-day grace period with full access.
- During grace period: show warning banner "Payment failed — please update payment method."
- After grace period: downgrade to free tier. Queue notification.
- On successful retry payment during grace: restore subscription seamlessly.

### Webhook dead-letter queue
- All payment webhooks (Stripe, etc.) must be processed idempotently.
- Failed webhook processing: retry 3 times with exponential backoff (1min, 5min, 30min).
- After 3 failures: move to dead-letter queue (`billing.webhook_dead_letter`).
- Admin alert on any webhook in dead-letter queue.
- Admin UI to inspect, replay, or dismiss dead-letter webhooks.
- Table: `billing.webhook_dead_letter(id, provider, event_type, payload, error_message, attempts, created_at, resolved_at, resolved_by)`.

---
