import { describe, expect, it } from "vitest";

import {
  buildDailySuggestedFlashcardBack,
  isLikelyVietnameseLegalDisclaimerOnlyBack,
  repairDailyContentFlashcardBackIfNeeded
} from "./daily-flashcard-back.js";

describe("buildDailySuggestedFlashcardBack", () => {
  it("uses bodyMd as main back and footnotes Vietnamese legal disclaimer", () => {
    const bodyMd = "Tình huống: ngân hàng.";
    const expl = "Nội dung chỉ phục vụ học tiếng Nhật theo ngữ cảnh, không phải tư vấn tài chính.";
    const out = buildDailySuggestedFlashcardBack(bodyMd, expl);
    expect(out.startsWith(bodyMd)).toBe(true);
    expect(out).toContain("— ");
    expect(out).toContain("tư vấn tài chính");
  });

  it("uses explanation when bodyMd is meta / dev placeholder", () => {
    const bodyMd = "Fallback weather provider khi chưa cấu hình API.";
    const expl = "Câu small talk về thời tiết.";
    expect(buildDailySuggestedFlashcardBack(bodyMd, expl)).toBe(expl);
  });

  it("appends coaching explanation when it is not duplicate and not disclaimer", () => {
    const bodyMd = "Tình huống: tàu chậm.";
    const expl = "Nói ngắn, ghi rõ phút dự kiến.";
    const out = buildDailySuggestedFlashcardBack(bodyMd, expl);
    expect(out).toContain(bodyMd);
    expect(out).toContain(expl);
  });
});

describe("repairDailyContentFlashcardBackIfNeeded", () => {
  const disclaimer =
    "Nội dung chỉ phục vụ học tiếng Nhật theo ngữ cảnh, không phải tư vấn tài chính.";

  it("rebuilds when persisted back equals disclaimer only", () => {
    const bodyMd = "Ý câu: Xin được cho biết giấy tờ cần thiết để mở tài khoản ngân hàng.";
    const fixed = repairDailyContentFlashcardBackIfNeeded(disclaimer, bodyMd, disclaimer);
    expect(fixed).not.toBeNull();
    expect(fixed!.startsWith(bodyMd)).toBe(true);
    expect(fixed).toContain("— ");
  });

  it("rebuilds via loose match when back is disclaimer-only but expl differs slightly", () => {
    const bodyMd = "Tình huống: bạn đến quầy ngân hàng.\n\nÝ câu: hỏi giấy tờ.";
    const expl = disclaimer;
    const persisted = disclaimer.replace("chính.", "chính"); // typo / no period
    const fixed = repairDailyContentFlashcardBackIfNeeded(persisted, bodyMd, expl);
    expect(fixed).not.toBeNull();
    expect(fixed).toContain("Tình huống");
    expect(fixed).toContain("— ");
  });

  it("returns null when back already has learning content", () => {
    const bodyMd = "Ý câu: ...";
    const full = buildDailySuggestedFlashcardBack(bodyMd, disclaimer);
    expect(repairDailyContentFlashcardBackIfNeeded(full, bodyMd, disclaimer)).toBeNull();
  });

  it("returns null when explanation missing", () => {
    expect(repairDailyContentFlashcardBackIfNeeded(disclaimer, "Tình huống: test.", null)).toBeNull();
  });
});

describe("isLikelyVietnameseLegalDisclaimerOnlyBack", () => {
  it("flags single-line safeguard copy", () => {
    expect(
      isLikelyVietnameseLegalDisclaimerOnlyBack(
        "Nội dung chỉ phục vụ học tiếng Nhật theo ngữ cảnh, không phải tư vấn tài chính."
      )
    ).toBe(true);
  });
  it("does not flag full situational back", () => {
    expect(
      isLikelyVietnameseLegalDisclaimerOnlyBack(
        "Tình huống: ngân hàng.\n\n— Nội dung chỉ phục vụ học tiếng Nhật theo ngữ cảnh, không phải tư vấn tài chính."
      )
    ).toBe(false);
  });
});
