---
name: pnpm symlinks + Metro bundler
description: Metro cannot follow pnpm virtual-store symlinks without explicit config; also, packages must be installed at the SDK-pinned version or Metro may crash.
---

## Rule
When adding a new package to the Biz360 Expo app via pnpm, two things must hold:
1. The version must match what Expo SDK expects (check `expo doctor` / workflow startup warnings).
2. `metro.config.js` must have `config.resolver.unstable_enableSymlinks = true`.

**Why:** pnpm installs packages as symlinks into a virtual store (`.pnpm/<pkg>@<ver>/node_modules/<pkg>`). Metro's default resolver does not follow symlinks, so it reports "module not found" even though the symlink exists in `node_modules/`. Enabling `unstable_enableSymlinks` tells Metro to resolve through the symlink chain.

**How to apply:** Any time a new native/third-party package is added with `pnpm add` and Metro throws `UnableToResolveError`, check:
- Is `unstable_enableSymlinks = true` in `metro.config.js`? (already set after this fix)
- Is the installed version the SDK-expected version? Run `pnpm exec expo install <pkg>` instead of bare `pnpm add <pkg>` to get the pinned version automatically.

## Current metro.config.js state (biz360)
```js
config.resolver.unstable_enableSymlinks = true;
config.resolver.nodeModulesPaths = [projectRoot/node_modules, workspaceRoot/node_modules];
config.watchFolders = [workspaceRoot];
```
