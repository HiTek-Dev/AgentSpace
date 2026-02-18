---
phase: quick-4
plan: 01
subsystem: docs
tags: [install, cli, gateway, uninstall, onboarding]

requires:
  - phase: 14-cli-setup-polish
    provides: "tek gateway subcommand, tek uninstall, skippable setup, model catalog"
provides:
  - "Accurate INSTALL.md reflecting all Phase 14 CLI changes"
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: [INSTALL.md]

key-decisions:
  - "Kept manual uninstall as fallback subsection under tek uninstall"
  - "Used double-dash (--) instead of em-dash for plain-text compatibility"

patterns-established: []

requirements-completed: [QUICK-4]

duration: 1min
completed: 2026-02-18
---

# Quick Task 4: Update INSTALL.md for Phase 14 Changes

**INSTALL.md updated with tek gateway start/stop/status, tek uninstall, model catalog onboarding, and re-runnable tek init with skip support**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-18T22:54:19Z
- **Completed:** 2026-02-18T22:55:09Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced all raw `node ~/tek/packages/gateway/dist/index.js` references with `tek gateway start`
- Documented `tek uninstall` as primary uninstall method with manual fallback
- Added model selection and alias configuration to onboarding step list
- Added re-runnable `tek init` with "Keep current" skip support note

## Task Commits

Each task was committed atomically:

1. **Task 1: Update INSTALL.md for Phase 14 changes** - `c8259db` (docs)

## Files Created/Modified

- `INSTALL.md` - Updated install/usage documentation reflecting all Phase 14 CLI changes

## Decisions Made

- Kept manual uninstall steps as a fallback subsection (useful when CLI is already deleted/broken)
- Did not update Telegram section's `node ~/tek/packages/telegram/dist/index.js` reference (out of scope for this plan, which targets gateway commands only)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Documentation is now current with all Phase 14 CLI capabilities
- Telegram section still references raw node command (separate concern)

---
*Quick Task: 4-update-install-docs-and-scripts-for-phas*
*Completed: 2026-02-18*
