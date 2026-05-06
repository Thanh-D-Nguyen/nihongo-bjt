-- Use safe Rive metadata for third-party bot assets.
-- `__default__` means load the default artboard; `__none__` means do not instantiate a state
-- machine unless an admin has verified the exact state machine/input contract.

UPDATE "learning"."battle_bot"
SET
  "rive_artboard" = '__default__',
  "rive_state_machine" = '__none__',
  "rive_src" = CASE
    WHEN "bot_key" = 'bot_j1' OR "name" = 'Kuroda J1 Mentor' THEN '/assets/battle/bots/23764-44433-character-customization-ui.riv'
    WHEN "bot_key" = 'bot_j2' OR "name" = 'Mika J4 Coach' THEN '/assets/battle/bots/18912-35694-lil-guy.riv'
    WHEN "bot_key" = 'bot_j3' OR "name" = 'Sato J3 Rival' THEN '/assets/battle/bots/24876-46460-interactive-bunny-character.riv'
    WHEN "bot_key" = 'bot_j4' OR "name" = 'Hayashi J2 Challenger' THEN '/assets/battle/bots/20538-38646-cheeky-chops.riv'
    ELSE "rive_src"
  END,
  "rive_license" = COALESCE("rive_license", 'User-provided Rive asset; verify license before production release'),
  "rive_provenance" = COALESCE("rive_provenance", '{}'::jsonb) || jsonb_build_object(
    'metadataMode', 'safe-default-artboard-no-state-machine',
    'updatedByMigration', '20260502054500_battle_bot_rive_safe_metadata'
  ),
  "updated_at" = CURRENT_TIMESTAMP
WHERE "bot_key" IN ('bot_j1', 'bot_j2', 'bot_j3', 'bot_j4')
   OR "name" IN ('Kuroda J1 Mentor', 'Mika J4 Coach', 'Sato J3 Rival', 'Hayashi J2 Challenger');

UPDATE "learning"."battle_bot"
SET "bot_key" = CASE "name"
  WHEN 'Kuroda J1 Mentor' THEN 'bot_j1'
  WHEN 'Mika J4 Coach' THEN 'bot_j2'
  WHEN 'Sato J3 Rival' THEN 'bot_j3'
  WHEN 'Hayashi J2 Challenger' THEN 'bot_j4'
  ELSE "bot_key"
END
WHERE "name" IN ('Kuroda J1 Mentor', 'Mika J4 Coach', 'Sato J3 Rival', 'Hayashi J2 Challenger')
  AND "bot_key" LIKE 'bot\_%';
