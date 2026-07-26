// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { act } = React;

const learnerApiFetchOptionalMock = vi.fn();
const authState: { userId: string | null } = { userId: null };
const decisionToken = "signed-decision-token-".padEnd(64, "x");

vi.mock("../../../../components/auth/keycloak-auth-provider", () => ({
  useKeycloakAuth: () => authState
}));

vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetchOptional: (...args: unknown[]) => learnerApiFetchOptionalMock(...args)
}));

import { AdSlot, isRenderableAdDecision } from "./ad-slot";

describe("AdSlot decision safety", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn()
      })
    });
    authState.userId = null;
    learnerApiFetchOptionalMock.mockReset();
  });

  it("never renders provider placeholders as real ads", () => {
    expect(
      isRenderableAdDecision({
        decisionKey: "local:no_active_campaign",
        eligible: true,
        payload: {
          campaign: {
            creativeType: "placeholder",
            id: "placeholder:home_feed_inline",
            name: "Ad space"
          }
        }
      })
    ).toBe(false);
  });

  it("renders an active configured campaign", () => {
    expect(
      isRenderableAdDecision({
        campaignId: "58bfc8a5-5e52-4ca2-9b8f-fb143601cfb7",
        decisionKey: "local:default",
        decisionToken,
        eligible: true,
        payload: {
          campaign: {
            creativeType: "storefront",
            destinationUrl: "https://example.com/store",
            id: "58bfc8a5-5e52-4ca2-9b8f-fb143601cfb7",
            name: "Storefront"
          }
        }
      })
    ).toBe(true);
  });

  it("requests, renders, and records a configured ad for an anonymous visitor", async () => {
    learnerApiFetchOptionalMock.mockImplementation((path: string) => {
      if (path === "/api/ads/decision") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              campaignId: "58bfc8a5-5e52-4ca2-9b8f-fb143601cfb7",
              decisionKey: "local:default",
              decisionToken,
              eligible: true,
              payload: {
                campaign: {
                  creativeType: "storefront",
                  destinationUrl: "https://example.com/store",
                  id: "58bfc8a5-5e52-4ca2-9b8f-fb143601cfb7",
                  name: "Anonymous storefront"
                }
              }
            }),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AdSlot
          labels={{
            advertisement: "Advertisement",
            opensInNewTab: "Opens in new tab",
            supportMessage: "Support",
            visitStore: "Visit"
          }}
          locale="vi"
          placementCode="home_feed_inline"
        />
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Anonymous storefront");
    const decisionCall = learnerApiFetchOptionalMock.mock.calls.find(
      ([path]) => path === "/api/ads/decision"
    );
    expect(decisionCall).toBeTruthy();
    expect(JSON.parse((decisionCall?.[1] as RequestInit).body as string)).toEqual({
      locale: "vi",
      placementCode: "home_feed_inline"
    });
    const impressionCall = learnerApiFetchOptionalMock.mock.calls.find(
      ([path]) => path === "/api/ads/impression"
    );
    expect(impressionCall).toBeTruthy();
    expect(JSON.parse((impressionCall?.[1] as RequestInit).body as string)).not.toHaveProperty(
      "userId"
    );
    expect(JSON.parse((impressionCall?.[1] as RequestInit).body as string)).toMatchObject({
      decisionToken
    });

    await act(async () => root.unmount());
    container.remove();
  });
});
