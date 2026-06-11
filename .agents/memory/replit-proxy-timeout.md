---
name: Replit proxy timeout + async jobs
description: Replit's HTTP proxy enforces a 2-minute timeout; long Anthropic calls must use an async job pattern to avoid silent connection drops.
---

# Replit proxy timeout + async jobs

## The rule
Any API route that calls Anthropic (or any other slow external service) and may take longer than ~90 seconds **must** use the async job pattern: return a `{ jobId }` immediately, run the work in `setImmediate`, and expose a `GET /status/:jobId` polling endpoint.

**Why:** Replit's infrastructure proxy enforces a hard 2-minute (120s) HTTP response timeout. Connections that don't respond within that window are silently dropped — the server logs `request aborted` with `statusCode: null` and `responseTime: ~121000`. The client receives a network error which surfaces as "Unknown error" on mobile. The Anthropic call itself may succeed, but the client is already gone.

**How to apply:**
- In the route handler: validate inputs fast (file type, text extraction), generate a UUID jobId, call `setJobPending(jobId)`, call `res.json({ jobId })`, then kick off the slow work inside `setImmediate(async () => { ... })`.
- In the background: call `setJobComplete(jobId, data)` on success or `setJobFailed(jobId, errorMsg)` on failure.
- Add `GET /api/<route>/status/:jobId` that reads from `getJob(jobId)` and returns `{ status }` / `{ status, data }` / `{ status, error }`.
- On the mobile client: POST → get jobId → `pollStatus()` recursive `setTimeout` every 4s with a 5-minute overall timeout; clean up on unmount via `useEffect` return + `useRef` for the timer handle.

**Infrastructure used:**
- `artifacts/api-server/src/lib/analysis-cache.ts` exports `setJobPending`, `setJobComplete`, `setJobFailed`, `getJob` (added alongside the existing `setAnalysis`/`getAnalysis`).
- Applied first to `artifacts/api-server/src/routes/lease-analysis/index.ts` + `artifacts/biz360/app/(seller)/leases/upload.tsx`.
