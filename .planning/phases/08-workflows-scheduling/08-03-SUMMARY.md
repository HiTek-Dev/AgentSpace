---
phase: 08-workflows-scheduling
plan: 03
subsystem: api, agent
tags: [cron-scheduler, heartbeat, croner, active-hours, sqlite, gray-matter, monitoring]

# Dependency graph
requires:
  - phase: 08-workflows-scheduling
    provides: "Workflow engine with execute/resume, schedule DB schema, scheduler types"
  - phase: 01-foundation
    provides: "DB singleton, Drizzle schema patterns, createLogger"
provides:
  - "CronScheduler singleton with schedule/pause/resume/stop/reload lifecycle"
  - "HeartbeatRunner for HEARTBEAT.md checklist monitoring with agent-powered checks"
  - "Schedule CRUD persistence layer (save/load/get/update/delete)"
  - "Active hours guard for day-of-week and time window filtering"
affects: [08-04-workflow-protocol]

# Tech tracking
tech-stack:
  added: [gray-matter]
  patterns: [cron-scheduler-pattern, heartbeat-runner-pattern, active-hours-guard]

key-files:
  created:
    - packages/gateway/src/scheduler/store.ts
    - packages/gateway/src/scheduler/heartbeat.ts
    - packages/gateway/src/scheduler/scheduler.ts
  modified:
    - packages/gateway/src/scheduler/index.ts
    - packages/db/src/connection.ts
    - packages/db/src/index.ts
    - packages/gateway/package.json

key-decisions:
  - "AI SDK v6 uses LanguageModel type import (not Parameters<typeof generateText>)"
  - "AI SDK v6 uses stopWhen: stepCountIs(5) instead of maxSteps for generateText"
  - "Heartbeat checks run sequentially to avoid parallel anti-pattern from research"
  - "Croner protect=true prevents overlapping heartbeat runs"

patterns-established:
  - "CronScheduler singleton with active hours guard pattern"
  - "HeartbeatRunner loads HEARTBEAT.md via gray-matter, runs agent checks sequentially"
  - "Schedule store maps ScheduleConfig to/from SQLite with JSON serialization for activeHoursDays"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 8 Plan 3: Cron Scheduler & Heartbeat Summary

**Cron scheduler with Croner jobs, active hours filtering, SQLite persistence, and heartbeat monitoring via HEARTBEAT.md agent-powered checks**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T02:30:42Z
- **Completed:** 2026-02-17T02:34:14Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Schedule CRUD persistence layer with save/load/get/update/delete operations mapped to SQLite
- HeartbeatRunner parses HEARTBEAT.md frontmatter with gray-matter, runs agent-powered checks sequentially
- CronScheduler manages Croner jobs with active hours guard, overlap prevention, and full lifecycle
- Active hours guard checks ISO day-of-week and HH:MM time windows including overnight ranges

## Task Commits

Each task was committed atomically:

1. **Task 1: Schedule store and heartbeat runner** - `0cdac8c` (feat)
2. **Task 2: Cron scheduler with active hours and lifecycle management** - `5e7d10f` (feat)

## Files Created/Modified
- `packages/gateway/src/scheduler/store.ts` - Schedule CRUD operations with SQLite persistence
- `packages/gateway/src/scheduler/heartbeat.ts` - HeartbeatRunner with gray-matter parsing and agent checks
- `packages/gateway/src/scheduler/scheduler.ts` - CronScheduler with active hours, heartbeat, workflow scheduling
- `packages/gateway/src/scheduler/index.ts` - Barrel exports for full scheduler module
- `packages/db/src/connection.ts` - Added CREATE TABLE for schedules
- `packages/db/src/index.ts` - Added schedules export
- `packages/gateway/package.json` - Added gray-matter dependency

## Decisions Made
- AI SDK v6 uses LanguageModel type import (not Parameters<typeof generateText> which fails with namespace error)
- AI SDK v6 uses stopWhen: stepCountIs(5) instead of deprecated maxSteps option for generateText
- Heartbeat checks run sequentially to avoid parallel anti-pattern identified in research
- Croner protect=true prevents overlapping heartbeat runs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added CREATE TABLE for schedules in connection.ts**
- **Found during:** Task 1 (schedule store)
- **Issue:** Drizzle schema existed for schedules table but no CREATE TABLE IF NOT EXISTS in connection.ts
- **Fix:** Added CREATE TABLE statement matching the Drizzle schema columns
- **Files modified:** packages/db/src/connection.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 0cdac8c (Task 1 commit)

**2. [Rule 3 - Blocking] Added schedules export from @agentspace/db**
- **Found during:** Task 1 (schedule store)
- **Issue:** schedules table exported from schema/index.ts but not from db/index.ts
- **Fix:** Added schedules to the db/index.ts export list
- **Files modified:** packages/db/src/index.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 0cdac8c (Task 1 commit)

**3. [Rule 3 - Blocking] Added gray-matter dependency to gateway**
- **Found during:** Task 1 (heartbeat runner)
- **Issue:** gray-matter was in @agentspace/core but not in gateway package.json
- **Fix:** Added gray-matter ^4.0.3 to gateway dependencies
- **Files modified:** packages/gateway/package.json, pnpm-lock.yaml
- **Verification:** pnpm install succeeds, tsc --noEmit passes
- **Committed in:** 0cdac8c (Task 1 commit)

**4. [Rule 1 - Bug] Fixed AI SDK v6 generateText API (maxSteps -> stopWhen)**
- **Found during:** Task 1 (heartbeat runner)
- **Issue:** maxSteps is not a valid option for generateText in AI SDK v6
- **Fix:** Used stopWhen: stepCountIs(5) instead
- **Files modified:** packages/gateway/src/scheduler/heartbeat.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 0cdac8c (Task 1 commit)

**5. [Rule 1 - Bug] Fixed LanguageModel type for AI SDK v6**
- **Found during:** Task 2 (cron scheduler)
- **Issue:** import("ai").generateText namespace syntax doesn't work for extracting model type
- **Fix:** Used LanguageModel type import from "ai" directly
- **Files modified:** packages/gateway/src/scheduler/scheduler.ts, packages/gateway/src/scheduler/heartbeat.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 5e7d10f (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (2 bugs, 3 blocking)
**Impact on plan:** All auto-fixes necessary for compilation and correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CronScheduler and HeartbeatRunner exported from scheduler/index.ts for protocol wiring (08-04)
- Schedule persistence layer ready for CRUD operations via WebSocket protocol
- All TypeScript compiles cleanly

---
*Phase: 08-workflows-scheduling*
*Completed: 2026-02-17*
