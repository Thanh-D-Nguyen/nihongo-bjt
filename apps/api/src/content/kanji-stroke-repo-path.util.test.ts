import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isRepoRelativeKanjiStrokePath,
  openKanjiStrokeRepoReadStream
} from "./kanji-stroke-repo-path.util.js";

describe("kanji-stroke-repo-path.util", () => {
  let prevRoot: string | undefined;
  let tmpRoot: string;

  beforeEach(() => {
    prevRoot = process.env.KANJI_STROKE_REPO_ROOT;
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bjt-kanji-stroke-"));
    fs.mkdirSync(path.join(tmpRoot, "data", "generated", "kanji-strokes"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, "data", "generated", "kanji-strokes", "256-04fc4.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
      "utf8"
    );
    process.env.KANJI_STROKE_REPO_ROOT = tmpRoot;
  });

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.KANJI_STROKE_REPO_ROOT;
    else process.env.KANJI_STROKE_REPO_ROOT = prevRoot;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("isRepoRelativeKanjiStrokePath detects allowed prefix", () => {
    expect(isRepoRelativeKanjiStrokePath("data/generated/kanji-strokes/1-a.svg")).toBe(true);
    expect(isRepoRelativeKanjiStrokePath("media/kanji/1.svg")).toBe(false);
  });

  it("opens a valid repo-relative path as a readable stream", async () => {
    const stream = openKanjiStrokeRepoReadStream("data/generated/kanji-strokes/256-04fc4.svg");
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(Buffer.from(c));
    expect(Buffer.concat(chunks).toString("utf8")).toContain("<svg");
  });

  it("rejects traversal or slashes in the filename segment", () => {
    expect(() =>
      openKanjiStrokeRepoReadStream("data/generated/kanji-strokes/../256-04fc4.svg")
    ).toThrow(BadRequestException);
    expect(() =>
      openKanjiStrokeRepoReadStream("data/generated/kanji-strokes/subdir/256-04fc4.svg")
    ).toThrow(BadRequestException);
  });

  it("rejects filenames outside the generator pattern", () => {
    expect(() => openKanjiStrokeRepoReadStream("data/generated/kanji-strokes/passwd.svg")).toThrow(
      BadRequestException
    );
  });

  it("throws NotFound when the file is missing", () => {
    expect(() =>
      openKanjiStrokeRepoReadStream("data/generated/kanji-strokes/999-99999.svg")
    ).toThrow(NotFoundException);
  });
});
