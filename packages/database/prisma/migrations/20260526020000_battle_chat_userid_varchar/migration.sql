-- AlterTable: change user_id from UUID to VARCHAR(64) to support bot identifiers (e.g. "bot:bot_j3")
ALTER TABLE learning.battle_chat_message ALTER COLUMN user_id TYPE VARCHAR(64);
