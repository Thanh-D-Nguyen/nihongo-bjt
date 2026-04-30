CREATE SCHEMA IF NOT EXISTS learning;
CREATE SCHEMA IF NOT EXISTS media;

CREATE TABLE media.asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid,
  object_key text NOT NULL,
  mime_type varchar(120) NOT NULL,
  byte_size integer,
  checksum_sha256 char(64),
  provider varchar(64) NOT NULL DEFAULT 'local',
  source_url text,
  license text,
  rights_status varchar(32) NOT NULL DEFAULT 'pending_review',
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_media_asset_object_key ON media.asset (object_key);
CREATE INDEX idx_media_asset_owner_created_at ON media.asset (owner_user_id, created_at);
CREATE INDEX idx_media_asset_rights_status ON media.asset (rights_status);

CREATE TABLE learning.deck (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid,
  title_vi text NOT NULL,
  title_ja text,
  description_vi text,
  description_ja text,
  visibility varchar(32) NOT NULL DEFAULT 'private',
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX idx_deck_owner_created_at ON learning.deck (owner_user_id, created_at);
CREATE INDEX idx_deck_visibility_status ON learning.deck (visibility, status);

CREATE TABLE learning.flashcard_variant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type varchar(64) NOT NULL,
  source_id uuid NOT NULL,
  front_text text NOT NULL,
  back_text text NOT NULL,
  reading text,
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX idx_flashcard_variant_source ON learning.flashcard_variant (source_type, source_id);
CREATE INDEX idx_flashcard_variant_status ON learning.flashcard_variant (status);

CREATE TABLE learning.deck_card (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES learning.deck(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES learning.flashcard_variant(id) ON DELETE CASCADE,
  position integer NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_deck_card_card ON learning.deck_card (deck_id, card_id);
CREATE UNIQUE INDEX uq_deck_card_position ON learning.deck_card (deck_id, position);

CREATE TABLE learning.user_flashcard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES learning.flashcard_variant(id) ON DELETE CASCADE,
  state varchar(32) NOT NULL DEFAULT 'new',
  due_at timestamptz(6) NOT NULL DEFAULT now(),
  interval_days integer NOT NULL DEFAULT 0,
  ease_factor double precision NOT NULL DEFAULT 2.5,
  repetitions integer NOT NULL DEFAULT 0,
  lapses integer NOT NULL DEFAULT 0,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_user_flashcard_card ON learning.user_flashcard (user_id, card_id);
CREATE INDEX idx_user_flashcard_due ON learning.user_flashcard (user_id, due_at);

CREATE TABLE learning.review_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_flashcard_id uuid NOT NULL REFERENCES learning.user_flashcard(id) ON DELETE CASCADE,
  rating varchar(16) NOT NULL,
  elapsed_ms integer,
  previous_due_at timestamptz(6) NOT NULL,
  next_due_at timestamptz(6) NOT NULL,
  reviewed_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_event_user_reviewed_at ON learning.review_event (user_id, reviewed_at);
CREATE INDEX idx_review_event_card_reviewed_at ON learning.review_event (user_flashcard_id, reviewed_at);

CREATE TABLE learning.card_media_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES learning.flashcard_variant(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES media.asset(id) ON DELETE RESTRICT,
  role varchar(32) NOT NULL DEFAULT 'primary_image',
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_card_media_link_role ON learning.card_media_link (card_id, asset_id, role);
CREATE INDEX idx_card_media_link_asset ON learning.card_media_link (asset_id);
