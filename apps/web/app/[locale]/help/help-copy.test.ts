import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import vi from "../../../messages/vi.json";

describe("localized Help copy", () => {
  it("uses grammatical English and only advertises the available feedback route", () => {
    expect(en.helpPage.subtitle).toBe("Need help? Find the answer here.");
    expect(en.helpPage.faq2a).toMatch(/^Yes\./);
    expect(en.helpPage.faq4a).toMatch(/^Yes\./);
    expect(en.helpPage.contactLink).toBe("Send feedback");
    expect(vi.helpPage.contactDesc).toBe(
      "Nếu bạn không tìm thấy câu trả lời, hãy gửi góp ý qua trang Góp ý."
    );
  });
});
