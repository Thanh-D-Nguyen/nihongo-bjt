import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Checkpoint for asynchronous image jobs (xKiro-style providers).
 *
 * A job is created on the provider, then polled for minutes. If the batch dies
 * in between, the job keeps running and stays billable. Persisting the job id
 * lets the next run resume it instead of submitting — and paying for — a
 * duplicate. The prompt hash is stored alongside so an edited imagePrompt or a
 * changed model never resumes a stale job.
 */
export interface BjtImageJobRecord {
  jobId: string;
  model: string;
  promptHashSha256: string;
  provider: string;
  submittedAt: string;
}

export interface BjtImageJobCheckpoint {
  jobs: Record<string, BjtImageJobRecord>;
  version: 1;
}

export function emptyBjtImageJobCheckpoint(): BjtImageJobCheckpoint {
  return { jobs: {}, version: 1 };
}

function isJobRecord(value: unknown): value is BjtImageJobRecord {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.jobId === "string" &&
    record.jobId.trim() !== "" &&
    typeof record.model === "string" &&
    typeof record.promptHashSha256 === "string" &&
    typeof record.provider === "string" &&
    typeof record.submittedAt === "string"
  );
}

/** Tolerant parse: a corrupt or foreign checkpoint degrades to "no jobs known". */
export function parseBjtImageJobCheckpoint(raw: string | null): BjtImageJobCheckpoint {
  if (raw === null || raw.trim() === "") return emptyBjtImageJobCheckpoint();

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return emptyBjtImageJobCheckpoint();
  }
  if (payload === null || typeof payload !== "object") return emptyBjtImageJobCheckpoint();

  const candidate = payload as { jobs?: unknown; version?: unknown };
  if (candidate.version !== 1 || candidate.jobs === null || typeof candidate.jobs !== "object") {
    return emptyBjtImageJobCheckpoint();
  }

  const jobs: Record<string, BjtImageJobRecord> = {};
  for (const [questionId, record] of Object.entries(candidate.jobs as Record<string, unknown>)) {
    if (isJobRecord(record)) jobs[questionId] = record;
  }
  return { jobs, version: 1 };
}

/**
 * Return a resumable job id for a question, or null when the checkpoint entry
 * does not match the run's provider, model and prompt exactly.
 */
export function resumableBjtImageJobId(
  checkpoint: BjtImageJobCheckpoint,
  questionId: string,
  expected: { model: string; promptHashSha256: string; provider: string }
): string | null {
  const record = checkpoint.jobs[questionId];
  if (!record) return null;
  if (record.provider !== expected.provider) return null;
  if (record.model !== expected.model) return null;
  if (record.promptHashSha256 !== expected.promptHashSha256) return null;
  return record.jobId;
}

export function rememberBjtImageJob(
  checkpoint: BjtImageJobCheckpoint,
  questionId: string,
  record: BjtImageJobRecord
): BjtImageJobCheckpoint {
  return { jobs: { ...checkpoint.jobs, [questionId]: record }, version: 1 };
}

export function forgetBjtImageJob(
  checkpoint: BjtImageJobCheckpoint,
  questionId: string
): BjtImageJobCheckpoint {
  const jobs = { ...checkpoint.jobs };
  delete jobs[questionId];
  return { jobs, version: 1 };
}

export async function readBjtImageJobCheckpoint(path: string): Promise<BjtImageJobCheckpoint> {
  try {
    return parseBjtImageJobCheckpoint(await readFile(path, "utf8"));
  } catch {
    return emptyBjtImageJobCheckpoint();
  }
}

/** Atomic write so a crash mid-save cannot truncate the checkpoint. */
export async function writeBjtImageJobCheckpoint(
  path: string,
  checkpoint: BjtImageJobCheckpoint
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}
