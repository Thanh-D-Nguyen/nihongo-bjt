-- Reporting layer: schema, views, materialized views, indexes, initial MV refresh.
-- Source of truth for definitions: database/views/, database/materialized_views/, database/indexes/
-- (kept in sync manually when editing SQL artifacts).

CREATE SCHEMA IF NOT EXISTS reporting;

COMMENT ON SCHEMA reporting IS
  'Read-optimized views and materialized views; definitions applied via Prisma Migrate.';

-- ---------------------------------------------------------------------------
-- Views (alphabetical)
-- ---------------------------------------------------------------------------

-- Admin actors with aggregated role and permission codes (RBAC overview).
CREATE OR REPLACE VIEW reporting.v_admin_user_summary AS
SELECT
  a.id AS admin_actor_id,
  a.email,
  a.display_name,
  a.status,
  a.keycloak_subject,
  a.created_at,
  a.updated_at,
  (
    SELECT string_agg(sub.code, ', ' ORDER BY sub.code)
    FROM (
      SELECT DISTINCT r.code
      FROM authz.admin_actor_role ar
      JOIN authz.admin_role r ON r.id = ar.role_id
      WHERE ar.actor_id = a.id
    ) AS sub
  ) AS role_codes,
  (
    SELECT string_agg(sub.code, ', ' ORDER BY sub.code)
    FROM (
      SELECT DISTINCT p.code
      FROM authz.admin_actor_role ar
      JOIN authz.admin_role r ON r.id = ar.role_id
      JOIN authz.admin_role_permission rp ON rp.role_id = r.id
      JOIN authz.admin_permission p ON p.id = rp.permission_id
      WHERE ar.actor_id = a.id
    ) AS sub
  ) AS permission_codes
FROM authz.admin_actor a;

COMMENT ON VIEW reporting.v_admin_user_summary IS
  'Admin directory: actor row with comma-sorted distinct role codes and expanded permission codes for IAM screens.';

-- Canonical content rows flagged for review (non-active status or review_reasons JSON set).
CREATE OR REPLACE VIEW reporting.v_content_moderation_queue AS
SELECT
  l.id AS entity_id,
  'lexeme'::text AS entity_type,
  l.headword AS label,
  l.status,
  l.review_reasons,
  l.updated_at
FROM content.lexeme l
WHERE l.status <> 'active'
   OR l.review_reasons IS NOT NULL
UNION ALL
SELECT
  k.id,
  'kanji'::text,
  k.character,
  k.status,
  k.review_reasons,
  k.updated_at
FROM content.kanji k
WHERE k.status <> 'active'
   OR k.review_reasons IS NOT NULL
UNION ALL
SELECT
  g.id,
  'grammar'::text,
  g.pattern,
  g.status,
  g.review_reasons,
  g.updated_at
FROM content.grammar_point g
WHERE g.status <> 'active'
   OR g.review_reasons IS NOT NULL
UNION ALL
SELECT
  e.id,
  'example'::text,
  left(e.japanese_text, 120),
  e.status,
  e.review_reasons,
  e.updated_at
FROM content.example_sentence e
WHERE e.status <> 'active'
   OR e.review_reasons IS NOT NULL;

COMMENT ON VIEW reporting.v_content_moderation_queue IS
  'CMS moderation queue: lexeme, kanji, grammar, example rows needing attention (status not active or review_reasons present).';

-- Meilisearch / search worker projection: same shape as apps/api/scripts/index-search.ts documents.
CREATE OR REPLACE VIEW reporting.v_content_search_documents AS
SELECT
  l.id,
  'lexeme'::text AS kind,
  l.headword AS title,
  l.reading,
  coalesce(l.short_meaning_vi, s0.meaning_vi) AS description
FROM content.lexeme l
LEFT JOIN LATERAL (
  SELECT ls.meaning_vi
  FROM content.lexeme_sense ls
  WHERE ls.lexeme_id = l.id
  ORDER BY ls.position ASC
  LIMIT 1
) s0 ON TRUE
WHERE l.status = 'active'
UNION ALL
SELECT
  k.id,
  'kanji'::text,
  k.character,
  concat_ws(' / ', k.onyomi, k.kunyomi) AS reading,
  k.meaning_vi
