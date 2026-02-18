---
quick_task: 1
description: "Fix install.sh build order: gateway depends on cli/vault, cli must build before gateway"
date: 2026-02-18
commit: 744d831
---

## What Changed

Fixed build order in `scripts/install.sh`, `scripts/update.sh`, and `ONESHEET.md`.

**Before:** `core → db → gateway → cli → telegram`
**After:** `core → db → cli → gateway → telegram`

## Why

Gateway imports from `@agentspace/cli/vault` (auth token, key management). When building from a fresh clone, cli's `dist/` doesn't exist yet, so gateway's tsc fails with `Cannot find module '@agentspace/cli/vault'`. Building cli before gateway resolves the dependency.

## Files Modified

| File | Change |
|------|--------|
| `scripts/install.sh` | Build order fix |
| `scripts/update.sh` | Build order fix |
| `ONESHEET.md` | Dev mode build order fix |
