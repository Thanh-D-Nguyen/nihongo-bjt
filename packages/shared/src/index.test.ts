import { describe, expect, it } from "vitest";

import {
  completeMediaUploadSchema,
  mediaReadUrlQuerySchema,
  searchQuerySchema,
  updateMediaRightsMetadataSchema
} from "./index.js";

describe("searchQuerySchema", () => {
  it("rejects empty searches and caps limit", () => {
    expect(searchQuerySchema.safeParse({ q: "" }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ limit: "100", q: "会議" }).success).toBe(false);
  });

  it("accepts a normalized search query", () => {
    expect(searchQuerySchema.parse({ limit: "5", q: " 会議 " })).toEqual({
      limit: 5,
      q: "会議"
    });
  });
});

describe("completeMediaUploadSchema", () => {
  it("rejects empty byte size and oversized values", () => {
    const uid = "a0000000-0000-4000-8000-000000000001";
    expect(
      completeMediaUploadSchema.safeParse({ assetId: uid, byteSize: 0, userId: uid }).success
    ).toBe(false);
    expect(
      completeMediaUploadSchema.safeParse({ assetId: uid, byteSize: 20 * 1024 * 1024, userId: uid })
        .success
    ).toBe(false);
  });

  it("accepts a completed upload report", () => {
    const uid = "a0000000-0000-4000-8000-000000000001";
    expect(completeMediaUploadSchema.parse({ assetId: uid, byteSize: 1200, userId: uid })).toEqual({
      assetId: uid,
      byteSize: 1200,
      userId: uid
    });
  });
});

describe("mediaReadUrlQuerySchema", () => {
  it("requires a user id for read access checks", () => {
    const uid = "a0000000-0000-4000-8000-000000000001";
    expect(mediaReadUrlQuerySchema.parse({ userId: uid })).toEqual({ userId: uid });
  });
});

describe("updateMediaRightsMetadataSchema", () => {
  it("accepts accessibility + provenance metadata payload", () => {
    const uid = "a0000000-0000-4000-8000-000000000001";
    expect(
      updateMediaRightsMetadataSchema.parse({
        accessibility: {
          altText: "Tax terminology chart for reading practice",
          caption: "Sample usage context for business communication",
          reducedMotionSafe: true
        },
        license: "CC-BY-4.0",
        provenance: {
          creatorName: "Nihongo BJT Team",
          sourceName: "Internal glossary"
        },
        userId: uid
      })
    ).toMatchObject({
      license: "CC-BY-4.0",
      userId: uid
    });
  });

  it("rejects provenance license evidence when url is not http(s)", () => {
    const uid = "a0000000-0000-4000-8000-000000000001";
    expect(
      updateMediaRightsMetadataSchema.safeParse({
        license: "CC-BY-4.0",
        provenance: { licenseEvidenceUrl: "ftp://example.com/evidence" },
        userId: uid
      }).success
    ).toBe(false);
  });
});
