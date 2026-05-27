---
name: API KV Store migration
description: How Biz360 stores data — migrated from AsyncStorage to shared PostgreSQL KV API
---

## The Rule
All Biz360 app data (admin, messages, broker leads/team) is stored server-side via a simple key-value API, not AsyncStorage. This makes data consistent across phone + computer.

## How it works
- `lib/db/src/schema/kv.ts` — `kv_store` table (`key TEXT PK, value JSONB, updated_at TIMESTAMPTZ`)
- `artifacts/api-server/src/routes/biz360.ts` — `GET /api/biz360/kv/:key` + `PUT /api/biz360/kv/:key`
- `artifacts/biz360/lib/apiStore.ts` — thin `apiGet<T>(key)` / `apiSet<T>(key, value)` wrapper
- `adminStore.ts`, `messageStore.ts`, `brokerStore.ts` all import from `apiStore` — no AsyncStorage dependency

## API base URL
`process.env.EXPO_PUBLIC_DOMAIN` (set to `$REPLIT_DEV_DOMAIN` in biz360 dev script).
Full URL: `https://${EXPO_PUBLIC_DOMAIN}/api/biz360/kv/${encodeURIComponent(key)}`

## Why
- `EXPO_PUBLIC_DOMAIN` is the Replit dev domain, reachable from Expo Go on any device
- API is at `/api/...` (NOT `/api-server/api/...`) — confirmed by health check

## db package build note
`@workspace/db` emits `.d.ts` to `lib/db/dist/`. After any schema change, run `cd lib/db && pnpm tsc --build` before running TypeScript checks on the API server, or the server will fail with "no exported member" errors.
