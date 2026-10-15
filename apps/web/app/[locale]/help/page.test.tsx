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
});
