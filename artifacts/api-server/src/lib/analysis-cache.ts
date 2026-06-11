/**
 * Short-lived in-memory cache for lease analysis results.
 *
 * After a lease document is analysed, the result is stored here keyed by a UUID
 * (analysisId) returned to the client. The client can then call
 * POST /api/lease-templates { analysedLeaseId } to trigger idempotent template
 * extraction — either fetching an already-generated template or running extraction
 * synchronously if the background task hasn't completed yet.
 *
 * Entries expire after 2 hours to balance usability and memory pressure.
 */

const EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

interface CacheEntry {
  data:    Record<string, unknown>;
  expiry:  number;
}

const cache = new Map<string, CacheEntry>();

// Periodic cleanup every 30 minutes — unref() so the timer doesn't block process exit.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiry < now) cache.delete(key);
  }
}, 30 * 60 * 1000).unref();

export function setAnalysis(id: string, data: Record<string, unknown>): void {
  cache.set(id, { data, expiry: Date.now() + EXPIRY_MS });
}

export function getAnalysis(id: string): Record<string, unknown> | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (entry.expiry < Date.now()) {
    cache.delete(id);
    return null;
  }
  return entry.data;
}

// ─── Async job status store ───────────────────────────────────────────────────
// Used by the async lease-analysis pattern: POST returns a jobId immediately,
// client polls GET /api/lease-analysis/status/:jobId until complete or failed.

export type JobStatus = "pending" | "complete" | "failed";

interface JobEntry {
  status:  JobStatus;
  data?:   Record<string, unknown>;
  error?:  string;
  expiry:  number;
}

const jobStore = new Map<string, JobEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of jobStore.entries()) {
    if (entry.expiry < now) jobStore.delete(key);
  }
}, 30 * 60 * 1000).unref();

export function setJobPending(id: string): void {
  jobStore.set(id, { status: "pending", expiry: Date.now() + EXPIRY_MS });
}

export function setJobComplete(id: string, data: Record<string, unknown>): void {
  jobStore.set(id, { status: "complete", data, expiry: Date.now() + EXPIRY_MS });
}

export function setJobFailed(id: string, error: string): void {
  jobStore.set(id, { status: "failed", error, expiry: Date.now() + EXPIRY_MS });
}

export function getJob(id: string): JobEntry | null {
  const entry = jobStore.get(id);
  if (!entry) return null;
  if (entry.expiry < Date.now()) {
    jobStore.delete(id);
    return null;
  }
  return entry;
}
