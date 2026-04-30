export type DailyWidgetKind =
  | "time_greeting"
  | "weather"
  | "seasonal_word"
  | "calendar_note"
  | "life_situation"
  | "business_phrase"
  | "commute_phrase"
  | "nhk_news";

export interface DailyGreeting {
  japanese: string;
  reading: string;
}

export function greetingForHour(hour: number): DailyGreeting {
  if (hour < 11) {
    return { japanese: "おはようございます", reading: "ohayou gozaimasu" };
  }
  if (hour < 18) {
    return { japanese: "お疲れさまです", reading: "otsukaresama desu" };
  }
  return { japanese: "こんばんは", reading: "konbanwa" };
}

export function todayDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
