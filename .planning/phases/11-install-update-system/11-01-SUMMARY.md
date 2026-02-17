---
phase: 11-install-update-system
plan: 01
subsystem: database
tags: [memory, config, migration, file-system]

# Dependency graph
requires:
  - phase: 05-memory-system
    provides: "Memory modules (soul-manager, memory-curator, daily-logger)"
  - phase: 01-foundation
    provides: "CONFIG_DIR from @agentspace/core"
provides:
  - "Memory files resolved from ~/.config/agentspace/memory/ instead of package tree"
  - "Auto-migration from old __dirname location to CONFIG_DIR"
  - "First-run template seeding for SOUL.md and MEMORY.md"
  - "Shared ensure-memory.ts utility for file seeding/migration"
affects: [11-02-PLAN, 11-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ensureMemoryFile pattern: check CONFIG_DIR, fallback to template, copy on first use"
    - "import.meta.url isolated to single utility for template path resolution"

key-files:
  created:
    - packages/db/src/memory/ensure-memory.ts
  modified:
    - packages/db/src/memory/soul-manager.ts
    - packages/db/src/memory/memory-curator.ts
    - packages/db/src/memory/daily-logger.ts

key-decisions:
  - "Shared ensure-memory.ts utility over inline logic in each module"
  - "import.meta.url kept only in ensure-memory.ts for template path derivation"
  - "Template files retained in packages/db/memory-files/ as seeding source"

patterns-established:
  - "ensure-memory pattern: seed from template on first access, migrate from old location"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 11 Plan 01: Memory File Path Migration Summary

**Memory files relocated from package tree to ~/.config/agentspace/memory/ with auto-seeding and dev-mode migration via shared ensure-memory utility**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T07:45:11Z
- **Completed:** 2026-02-17T07:47:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- All three memory modules (soul-manager, memory-curator, daily-logger) resolve paths via CONFIG_DIR
- Shared ensure-memory.ts utility handles first-run seeding and dev-mode migration
- Template files preserved in packages/db/memory-files/ for install-time seeding
- install/update system can now safely replace packages/ without destroying user data

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor memory file paths from __dirname to CONFIG_DIR** - `1e9f2b1` (feat)
2. **Task 2: Add auto-migration and first-run seeding logic** - `ebfb11a` (feat)

## Files Created/Modified
- `packages/db/src/memory/ensure-memory.ts` - Shared utility for template seeding and migration
- `packages/db/src/memory/soul-manager.ts` - SOUL.md resolved from CONFIG_DIR/memory/
- `packages/db/src/memory/memory-curator.ts` - MEMORY.md resolved from CONFIG_DIR/memory/
- `packages/db/src/memory/daily-logger.ts` - Daily logs resolved from CONFIG_DIR/memory/daily/

## Decisions Made
- Created shared `ensure-memory.ts` utility rather than duplicating seeding logic in each module
- Kept `import.meta.url` usage isolated to `ensure-memory.ts` for template path derivation only
- Template files in `packages/db/memory-files/` retained as seeding source (not deleted)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed remaining resolve() calls in daily-logger.ts**
- **Found during:** Task 1 (Path refactoring)
- **Issue:** After removing `resolve` import, two calls to `resolve()` remained in getTodayLogPath and getYesterdayLogPath
- **Fix:** Changed `resolve()` to `join()` which was already imported
- **Files modified:** packages/db/src/memory/daily-logger.ts
- **Verification:** Build succeeds
- **Committed in:** 1e9f2b1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correction to complete the import replacement. No scope creep.

## Issues Encountered
- Pre-existing cyclic dependency between @agentspace/cli and @agentspace/gateway prevents `pnpm build` from root. Individual package builds work fine. Out of scope for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Memory files now stored outside the code directory, safe for install/update operations
- Plans 11-02 (installer) and 11-03 (updater) can proceed knowing user data is protected
- Template seeding ready for fresh installs

## Self-Check: PASSED

All files verified present. Both commits (1e9f2b1, ebfb11a) confirmed in git log.

---
*Phase: 11-install-update-system*
*Completed: 2026-02-17*
