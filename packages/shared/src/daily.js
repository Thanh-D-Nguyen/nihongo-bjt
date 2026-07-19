export function greetingForHour(hour) {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        throw new RangeError("hour must be an integer between 0 and 23");
    }
    if (hour < 11) {
        return { japanese: "おはようございます", reading: null };
    }
    if (hour < 18) {
        return { japanese: "お疲れさまです", reading: "おつかれさまです" };
    }
    return { japanese: "こんばんは", reading: null };
}
function timeZonePart(date, timeZone, part) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
        month: "2-digit",
        timeZone,
        year: "numeric"
    }).formatToParts(date);
    const value = parts.find((item) => item.type === part)?.value;
    if (!value)
        throw new RangeError(`Unable to resolve ${part} for timezone ${timeZone}`);
    return value;
}
export function hourInTimeZone(date, timeZone) {
    return Number(timeZonePart(date, timeZone, "hour"));
}
export function dateKeyInTimeZone(date, timeZone) {
    const year = timeZonePart(date, timeZone, "year");
    const month = timeZonePart(date, timeZone, "month");
    const day = timeZonePart(date, timeZone, "day");
    return `${year}-${month}-${day}`;
}
export function todayDateKey(date) {
    return date.toISOString().slice(0, 10);
}
