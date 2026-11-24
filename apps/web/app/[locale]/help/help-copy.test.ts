import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
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

  it("directs learners to the Luyện thi / Exam Prep / 試験対策 nav item in faq3a", () => {
    expect(
      vi.helpPage.faq3a,
      "vi helpPage.faq3a must reference Luyện thi instead of old BJT menu label"
    ).toContain("Luyện thi");
    expect(vi.helpPage.faq3a).not.toContain('"BJT"');
    expect(en.helpPage.faq3a).toContain("Exam Prep");
    expect(ja.helpPage.faq3a).toContain("試験対策");
  });
});
