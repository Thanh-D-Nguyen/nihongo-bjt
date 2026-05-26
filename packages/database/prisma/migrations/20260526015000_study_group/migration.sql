-- Learner-formed study groups (small cohorts, ≤ 50 members each).
-- Sits on top of existing leaderboard/battle gamification.

CREATE TABLE IF NOT EXISTS gamification.study_group (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(60) NOT NULL,
  description     TEXT,
  owner_user_id   UUID NOT NULL,
  join_policy     VARCHAR(16) NOT NULL DEFAULT 'open',
  weekly_xp_goal  INTEGER,
  member_limit    INTEGER NOT NULL DEFAULT 50,
  cover_asset_id  UUID,
  status          VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

ALTER TABLE gamification.study_group
  ADD CONSTRAINT fk_study_group_owner
    FOREIGN KEY (owner_user_id) REFERENCES profile.user_profile (id) ON DELETE CASCADE;

ALTER TABLE gamification.study_group
  ADD CONSTRAINT ck_study_group_join_policy
    CHECK (join_policy IN ('open', 'invite', 'closed'));

ALTER TABLE gamification.study_group
  ADD CONSTRAINT ck_study_group_status
    CHECK (status IN ('active', 'archived'));

ALTER TABLE gamification.study_group
  ADD CONSTRAINT ck_study_group_member_limit
    CHECK (member_limit BETWEEN 2 AND 50);

ALTER TABLE gamification.study_group
  ADD CONSTRAINT ck_study_group_weekly_xp_goal
    CHECK (weekly_xp_goal IS NULL OR weekly_xp_goal BETWEEN 0 AND 1000000);

CREATE INDEX IF NOT EXISTS idx_study_group_owner
  ON gamification.study_group (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_study_group_status_created
  ON gamification.study_group (status, created_at);


CREATE TABLE IF NOT EXISTS gamification.study_group_member (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL,
  user_id    UUID NOT NULL,
  role       VARCHAR(16) NOT NULL DEFAULT 'member',
  status     VARCHAR(16) NOT NULL DEFAULT 'active',
  joined_at  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_study_group_member_group
    FOREIGN KEY (group_id) REFERENCES gamification.study_group (id) ON DELETE CASCADE
);

ALTER TABLE gamification.study_group_member
  ADD CONSTRAINT fk_study_group_member_user
    FOREIGN KEY (user_id) REFERENCES profile.user_profile (id) ON DELETE CASCADE;

ALTER TABLE gamification.study_group_member
  ADD CONSTRAINT ck_study_group_member_role
    CHECK (role IN ('owner', 'admin', 'member'));

ALTER TABLE gamification.study_group_member
  ADD CONSTRAINT ck_study_group_member_status
    CHECK (status IN ('active', 'pending', 'banned', 'left'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_study_group_member_group_user
  ON gamification.study_group_member (group_id, user_id);

CREATE INDEX IF NOT EXISTS idx_study_group_member_user_status
  ON gamification.study_group_member (user_id, status);

CREATE INDEX IF NOT EXISTS idx_study_group_member_group_role
  ON gamification.study_group_member (group_id, role);


CREATE TABLE IF NOT EXISTS gamification.study_group_challenge (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID NOT NULL,
  title               VARCHAR(80) NOT NULL,
  description         TEXT,
  metric_type         VARCHAR(32) NOT NULL DEFAULT 'xp',
  target_value        INTEGER NOT NULL,
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  reward_payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  status              VARCHAR(16) NOT NULL DEFAULT 'active',
  created_by_user_id  UUID NOT NULL,
  created_at          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_study_group_challenge_group
    FOREIGN KEY (group_id) REFERENCES gamification.study_group (id) ON DELETE CASCADE,
  CONSTRAINT fk_study_group_challenge_creator
    FOREIGN KEY (created_by_user_id) REFERENCES profile.user_profile (id) ON DELETE CASCADE,
  CONSTRAINT ck_study_group_challenge_metric
    CHECK (metric_type IN ('xp', 'reviews', 'quizzes', 'focus_minutes', 'battle_wins')),
  CONSTRAINT ck_study_group_challenge_target
    CHECK (target_value > 0),
  CONSTRAINT ck_study_group_challenge_period
    CHECK (period_end > period_start),
  CONSTRAINT ck_study_group_challenge_status
    CHECK (status IN ('active', 'completed', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_study_group_challenge_group_status_period
  ON gamification.study_group_challenge (group_id, status, period_start);

CREATE INDEX IF NOT EXISTS idx_study_group_challenge_creator_created
  ON gamification.study_group_challenge (created_by_user_id, created_at);


CREATE TABLE IF NOT EXISTS gamification.user_social_connection (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_key            VARCHAR(80) NOT NULL,
  requester_user_id   UUID NOT NULL,
  addressee_user_id   UUID NOT NULL,
  status              VARCHAR(16) NOT NULL DEFAULT 'pending',
  blocked_by_user_id  UUID,
  requested_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  responded_at        TIMESTAMPTZ(6),
  updated_at          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_social_connection_requester
    FOREIGN KEY (requester_user_id) REFERENCES profile.user_profile (id) ON DELETE CASCADE,
  CONSTRAINT fk_social_connection_addressee
    FOREIGN KEY (addressee_user_id) REFERENCES profile.user_profile (id) ON DELETE CASCADE,
  CONSTRAINT fk_social_connection_blocked_by
    FOREIGN KEY (blocked_by_user_id) REFERENCES profile.user_profile (id) ON DELETE SET NULL,
  CONSTRAINT ck_social_connection_distinct_users
    CHECK (requester_user_id <> addressee_user_id),
  CONSTRAINT ck_social_connection_status
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'blocked')),
  CONSTRAINT ck_social_connection_blocker_required
    CHECK ((status = 'blocked' AND blocked_by_user_id IS NOT NULL) OR (status <> 'blocked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_social_connection_pair_key
  ON gamification.user_social_connection (pair_key);

CREATE INDEX IF NOT EXISTS idx_social_connection_requester_status
  ON gamification.user_social_connection (requester_user_id, status);

CREATE INDEX IF NOT EXISTS idx_social_connection_addressee_status
  ON gamification.user_social_connection (addressee_user_id, status);

CREATE INDEX IF NOT EXISTS idx_social_connection_status_updated
  ON gamification.user_social_connection (status, updated_at);
