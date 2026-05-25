/** Map app locale to Intl BCP-47 locale tag for date/number formatting. */
export function toIntlLocale(locale: string): string {
  switch (locale) {
    case "ja":
      return "ja-JP";
    case "en":
      return "en-US";
    default:
      return "vi-VN";
  }
}
