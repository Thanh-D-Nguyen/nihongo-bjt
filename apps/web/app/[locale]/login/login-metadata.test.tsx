import { describe, expect, it } from "vitest";
import viMessages from "../../../messages/vi.json";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import { generateMetadata } from "./layout";

describe("login metadata", () => {
  it.each([["vi", viMessages], ["en", en], ["ja", ja]] as const)("provides server metadata in %s", async (locale, copy) => {
    expect(await generateMetadata({ params: Promise.resolve({ locale }) })).toEqual({ title: `${copy.auth.login.title} — KotobaWorks` });
  });
});
