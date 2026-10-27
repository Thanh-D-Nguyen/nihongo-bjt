// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/vi.json";

vi.mock("next/navigation", () => ({ usePathname: () => "/vi/login", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../../lib/go-auth-provider", () => ({ useGoAuth: () => ({ isAuthenticated: false, loading: false }) }));
vi.mock("../../_components/announcement-strip", () => ({ AnnouncementStrip: () => null }));
vi.mock("../../_components/companion-bot", () => ({ CompanionBot: () => null }));
vi.mock("../../_components/search-dropdown", () => ({ SearchDropdown: () => null }));

import { LearnerAppFrame } from "../../_components/learner-app-frame";

describe("login site chrome", () => {
  it("renders the site header and footer around login", () => {
    const html = renderToStaticMarkup(<LearnerAppFrame locale="vi" nav={messages.nav} companionLabels={messages.nav.companion} searchLabels={messages.search}><p>Login form</p></LearnerAppFrame>);
    expect(html).toContain("<header");
    expect(html).toContain("<footer");
    expect(html).toContain("Login form");
  });
});
