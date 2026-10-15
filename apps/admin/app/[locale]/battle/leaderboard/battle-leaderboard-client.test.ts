import { describe, expect, it } from "vitest";

import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import viMessages from "../../../../messages/vi.json";

const messages = { en, ja, vi: viMessages };

describe("Admin battle leaderboard localization", () => {
  it.each(Object.entries(messages))("translates the completed-match summary in %s", (_locale, localeMessages) => {
    const label = localeMessages.adminConsole.battleLeaderboard.summaryMatches;
    expect(label).toBeTypeOf("string");
    expect(label).not.toBe("summaryMatches");
  });
});
