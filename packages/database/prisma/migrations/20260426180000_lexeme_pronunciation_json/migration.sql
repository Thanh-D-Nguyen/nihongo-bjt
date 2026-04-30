-- javi.json `pronunciation`: optional JSON (often a Python-repr string repaired at import)
ALTER TABLE content.lexeme
  ADD COLUMN IF NOT EXISTS pronunciation jsonb;
