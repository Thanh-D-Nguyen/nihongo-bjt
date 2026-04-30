-- Prune redundant/empty Phase 00 kanji columns.
-- `component_text` is exactly derivable from `content.kanji_component`; `mnemonic` and
-- `short_meaning` were empty in the imported data. Future enrichment should use reviewed
-- domain tables or media links rather than retaining dead nullable columns.

ALTER TABLE "kanji"
  DROP COLUMN "component_text",
  DROP COLUMN "mnemonic",
  DROP COLUMN "short_meaning";
