import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  emptyBjtImageJobCheckpoint,
  forgetBjtImageJob,
  parseBjtImageJobCheckpoint,
  readBjtImageJobCheckpoint,
  rememberBjtImageJob,
  resumableBjtImageJobId,
  writeBjtImageJobCheckpoint
} from "./bjt-image-job-store.js";

const record = {
  jobId: "job-1",
  model: "gpt-image",
  promptHashSha256: "hash-a",
  provider: "xkiro",
  submittedAt: "2026-08-27T00:00:00.000Z"
};

describe("BJT image job checkpoint", () => {
  it("resumes only when provider, model and prompt all match", () => {
    const checkpoint = rememberBjtImageJob(emptyBjtImageJobCheckpoint(), "q1", record);
    const expected = { model: "gpt-image", promptHashSha256: "hash-a", provider: "xkiro" };

    expect(resumableBjtImageJobId(checkpoint, "q1", expected)).toBe("job-1");
    expect(resumableBjtImageJobId(checkpoint, "q2", expected)).toBeNull();
    expect(
      resumableBjtImageJobId(checkpoint, "q1", { ...expected, promptHashSha256: "hash-b" })
    ).toBeNull();
    expect(resumableBjtImageJobId(checkpoint, "q1", { ...expected, model: "other" })).toBeNull();
    expect(
      resumableBjtImageJobId(checkpoint, "q1", { ...expected, provider: "openai" })
    ).toBeNull();
  });

  it("forgets a completed job without touching its siblings", () => {
    let checkpoint = rememberBjtImageJob(emptyBjtImageJobCheckpoint(), "q1", record);
    checkpoint = rememberBjtImageJob(checkpoint, "q2", { ...record, jobId: "job-2" });
    checkpoint = forgetBjtImageJob(checkpoint, "q1");

    expect(Object.keys(checkpoint.jobs)).toEqual(["q2"]);
  });

  it("degrades a corrupt, foreign or truncated checkpoint to an empty one", () => {
    expect(parseBjtImageJobCheckpoint(null).jobs).toEqual({});
    expect(parseBjtImageJobCheckpoint("{not json").jobs).toEqual({});
    expect(parseBjtImageJobCheckpoint('{"version":2,"jobs":{}}').jobs).toEqual({});
    expect(parseBjtImageJobCheckpoint('{"version":1,"jobs":{"q1":{"jobId":""}}}').jobs).toEqual({});
  });

  it("keeps only well-formed job records from a partially valid file", () => {
    const parsed = parseBjtImageJobCheckpoint(
      JSON.stringify({ jobs: { q1: record, q2: { jobId: "job-2" } }, version: 1 })
    );

    expect(Object.keys(parsed.jobs)).toEqual(["q1"]);
  });

  it("round-trips through an atomic file write", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bjt-image-jobs-"));
    const path = join(directory, "nested", "jobs.json");

    await writeBjtImageJobCheckpoint(path, rememberBjtImageJob(emptyBjtImageJobCheckpoint(), "q1", record));

    expect((await readBjtImageJobCheckpoint(path)).jobs.q1?.jobId).toBe("job-1");
    expect(await readFile(path, "utf8")).toContain('"jobId": "job-1"');
  });

  it("treats a missing or unreadable checkpoint as no pending jobs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bjt-image-jobs-"));
    const missing = join(directory, "absent.json");
    const garbage = join(directory, "garbage.json");
    await writeFile(garbage, "definitely not json", "utf8");

    expect((await readBjtImageJobCheckpoint(missing)).jobs).toEqual({});
    expect((await readBjtImageJobCheckpoint(garbage)).jobs).toEqual({});
  });
});