FROM content.kanji k
WHERE k.status = 'active'
UNION ALL
SELECT
  g.id,
  'grammar'::text,
  g.pattern,
  g.jlpt_level,
  g.meaning_vi
FROM content.grammar_point g
WHERE g.status = 'active'
UNION ALL
SELECT
  e.id,
  'example'::text,
  e.japanese_text,
  e.reading,
  e.translation_vi
FROM content.example_sentence e
WHERE e.status = 'active';

COMMENT ON VIEW reporting.v_content_search_documents IS
  'Unified search documents for Meilisearch `content_search` index (id, kind, title, reading, description).';

-- Daily Hub items with optional extraction row (1:1 on daily_learning_extraction.daily_content_item_id).
CREATE OR REPLACE VIEW reporting.v_daily_content_feed_with_extraction AS
SELECT
  i.id AS daily_content_item_id,
  i.widget_kind,
  i.content_date,
  i.locale,
  i.title,
  i.body_md,
  i.japanese_text,
  i.reading_text,
  i.explanation_text,
  i.source_provider,
  i.source_ref,
  i.payload AS item_payload,
  i.status,
  i.created_at,
  i.updated_at,
  e.id AS extraction_id,
  e.extracted_entries,
  e.extracted_kanji,
  e.extracted_grammar,
  e.suggested_flashcards,
  e.suggested_quiz,
  e.created_at AS extraction_created_at,
  (e.id IS NOT NULL) AS has_extraction
FROM daily.daily_content_item i
LEFT JOIN daily.daily_learning_extraction e ON e.daily_content_item_id = i.id;

COMMENT ON VIEW reporting.v_daily_content_feed_with_extraction IS
  'Daily content with learning extraction JSON; join is PK-aligned.';

-- SRS-style due counts per learner (user_profile.id).
CREATE OR REPLACE VIEW reporting.v_flashcard_due_summary_per_user AS
SELECT
  uf.user_id,
  count(*)::bigint AS tracked_cards,
  count(*) FILTER (WHERE uf.due_at <= now())::bigint AS due_now_count,
  count(*) FILTER (WHERE uf.state = 'new')::bigint AS state_new_count,
  min(uf.due_at) FILTER (WHERE uf.due_at > now()) AS next_due_at
FROM learning.user_flashcard uf
GROUP BY uf.user_id;

COMMENT ON VIEW reporting.v_flashcard_due_summary_per_user IS
  'Per-user flashcard queue: total tracked cards, count due now (due_at <= transaction timestamp), new state count, next future due.';

CREATE OR REPLACE VIEW reporting.v_grammar_detail AS
SELECT
  g.id AS grammar_point_id,
  g.pattern,
  g.meaning_vi,
  g.jlpt_level,
  g.category,
  g.status,
  coalesce(dc.detail_count, 0)::bigint AS detail_count,
  coalesce(dex.link_count, 0)::bigint AS detail_example_link_count
FROM content.grammar_point g
LEFT JOIN (
  SELECT grammar_point_id, count(*)::bigint AS detail_count
  FROM content.grammar_point_detail
  GROUP BY grammar_point_id
) dc ON dc.grammar_point_id = g.id
LEFT JOIN (
  SELECT d.grammar_point_id, count(*)::bigint AS link_count
  FROM content.grammar_point_detail d
  JOIN content.grammar_point_detail_example ge ON ge.detail_id = d.id
  GROUP BY d.grammar_point_id
) dex ON dex.grammar_point_id = g.id;

COMMENT ON VIEW reporting.v_grammar_detail IS
  'Grammar point with detail_count and example-link counts via two grouped joins (avoids double-scanning details per scalar subquery pattern).';

