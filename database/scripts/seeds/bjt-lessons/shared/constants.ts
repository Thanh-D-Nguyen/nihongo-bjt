import type { BjtLevel } from "../types.js";

export const CONTENT_VERSION = "2026.07.2";
export const CONTENT_VERSION_NUMBER = 2;
export const CONTENT_SCHEMA_VERSION = "bjt-lesson-document-v1" as const;
export const WEEKS_PER_LEVEL = 12;
export const CORE_LESSONS_PER_WEEK = 5;
export const UNITS_PER_WEEK = 7;
export const CORE_ACTIVITY_COUNT = 5;
export const REVIEW_ACTIVITY_COUNT = 8;
export const CHECKPOINT_ACTIVITY_COUNT = 10;
export const SEED_BATCH_SIZE = 20;

export const LEGACY_SLUG_SUFFIXES = [
  "greetings-intro",
  "office-daily",
  "email-writing",
  "meeting-discussion",
  "numbers-data"
] as const;

export function slugLevel(level: BjtLevel): string {
  return level.toLowerCase().replace("+", "plus");
}
