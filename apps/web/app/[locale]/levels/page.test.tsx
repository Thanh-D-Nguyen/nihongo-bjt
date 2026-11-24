import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((destination: string): never => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirectMock(destination)
}));
vi.mock("./_components/levels-client", () => ({
  LevelsClient: () => null
}));

import LevelsPage from "./page";

type LevelsPageFn = (props: {
  params: Promise<{ locale: "vi" | "ja" | "en" }>;
  searchParams?: Promise<{ track?: string | string[] }>;
}) => Promise<unknown>;

const invokeLevelsPage: LevelsPageFn = LevelsPage;

afterEach(() => {
  redirectMock.mockClear();
});

describe("LevelsPage track deep links", () => {
  it("redirects ?track=scenarios to /[locale]/scenarios and ?track=reading to /[locale]/news across locales", async () => {
    for (const locale of ["vi", "ja", "en"] as const) {
      for (const [track, expected] of [
        ["scenarios", `/${locale}/scenarios`],
        ["reading", `/${locale}/news`]
      ] as const) {
        redirectMock.mockClear();
        let caught: unknown = null;
        try {
          await invokeLevelsPage({
            params: Promise.resolve({ locale }),
            searchParams: Promise.resolve({ track })
          });
        } catch (err) {
          caught = err;
        }

        expect(
          redirectMock,
          `LevelsPage must server-redirect /${locale}/levels?track=${track} to ${expected}`
        ).toHaveBeenCalledWith(expected);
        expect(String(caught)).toContain(`NEXT_REDIRECT:${expected}`);
      }
    }
  });

  it("renders LevelsClient with studyTrackLabels when no redirect track is specified", async () => {
    const tree = (await invokeLevelsPage({
      params: Promise.resolve({ locale: "vi" }),
      searchParams: Promise.resolve({})
    })) as React.ReactElement<{
      locale: string;
      studyTrackLabels?: {
        ariaLabel: string;
        levelsTab: string;
        scenariosTab: string;
        readingTab: string;
      };
    }>;

    expect(redirectMock).not.toHaveBeenCalled();
    expect(tree.props.locale).toBe("vi");
    expect(
      tree.props.studyTrackLabels,
      "LevelsPage must pass studyTrackLabels to LevelsClient"
    ).toEqual({
      ariaLabel: "Lộ trình học tập",
      levelsTab: "Lộ trình BJT",
      scenariosTab: "Tình huống công sở",
      readingTab: "Đọc NHK"
    });
  });
});