CREATE OR REPLACE VIEW reporting.v_import_batch_summary AS
SELECT
  b.id AS import_batch_id,
  b.source_type,
  b.source_dir,
  b.status,
  b.file_count,
  b.item_count,
  b.error_count,
  b.profile_summary,
  b.validation_summary,
  b.transform_summary,
  b.started_at,
  b.completed_at,
  b.created_at,
  b.updated_at,
  coalesce(r.cnt, 0)::bigint AS raw_item_row_count,
  coalesce(err.cnt, 0)::bigint AS import_error_row_count
FROM content.content_import_batch b
LEFT JOIN (
  SELECT import_batch_id, count(*)::bigint AS cnt
  FROM content.content_raw_item
  GROUP BY import_batch_id
) r ON r.import_batch_id = b.id
LEFT JOIN (
  SELECT import_batch_id, count(*)::bigint AS cnt
  FROM content.content_import_error
  GROUP BY import_batch_id
) err ON err.import_batch_id = b.id;

COMMENT ON VIEW reporting.v_import_batch_summary IS
  'Import batches with child row counts from hash-friendly aggregates.';

CREATE OR REPLACE VIEW reporting.v_kanji_detail AS
SELECT
  k.id AS kanji_id,
  k.character,
  k.meaning_vi,
  k.onyomi,
  k.kunyomi,
  k.stroke_count,
  k.level,
  k.frequency,
  k.detail,
  k.tip,
  k.status,
  coalesce(ke.example_count, 0)::bigint AS example_count,
  coalesce(kc.component_count, 0)::bigint AS component_count
FROM content.kanji k
LEFT JOIN (
  SELECT kanji_id, count(*)::bigint AS example_count
  FROM content.kanji_example
  GROUP BY kanji_id
) ke ON ke.kanji_id = k.id
LEFT JOIN (
  SELECT kanji_id, count(*)::bigint AS component_count
  FROM content.kanji_component
  GROUP BY kanji_id
) kc ON kc.kanji_id = k.id;

COMMENT ON VIEW reporting.v_kanji_detail IS
  'Kanji row with example/component counts from pre-aggregated child joins (scales to full kanji table scans).';

CREATE OR REPLACE VIEW reporting.v_lexeme_dictionary_detail AS
SELECT
  l.id AS lexeme_id,
  l.headword,
  l.reading AS lexeme_reading,
  l.jlpt_level,
  l.short_meaning_vi,
  l.kanji_meaning_vi,
  l.pronunciation,
  l.status AS lexeme_status,
  ls.id AS sense_id,
  ls.position AS sense_position,
  ls.part_of_speech,
  ls.meaning_vi AS sense_meaning_vi,
  ls.field AS sense_field,
  ls.metadata AS sense_metadata,
  ex.examples_json
FROM content.lexeme l
JOIN content.lexeme_sense ls ON ls.lexeme_id = l.id
LEFT JOIN LATERAL (
  SELECT
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'example_sentence_id', sub.es_id,
          'japanese_text', sub.japanese_text,
          'reading', sub.reading,
          'translation_vi', sub.translation_vi
        )
        ORDER BY sub.ord_key
      )
      FILTER (WHERE sub.es_id IS NOT NULL),
      '[]'::jsonb
    ) AS examples_json
  FROM (
    SELECT
      es.id AS es_id,
      es.japanese_text,
      es.reading,
      es.translation_vi,
      lse.source_example_key AS ord_key
    FROM content.lexeme_sense_example lse
    LEFT JOIN content.example_sentence es ON es.id = lse.example_sentence_id
    WHERE lse.sense_id = ls.id
    ORDER BY lse.source_example_key
    LIMIT 5
  ) sub
) ex ON TRUE;

COMMENT ON VIEW reporting.v_lexeme_dictionary_detail IS
  'Dictionary denormalization: one row per lexeme sense; examples JSON capped at 5 links per sense.';

