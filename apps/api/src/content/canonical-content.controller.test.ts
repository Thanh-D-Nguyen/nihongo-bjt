import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { BadRequestException, NotFoundException, StreamableFile } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import {
  DictionaryController,
  ExamplesController,
  GrammarController,
  KanjiController,
  VijaController
} from "./canonical-content.controller.js";

describe("Canonical content controllers", () => {
  it("routes dictionary search and detail through content repository", async () => {
    const contentRepository = {
      lexemeDetail: vi.fn().mockResolvedValue({ id: "lex-1" }),
      lexemes: vi.fn().mockResolvedValue([{ headword: "会議", id: "lex-1" }])
    };
    const controller = new DictionaryController(contentRepository as any);

    await expect(controller.search({ limit: "5", q: "会議" })).resolves.toEqual([
      { headword: "会議", id: "lex-1" }
    ]);
    expect(contentRepository.lexemes).toHaveBeenCalledWith("会議", 5);

    await expect(controller.detail("lex-1")).resolves.toEqual({ id: "lex-1" });
    expect(contentRepository.lexemeDetail).toHaveBeenCalledWith("lex-1");
  });

  it("rejects invalid dictionary search query", async () => {
    const controller = new DictionaryController({ lexemes: vi.fn() } as any);

    expect(() => controller.search({ q: "" })).toThrow(BadRequestException);
  });

  it("maps kanji list/search/detail to repository", async () => {
    const contentRepository = {
      kanji: vi.fn().mockResolvedValue([{ character: "会", id: "kanji-1" }]),
      kanjiDetail: vi.fn().mockResolvedValue({ character: "会", id: "kanji-1" })
    };
    const mediaService = { streamPublicBucketObject: vi.fn() };
    const controller = new KanjiController(contentRepository as any, mediaService as any);

    await expect(controller.list({ level: "N3", limit: "2" })).resolves.toEqual([
      { character: "会", id: "kanji-1" }
    ]);
    expect(contentRepository.kanji).toHaveBeenCalledWith("N3", 2);

    await expect(controller.search({ q: "会", limit: "3" })).resolves.toEqual([
      { character: "会", id: "kanji-1" }
    ]);
    expect(contentRepository.kanji).toHaveBeenLastCalledWith("会", 3);

    await expect(controller.detail("kanji-1")).resolves.toEqual({ character: "会", id: "kanji-1" });
    expect(contentRepository.kanjiDetail).toHaveBeenCalledWith("kanji-1");
  });

  it("prefers explicit q over level aliases for kanji and grammar lists", async () => {
    const contentRepository = {
      grammar: vi.fn().mockResolvedValue([]),
      kanji: vi.fn().mockResolvedValue([])
    };

    const mediaService = { streamPublicBucketObject: vi.fn() };
    await expect(new KanjiController(contentRepository as any, mediaService as any).list({ level: "N2", limit: "2", q: "会" })).resolves.toEqual([]);
    expect(contentRepository.kanji).toHaveBeenCalledWith("会", 2);

    await expect(new GrammarController(contentRepository as any).list({ level: "N3", limit: "4", q: "受け身" })).resolves.toEqual([]);
    expect(contentRepository.grammar).toHaveBeenCalledWith("受け身", 4);
  });

  it("maps grammar list/detail to repository and propagates not found", async () => {
    const contentRepository = {
      grammar: vi.fn().mockResolvedValue([{ id: "grammar-1", pattern: "〜ことがある" }]),
      grammarDetail: vi.fn().mockRejectedValue(new NotFoundException("Grammar point not found"))
    };
    const controller = new GrammarController(contentRepository as any);

    await expect(controller.list({ q: "こと", limit: "4" })).resolves.toEqual([
      { id: "grammar-1", pattern: "〜ことがある" }
    ]);
    expect(contentRepository.grammar).toHaveBeenCalledWith("こと", 4);

    await expect(controller.detail("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("maps examples list/by-word/search variants to repository", async () => {
    const contentRepository = {
      examples: vi.fn().mockResolvedValue([{ id: "ex-1", japaneseText: "会議に行きます。" }]),
      examplesByWord: vi.fn().mockResolvedValue([{ id: "ex-2", japaneseText: "会議は三時です。" }])
    };
    const controller = new ExamplesController(contentRepository as any);

    await expect(controller.list({ q: "会議", limit: "2" })).resolves.toEqual([
      { id: "ex-1", japaneseText: "会議に行きます。" }
    ]);
    expect(contentRepository.examples).toHaveBeenCalledWith("会議", 2);

    await expect(controller.byWord("lex-1", { limit: "6" })).resolves.toEqual([
      { id: "ex-2", japaneseText: "会議は三時です。" }
    ]);
    expect(contentRepository.examplesByWord).toHaveBeenCalledWith("lex-1", 6);

    await expect(controller.search({ keyword: "出張", limit: "3" })).resolves.toEqual([
      { id: "ex-1", japaneseText: "会議に行きます。" }
    ]);
    expect(contentRepository.examples).toHaveBeenLastCalledWith("出張", 3);
  });

  it("rejects invalid pagination and prefers keyword over q for example search", async () => {
    const contentRepository = {
      examples: vi.fn().mockResolvedValue([]),
      examplesByWord: vi.fn()
    };
    const controller = new ExamplesController(contentRepository as any);

    await expect(controller.search({ keyword: "商談", limit: "5", q: "会議" })).resolves.toEqual([]);
    expect(contentRepository.examples).toHaveBeenCalledWith("商談", 5);

    expect(() => controller.byWord("lex-1", { limit: "0" })).toThrow(BadRequestException);
  });

  it("routes reverse dictionary search through projection repository", async () => {
    const contentRepository = {
      reverseSearch: vi.fn().mockResolvedValue([{ id: "rev-1", vietnameseHeadword: "họp" }])
    };
    const controller = new VijaController(contentRepository as any);

    await expect(controller.search({ q: "họp", limit: "8" })).resolves.toEqual([
      { id: "rev-1", vietnameseHeadword: "họp" }
    ]);
    expect(contentRepository.reverseSearch).toHaveBeenCalledWith("họp", 8);
  });

  it("rejects invalid reverse search input", () => {
    const controller = new VijaController({ reverseSearch: vi.fn() } as any);

    expect(() => controller.search({ q: "" })).toThrow(BadRequestException);
  });

  it("streams repo-relative stroke SVG from disk without calling object storage", async () => {
    const prev = process.env.KANJI_STROKE_REPO_ROOT;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kanji-stroke-ctrl-"));
    fs.mkdirSync(path.join(tmp, "data", "generated", "kanji-strokes"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "data", "generated", "kanji-strokes", "1-aaaa.svg"), "<svg/>", "utf8");

    try {
      process.env.KANJI_STROKE_REPO_ROOT = tmp;
      const contentRepository = {
        kanjiStrokeSvgPath: vi.fn().mockResolvedValue("data/generated/kanji-strokes/1-aaaa.svg")
      };
      const mediaService = { streamPublicBucketObject: vi.fn() };
      const controller = new KanjiController(contentRepository as any, mediaService as any);
      const out = await controller.stroke("k-1");
      expect(mediaService.streamPublicBucketObject).not.toHaveBeenCalled();
      expect(out).toBeInstanceOf(StreamableFile);
      const body = out as StreamableFile;
      const chunks: Buffer[] = [];
      for await (const c of body.getStream()) chunks.push(Buffer.from(c));
      expect(Buffer.concat(chunks).toString("utf8")).toBe("<svg/>");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      if (prev === undefined) delete process.env.KANJI_STROKE_REPO_ROOT;
      else process.env.KANJI_STROKE_REPO_ROOT = prev;
    }
  });
});