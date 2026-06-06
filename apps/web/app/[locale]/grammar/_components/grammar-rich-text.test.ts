import { describe, expect, it } from "vitest";

import { grammarTextPreview, sanitizeGrammarHtml } from "./grammar-rich-text";

describe("grammar rich text helpers", () => {
  it("keeps learner formatting but removes unsafe HTML", () => {
    const safe = sanitizeGrammarHtml(
      "<p><strong>Quan trọng</strong>: dùng trong BJT.</p><script>alert(1)</script><img src=x onerror=alert(1)>"
    );

    expect(safe).toContain("<strong>Quan trọng</strong>");
    expect(safe).toContain("<p>");
    expect(safe).not.toContain("<script");
    expect(safe).not.toContain("<img");
    expect(safe).not.toContain("onerror");
  });

  it("builds clean previews from html explanations", () => {
    expect(
      grammarTextPreview("<p>Diễn tả <strong>nghĩa vụ</strong>.</p><ul><li>Không lộ tag</li></ul>")
    ).toBe("Diễn tả nghĩa vụ . Không lộ tag");
  });
});