CREATE OR REPLACE VIEW reporting.v_lexeme_reverse_dictionary_projection AS
SELECT
  p.id AS projection_id,
  p.vietnamese_headword,
  p.status AS projection_status,
  c.id AS candidate_id,
  c.position AS candidate_position,
  c.part_of_speech,
  c.japanese_text,
  c.reading,
  c.kanji_text,
  c.metadata AS candidate_metadata,
  coalesce(ec.example_link_count, 0)::bigint AS example_link_count
FROM content.lexeme_reverse_projection p
JOIN content.lexeme_reverse_candidate c ON c.projection_id = p.id
LEFT JOIN (
  SELECT candidate_id, count(*)::bigint AS example_link_count
  FROM content.lexeme_reverse_candidate_example
  GROUP BY candidate_id
) ec ON ec.candidate_id = c.id;

COMMENT ON VIEW reporting.v_lexeme_reverse_dictionary_projection IS
  'Reverse dictionary candidates with pre-aggregated example link counts.';

CREATE OR REPLACE VIEW reporting.v_media_asset_rights_status AS
SELECT
  a.id AS asset_id,
  a.owner_user_id,
  a.object_key,
  a.mime_type,
  a.byte_size,
  a.provider,
  a.source_url,
  a.license,
  a.rights_status,
  a.status AS asset_status,
  a.created_at,
  a.updated_at,
  coalesce(cml.card_link_count, 0)::bigint AS card_link_count,
  coalesce(av.avatar_ref_count, 0)::bigint AS profile_avatar_ref_count
FROM media.asset a
LEFT JOIN (
  SELECT asset_id, count(*)::bigint AS card_link_count
  FROM learning.card_media_link
  GROUP BY asset_id
) cml ON cml.asset_id = a.id
LEFT JOIN (
  SELECT avatar_asset_id, count(*)::bigint AS avatar_ref_count
  FROM profile.user_profile
  WHERE avatar_asset_id IS NOT NULL
  GROUP BY avatar_asset_id
) av ON av.avatar_asset_id = a.id;

COMMENT ON VIEW reporting.v_media_asset_rights_status IS
  'Media asset with aggregated link counts (flashcard images, profile avatars).';

CREATE OR REPLACE VIEW reporting.v_mistake_summary AS
SELECT
  qs.user_id,
  'quiz'::text AS source,
  qa.question_id,
  max(q.skill_tag) AS skill_tag,
  count(*)::bigint AS wrong_attempts
FROM assessment.quiz_answer qa
JOIN assessment.quiz_session qs ON qs.id = qa.session_id
JOIN assessment.bjt_question q ON q.id = qa.question_id
WHERE qa.is_correct = false
GROUP BY qs.user_id, qa.question_id
UNION ALL
SELECT
  bs.user_id,
  'battle'::text AS source,
  br.question_id,
  max(q.skill_tag) AS skill_tag,
  count(*)::bigint
FROM learning.battle_round br
JOIN learning.battle_session bs ON bs.id = br.session_id
JOIN assessment.bjt_question q ON q.id = br.question_id
WHERE br.user_correct = false
GROUP BY bs.user_id, br.question_id;

COMMENT ON VIEW reporting.v_mistake_summary IS
  'Wrong quiz answers and battle rounds aggregated by user and question; skill_tag via max() (single value per question_id).';

CREATE OR REPLACE VIEW reporting.v_share_postcard_public AS
SELECT
  si.id AS share_item_id,
  si.public_token,
  si.kind,
  si.summary_payload,
  si.expires_at,
  si.created_at,
  st.slug AS template_slug,
  st.kind AS template_kind,
  st.version AS template_version,
  coalesce(sca.asset_count, 0)::bigint AS postcard_asset_count
FROM growth.share_item si
LEFT JOIN growth.share_template st ON st.id = si.template_id
LEFT JOIN (
  SELECT share_item_id, count(*)::bigint AS asset_count
  FROM growth.share_card_asset
  GROUP BY share_item_id
) sca ON sca.share_item_id = si.id;

COMMENT ON VIEW reporting.v_share_postcard_public IS
  'Public share rows with template metadata and aggregated postcard asset counts.';

