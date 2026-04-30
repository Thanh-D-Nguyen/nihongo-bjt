/** Day bucket in UTC (matches quota policy `windowCode` = `day` default). */
export function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
