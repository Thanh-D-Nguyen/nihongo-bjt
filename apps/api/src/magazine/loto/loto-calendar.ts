import { BadRequestException } from "@nestjs/common";

import { LOTO_SCHEDULE, type LotoGame } from "./loto-types.js";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export function assertDateKey(value: string): string {
  if (!DATE_KEY_PATTERN.test(value)) {
    throw new BadRequestException("Date must use YYYY-MM-DD format");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException("Invalid calendar date");
  }
  return value;
}

/** PostgreSQL DATE values are represented at UTC midnight by Prisma. */
export function toDatabaseDate(dateKey: string): Date {
  return new Date(`${assertDateKey(dateKey)}T00:00:00.000Z`);
}

/** JST calendar date (UTC+9, no daylight-saving time). */
export function jstDateKey(at: Date): string {
  return new Date(at.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function isScheduledDrawDate(game: LotoGame, dateKey: string): boolean {
  return LOTO_SCHEDULE[game].drawDays.includes(toDatabaseDate(dateKey).getUTCDay());
}

/** First scheduled draw strictly after the supplied calendar date. */
export function nextScheduledDrawDate(game: LotoGame, afterDateKey: string): string {
  const cursor = toDatabaseDate(afterDateKey);
  for (let offset = 0; offset < 14; offset += 1) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (LOTO_SCHEDULE[game].drawDays.includes(cursor.getUTCDay())) {
      return cursor.toISOString().slice(0, 10);
    }
  }
  throw new BadRequestException(`Unable to resolve the next ${game} draw date`);
}

export function resolveAutopilotTarget(
  game: LotoGame,
  latestOfficialDrawDate: string,
  todayDate: string
):
  | { status: "ready"; targetDrawDate: string }
  | { status: "waiting_result"; targetDrawDate: string } {
  const targetDrawDate = nextScheduledDrawDate(game, latestOfficialDrawDate);
  return targetDrawDate <= assertDateKey(todayDate)
    ? { status: "waiting_result", targetDrawDate }
    : { status: "ready", targetDrawDate };
}