CREATE OR REPLACE VIEW reporting.v_study_session_summary AS
SELECT
  qs.user_id,
  count(*)::bigint AS sessions_started,
  count(*) FILTER (WHERE qs.status = 'completed')::bigint AS sessions_completed,
  coalesce(sum(qs.total_questions) FILTER (WHERE qs.status = 'completed'), 0)::bigint AS total_questions_completed_sessions,
  coalesce(sum(qs.correct_count) FILTER (WHERE qs.status = 'completed'), 0)::bigint AS total_correct_completed_sessions,
  max(qs.completed_at) AS last_completed_at
FROM assessment.quiz_session qs
GROUP BY qs.user_id;

COMMENT ON VIEW reporting.v_study_session_summary IS
  'Per-user quiz session stats: started vs completed, summed question/correct counts on completed sessions only.';

CREATE OR REPLACE VIEW reporting.v_user_entitlement_summary AS
SELECT
  us.user_id,
  us.id AS subscription_id,
  us.status AS subscription_status,
  us.provider,
  us.current_period_start,
  us.current_period_end,
  us.cancel_at_period_end,
  p.id AS plan_id,
  p.slug AS plan_slug,
  p.name_key AS plan_name_key,
  p.status AS plan_status,
  coalesce(pk.entitlement_keys, ARRAY[]::text[]) AS entitlement_keys
FROM monetization.user_subscription us
JOIN monetization.plan p ON p.id = us.plan_id
LEFT JOIN (
  SELECT
    pe.plan_id,
    array_agg(ed.key ORDER BY ed.key) AS entitlement_keys
  FROM monetization.plan_entitlement pe
  JOIN monetization.entitlement_definition ed ON ed.id = pe.entitlement_id
  GROUP BY pe.plan_id
) pk ON pk.plan_id = us.plan_id
WHERE us.status IN ('active', 'trialing');

COMMENT ON VIEW reporting.v_user_entitlement_summary IS
  'Active/trialing subscriptions with plan-level entitlement key arrays (single array_agg per plan).';

CREATE OR REPLACE VIEW reporting.v_user_learning_dashboard_summary AS
SELECT
  up.id AS user_id,
  coalesce(uf.flashcards_tracked, 0)::bigint AS flashcards_tracked,
  coalesce(rev.reviews_last_7d_utc, 0)::bigint AS reviews_last_7d_utc,
  coalesce(qs.quiz_sessions_total, 0)::bigint AS quiz_sessions_total,
  coalesce(qs.quiz_sessions_completed, 0)::bigint AS quiz_sessions_completed,
  coalesce(bs.battle_sessions_total, 0)::bigint AS battle_sessions_total
FROM profile.user_profile up
LEFT JOIN (
  SELECT uf.user_id, count(*)::bigint AS flashcards_tracked
  FROM learning.user_flashcard uf
  GROUP BY uf.user_id
) uf ON uf.user_id = up.id
LEFT JOIN (
  SELECT re.user_id, count(*)::bigint AS reviews_last_7d_utc
  FROM learning.review_event re
  WHERE re.reviewed_at >= (now() AT TIME ZONE 'UTC') - interval '7 days'
  GROUP BY re.user_id
) rev ON rev.user_id = up.id
LEFT JOIN (
  SELECT
    q.user_id,
    count(*)::bigint AS quiz_sessions_total,
    count(*) FILTER (WHERE q.status = 'completed')::bigint AS quiz_sessions_completed
  FROM assessment.quiz_session q
  GROUP BY q.user_id
) qs ON qs.user_id = up.id
LEFT JOIN (
  SELECT b.user_id, count(*)::bigint AS battle_sessions_total
  FROM learning.battle_session b
  GROUP BY b.user_id
) bs ON bs.user_id = up.id
WHERE up.status = 'active';

COMMENT ON VIEW reporting.v_user_learning_dashboard_summary IS
  'Dashboard rollups per active user: pre-aggregated joins (flashcards, reviews 7d UTC, quiz, battle). Scales linearly in table sizes, not profile count × subqueries.';

