import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) =>
    createElement("a", props, children)
}));

import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import viMessages from "../../../messages/vi.json";
import PrivacyPolicyPage from "./page";

const linkLabels = {
  en: { settings: en.privacyPolicyPage.settingsPrivacyLink, feedback: en.privacyPolicyPage.feedbackLink },
  ja: { settings: ja.privacyPolicyPage.settingsPrivacyLink, feedback: ja.privacyPolicyPage.feedbackLink },
  vi: { settings: viMessages.privacyPolicyPage.settingsPrivacyLink, feedback: viMessages.privacyPolicyPage.feedbackLink }
};

describe("Privacy policy links", () => {
  it("directs data rights readers to privacy settings", async () => {
    for (const locale of ["vi", "en", "ja"] as const) {
      const page = await PrivacyPolicyPage({ params: Promise.resolve({ locale }) });
      const html = renderToStaticMarkup(page);

      expect(html).toContain(`href="/${locale}/settings/privacy"`);
      expect(html).toContain(linkLabels[locale].settings);
    }
  });

  it("links support contact to the localized feedback page", async () => {
    for (const locale of ["vi", "en", "ja"] as const) {
      const page = await PrivacyPolicyPage({ params: Promise.resolve({ locale }) });
      const html = renderToStaticMarkup(page);

      expect(html).toContain(`href="/${locale}/feedback"`);
      expect(html).toContain(linkLabels[locale].feedback);
    }
  });
});
