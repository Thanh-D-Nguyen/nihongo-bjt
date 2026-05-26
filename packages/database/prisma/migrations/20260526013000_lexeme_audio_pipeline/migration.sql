-- TTS audio variants for Lexeme + ExampleSentence.
-- Caches generated audio so we don't re-call the TTS provider on every request.

CREATE TABLE IF NOT EXISTS content.lexeme_audio (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lexeme_id       UUID NOT NULL,
  media_asset_id  UUID NOT NULL,
  tts_provider    VARCHAR(40) NOT NULL,
  voice_name      VARCHAR(80) NOT NULL,
  speaking_rate   DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  duration_ms     INTEGER,
  voice_actor     VARCHAR(120),
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_lexeme_audio_lexeme
    FOREIGN KEY (lexeme_id) REFERENCES content.lexeme (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lexeme_audio_voice
  ON content.lexeme_audio (lexeme_id, voice_name, speaking_rate);

CREATE INDEX IF NOT EXISTS idx_lexeme_audio_lexeme
  ON content.lexeme_audio (lexeme_id);

CREATE INDEX IF NOT EXISTS idx_lexeme_audio_asset
  ON content.lexeme_audio (media_asset_id);


CREATE TABLE IF NOT EXISTS content.example_sentence_audio (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sentence_id     UUID NOT NULL,
  media_asset_id  UUID NOT NULL,
  tts_provider    VARCHAR(40) NOT NULL,
  voice_name      VARCHAR(80) NOT NULL,
  speaking_rate   DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  duration_ms     INTEGER,
  voice_actor     VARCHAR(120),
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_example_audio_sentence
    FOREIGN KEY (sentence_id) REFERENCES content.example_sentence (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_example_audio_voice
  ON content.example_sentence_audio (sentence_id, voice_name, speaking_rate);

CREATE INDEX IF NOT EXISTS idx_example_audio_sentence
  ON content.example_sentence_audio (sentence_id);

CREATE INDEX IF NOT EXISTS idx_example_audio_asset
  ON content.example_sentence_audio (media_asset_id);