CREATE OR REPLACE VIEW reporting.v_user_quota_status AS
SELECT
  uc.id AS usage_counter_id,
  uc.user_id,
  uc.quota_key,
  uc.window_key,
  uc.value AS consumed,
  uc.updated_at AS counter_updated_at,
  ql.plan_limit,
  ql.quota_window_code,
  us.subscription_id,
  us.subscription_status,
  us.plan_slug
FROM monetization.usage_counter uc
LEFT JOIN LATERAL (
  SELECT
    s.id AS subscription_id,
    s.status AS subscription_status,
    pl.slug AS plan_slug,
    s.plan_id
  FROM monetization.user_subscription s
  JOIN monetization.plan pl ON pl.id = s.plan_id
  WHERE s.user_id = uc.user_id
    AND s.status IN ('active', 'trialing')
  ORDER BY s.updated_at DESC
  LIMIT 1
) us ON TRUE
LEFT JOIN LATERAL (
  SELECT pq.limit_value AS plan_limit, qp.window_code AS quota_window_code
  FROM monetization.plan_quota pq
  JOIN monetization.quota_policy qp ON qp.id = pq.quota_policy_id
  WHERE us.plan_id IS NOT NULL
    AND pq.plan_id = us.plan_id
    AND qp.key = uc.quota_key
  LIMIT 1
) ql ON TRUE;

COMMENT ON VIEW reporting.v_user_quota_status IS
  'Quota lens: usage_counter + latest active subscription (with plan_slug) + matching plan_quota row for quota_policy.key.';

-- ---------------------------------------------------------------------------
-- Materialized views
-- ---------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS reporting.mv_admin_daily_kpi_summary CASCADE;
CREATE MATERIALIZED VIEW reporting.mv_admin_daily_kpi_summary AS
SELECT
  dm.metric_date AS metric_date,
  dm.metric_name,
  sum(dm.value)::double precision AS total_value
FROM analytics.daily_metric dm
WHERE dm.dimension_type = 'global'
  AND dm.dimension_key = 'all'
GROUP BY dm.metric_date, dm.metric_name;

COMMENT ON MATERIALIZED VIEW reporting.mv_admin_daily_kpi_summary IS
  'Long-format admin KPIs from analytics.daily_metric (global dimension only).';

DROP MATERIALIZED VIEW IF EXISTS reporting.mv_content_quality_analytics CASCADE;
CREATE MATERIALIZED VIEW reporting.mv_content_quality_analytics AS
SELECT
  'lexeme'::text AS entity_type,
  l.status,
  count(*)::bigint AS entity_count,
  count(*) FILTER (WHERE l.review_reasons IS NOT NULL)::bigint AS with_review_reasons_json
FROM content.lexeme l
GROUP BY l.status
UNION ALL
SELECT
  'kanji'::text,
  k.status,
  count(*)::bigint,
  count(*) FILTER (WHERE k.review_reasons IS NOT NULL)::bigint
FROM content.kanji k
GROUP BY k.status
UNION ALL
SELECT
  'grammar'::text,
  g.status,
  count(*)::bigint,
  count(*) FILTER (WHERE g.review_reasons IS NOT NULL)::bigint
FROM content.grammar_point g
GROUP BY g.status
UNION ALL
SELECT
  'example'::text,
  e.status,
  count(*)::bigint,
  count(*) FILTER (WHERE e.review_reasons IS NOT NULL)::bigint
FROM content.example_sentence e
GROUP BY e.status;

COMMENT ON MATERIALIZED VIEW reporting.mv_content_quality_analytics IS
  'Content inventory by entity type and status; review_reasons presence via FILTER.';

