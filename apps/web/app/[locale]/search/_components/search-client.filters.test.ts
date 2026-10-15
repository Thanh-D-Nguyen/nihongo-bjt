import type { SearchResult } from "@nihongo-bjt/shared";
import { describe, expect, it } from "vitest";

import { filterSearchResults } from "./search-client";

const results: SearchResult[] = [
  { description: null, id: "g-n4", jlptLevel: "N4", kind: "grammar", reading: null, title: "ために" },
  { description: null, id: "g-n3", jlptLevel: "N3", kind: "grammar", reading: null, title: "ため(に)" },
  { description: null, id: "v-n4", jlptLevel: "N4,N1", kind: "lexeme", reading: "かいぎ", title: "会議" }
];

describe("search result filters", () => {
  it("combines content-kind and JLPT level filters", () => {
    expect(filterSearchResults(results, "all", "N4").map((item) => item.id)).toEqual([
      "g-n4",
      "v-n4"
    ]);
    expect(filterSearchResults(results, "grammar", "N4").map((item) => item.id)).toEqual([
      "g-n4"
    ]);
  });

  it("keeps all hits when the level filter is empty", () => {
    expect(filterSearchResults(results, "all", "")).toEqual(results);
  });
});
