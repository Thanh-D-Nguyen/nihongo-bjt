import { describe, expect, it } from "vitest";

import { negotiateLocale } from "./locale-negotiation";

describe("negotiateLocale", () => {
  it("falls back to the default locale without an Accept-Language header", () => {
    expect(negotiateLocale(null)).toBe("vi");
    expect(negotiateLocale("")).toBe("vi");
  });

  it("picks a supported language from the browser preference order", () => {
    expect(negotiateLocale("ja-JP,ja;q=0.9,en;q=0.8")).toBe("ja");
    expect(negotiateLocale("en-US,en;q=0.9")).toBe("en");
    expect(negotiateLocale("vi-VN,vi;q=0.9,en;q=0.8")).toBe("vi");
  });

  it("honours quality values over list order", () => {
    expect(negotiateLocale("en;q=0.5,ja;q=0.9")).toBe("ja");
  });

  it("skips unsupported languages and uses the next supported one", () => {
    expect(negotiateLocale("fr-FR,fr;q=0.9,en;q=0.7")).toBe("en");
  });

  it("falls back to the default locale when no requested language is supported", () => {
    expect(negotiateLocale("fr-FR,de;q=0.8")).toBe("vi");
  });

  it("ignores languages explicitly refused with q=0", () => {
    expect(negotiateLocale("ja;q=0,en;q=0.5")).toBe("en");
  });

  it("ignores malformed quality values", () => {
    expect(negotiateLocale("ja;q=abc,en;q=0.5")).toBe("en");
  });

  it("ignores quality values outside the RFC 9110 qvalue syntax", () => {
    expect(negotiateLocale("ja;q=1.5,en;q=0.5")).toBe("en");
    expect(negotiateLocale("ja;q=1e0,en;q=0.5")).toBe("en");
    expect(negotiateLocale("ja;q=0x1,en;q=0.5")).toBe("en");
  });

  it("recognises the quality parameter name case-insensitively", () => {
    expect(negotiateLocale("en;q=0.9,ja;Q=0.5")).toBe("en");
    expect(negotiateLocale("ja;Q=0.9,en;q=0.5")).toBe("ja");
  });

  it("treats a refused or malformed language as unsupported, not as a match", () => {
    expect(negotiateLocale("ja;q=0")).toBe("vi");
    expect(negotiateLocale("fr,ja;q=0")).toBe("vi");
    expect(negotiateLocale("fr,ja;q=abc")).toBe("vi");
  });

  it("breaks equal quality ties by header order", () => {
    expect(negotiateLocale("en,ja")).toBe("en");
    expect(negotiateLocale("ja,en")).toBe("ja");
  });

  it("ignores quality parameters that are not exactly q=<qvalue>", () => {
    expect(negotiateLocale("en;q=0.9,ja;q = 0.1")).toBe("en");
    expect(negotiateLocale("en;q=0.9,ja;q")).toBe("en");
  });

  it("matches Vietnamese by its own tag rather than by the default fallback", () => {
    expect(negotiateLocale("en;q=0.5,vi;q=0.9")).toBe("vi");
  });

  it("matches language tags case-insensitively", () => {
    expect(negotiateLocale("JA-jp")).toBe("ja");
  });
});
