import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HelpPage from "./page";

describe("learner help page", () => {
  it("keeps FAQ disclosures and the contact link reachable on mobile", async () => {
    const page = await HelpPage({ params: Promise.resolve({ locale: "vi" }) });
    const html = renderToStaticMarkup(page);
    const summaries = html.match(/<summary\b[^>]*>/g) ?? [];
    const contactLink = html.match(/<a\b[^>]*href="\/vi\/feedback"[^>]*>/)?.[0] ?? "";

    expect(summaries).toHaveLength(4);
    expect(summaries.every((summary) => summary.includes("min-h-12")), "all FAQ summaries and contact link carry min-h-12").toBe(true);
    expect(contactLink).toContain("min-h-12");
  });

  it("uses the primary action token on the feedback CTA and replaces the native FAQ marker with a rotating themed chevron", async () => {
    const page = await HelpPage({ params: Promise.resolve({ locale: "vi" }) });
    const html = renderToStaticMarkup(page);
    const contactLink = html.match(/<a\b[^>]*href="\/vi\/feedback"[^>]*>/)?.[0] ?? "";
    const summaryBlocks = html.match(/<summary\b[\s\S]*?<\/summary>/g) ?? [];

    expect(contactLink, "feedback CTA must use the primary bg-action token").toContain("bg-action");
    expect(contactLink, "feedback CTA must include hover:bg-action-hover").toContain("hover:bg-action-hover");
    expect(contactLink, "feedback CTA must use text-white").toContain("text-white");
    expect(contactLink, "feedback CTA must not use off-palette bg-leaf").not.toContain("bg-leaf");

    expect(summaryBlocks).toHaveLength(4);
    for (const block of summaryBlocks) {
      expect(block, "FAQ summary must hide native list marker").toContain("list-none");
      expect(block, "FAQ summary must hide webkit details marker").toContain("[&amp;::-webkit-details-marker]:hidden");
      expect(block, "FAQ summary must render a themed chevron that rotates on open").toMatch(/<svg[^>]*group-open:rotate-180/);
    }
  });
});
