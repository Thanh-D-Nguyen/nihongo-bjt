import { describe, expect, it } from "vitest";

import { ensureKanjivgXmlnsForDomParser, KANJIVG_XMLNS } from "./kanji-stroke-animation";

const MINIMAL_KANJIVG = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><g kvg:element="亜"><path d="M0,0 L1,1"/></g></svg>`;

describe("ensureKanjivgXmlnsForDomParser", () => {
  it("injects xmlns:kvg when kvg-prefixed attributes exist and declaration is missing", () => {
    const out = ensureKanjivgXmlnsForDomParser(MINIMAL_KANJIVG);
    expect(out).toContain(`xmlns:kvg="${KANJIVG_XMLNS}"`);
    expect(out.match(/xmlns:kvg/g)?.length).toBe(1);
  });

  it("does not duplicate xmlns:kvg", () => {
    const already = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:kvg="${KANJIVG_XMLNS}" width="1"><g kvg:element="x"/></svg>`;
    expect(ensureKanjivgXmlnsForDomParser(already)).toBe(already.trim());
  });

  it("leaves SVG without kvg attributes unchanged", () => {
    const plain = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0"/></svg>`;
    expect(ensureKanjivgXmlnsForDomParser(plain)).toBe(plain);
  });
});