DROP MATERIALIZED VIEW IF EXISTS reporting.mv_search_quality_daily CASCADE;
CREATE MATERIALIZED VIEW reporting.mv_search_quality_daily AS
SELECT
  (ae.created_at AT TIME ZONE 'UTC')::date AS metric_date,
  count(*)::bigint AS search_submissions,
  count(*) FILTER (
    WHERE ae.payload ? 'resultCount'
      AND (ae.payload ->> 'resultCount')::int = 0
  )::bigint AS zero_result_submissions,
  avg((ae.payload ->> 'resultCount')::numeric) FILTER (WHERE ae.payload ? 'resultCount') AS avg_result_count
FROM analytics.analytics_event ae
WHERE ae.event_name = 'content_search_submitted'
GROUP BY 1;

COMMENT ON MATERIALIZED VIEW reporting.mv_search_quality_daily IS
  'Search quality by UTC day: submissions, zero-result count (payload.resultCount = 0), avg hits.';

DROP MATERIALIZED VIEW IF EXISTS reporting.mv_learning_engagement_daily_summary CASCADE;
CREATE MATERIALIZED VIEW reporting.mv_learning_engagement_daily_summary AS
SELECT
  dm.metric_date AS metric_date,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'flashcards.reviews'), 0)::double precision AS flashcard_reviews,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'flashcards.rating.again'), 0)::double precision AS flashcard_rating_again,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'flashcards.rating.hard'), 0)::double precision AS flashcard_rating_hard,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'flashcards.rating.good'), 0)::double precision AS flashcard_rating_good,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'learner.active_users'), 0)::double precision AS learner_active_users,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'assessment.answers'), 0)::double precision AS assessment_answers,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'assessment.correct_answers'), 0)::double precision AS assessment_correct_answers,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'assessment.accuracy_pct'), 0)::double precision AS assessment_accuracy_pct,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'assessment.sessions_completed'), 0)::double precision AS assessment_sessions_completed,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'content.search_events'), 0)::double precision AS search_events,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'ops.admin_writes'), 0)::double precision AS admin_writes
FROM analytics.daily_metric dm
WHERE dm.dimension_type = 'global'
  AND dm.dimension_key = 'all'
GROUP BY dm.metric_date;

COMMENT ON MATERIALIZED VIEW reporting.mv_learning_engagement_daily_summary IS
  'Wide daily engagement snapshot pivoted from rollup metrics (FILTER aggregates per day).';

-- ---------------------------------------------------------------------------
-- Indexes on materialized views (unique: enables REFRESH CONCURRENTLY later)
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_admin_daily_kpi_summary_dim
  ON reporting.mv_admin_daily_kpi_summary (metric_date, metric_name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_content_quality_analytics_dim
  ON reporting.mv_content_quality_analytics (entity_type, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_search_quality_daily_dim
  ON reporting.mv_search_quality_daily (metric_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_learning_engagement_daily_dim
  ON reporting.mv_learning_engagement_daily_summary (metric_date);

CREATE INDEX IF NOT EXISTS idx_mv_admin_kpi_metric_date
  ON reporting.mv_admin_daily_kpi_summary (metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_mv_search_quality_metric_date
  ON reporting.mv_search_quality_daily (metric_date DESC);

-- Supporting indexes for reporting views (non-CONCURRENTLY: Prisma migration transaction).
CREATE INDEX IF NOT EXISTS idx_quiz_answer_incorrect_reporting
  ON assessment.quiz_answer (session_id, question_id)
  WHERE is_correct = false;

CREATE INDEX IF NOT EXISTS idx_battle_round_user_wrong_reporting
  ON learning.battle_round (session_id, question_id)
  WHERE user_correct = false;

-- ---------------------------------------------------------------------------
-- Initial population (non-concurrent refresh; safe inside migration)
-- ---------------------------------------------------------------------------

REFRESH MATERIALIZED VIEW reporting.mv_admin_daily_kpi_summary;
REFRESH MATERIALIZED VIEW reporting.mv_content_quality_analytics;
REFRESH MATERIALIZED VIEW reporting.mv_search_quality_daily;
REFRESH MATERIALIZED VIEW reporting.mv_learning_engagement_daily_summary;
