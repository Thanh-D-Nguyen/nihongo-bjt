CREATE TABLE media.image_search_cache (
  namespace text NOT NULL,
  cache_key text NOT NULL,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (namespace, cache_key)
);
CREATE INDEX idx_image_search_cache_expires_at ON media.image_search_cache (expires_at);
