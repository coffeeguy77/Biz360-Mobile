---
name: Vite static build for deployment
description: The exit360-web Vite bundle must be manually pre-built before deployment — it is NOT rebuilt automatically by the dev workflow.
---

# Vite static bundle must be pre-built before deployment

The exit360-web artifact serves from `artifacts/exit360-web/dist/public` (static files).
The production deployment runs the Vite build via `[services.production.build]` in artifact.toml, but the dev workflow (`pnpm run dev`) does NOT update `dist/public`.

**Why:** When code changes are made to the web app, the dev server (Vite HMR) serves them live, but `dist/public` stays at the previous build. Production serves the stale static files until the next publish that includes a fresh build.

**How to apply:** After significant web app changes, manually run:
```
PORT=25700 BASE_PATH=/ pnpm --filter @workspace/exit360-web run build
```
This regenerates `dist/public`. The publish step then deploys these pre-built files.

If the API changes are deployed but the web bundle is stale, users see old JavaScript — this caused equipment/locked section bugs persisting across multiple republishes.
