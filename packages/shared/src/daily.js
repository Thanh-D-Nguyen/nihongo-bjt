export function greetingForHour(hour) {
    if (hour < 11) {
        return { japanese: "おはようございます", reading: "ohayou gozaimasu" };
    }
    if (hour < 18) {
        return { japanese: "お疲れさまです", reading: "otsukaresama desu" };
    }
    return { japanese: "こんばんは", reading: "konbanwa" };
}
export function todayDateKey(date) {
    return date.toISOString().slice(0, 10);
}
