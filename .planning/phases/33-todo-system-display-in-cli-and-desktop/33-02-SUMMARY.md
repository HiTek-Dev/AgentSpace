---
phase: 33-todo-system-display-in-cli-and-desktop
plan: 02
subsystem: ui
tags: [ink, react, cli, todo-display, spinner, websocket]

# Dependency graph
requires:
  - phase: 33-01
    provides: todo.update WS server message type, TodoItem type
provides:
  - TodoItem interface in CLI useChat hook
  - todo.update handler in CLI useChat
  - TodoPanel Ink component with spinner/checkmark/circle indicators
  - TodoPanel integration in Chat layout
affects: [33-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [status-based icon rendering in Ink components]

key-files:
  created:
    - packages/cli/src/components/TodoPanel.tsx
  modified:
    - packages/cli/src/hooks/useChat.ts
    - packages/cli/src/components/Chat.tsx

key-decisions:
  - "TodoPanel placed after StreamingResponse and before ToolPanel for natural reading order"
  - "Todos clear on stream start (not stream end) so they persist after completion until next request"

patterns-established:
  - "Status icon pattern: green + for completed, Spinner for in-progress, dimColor o for pending"
  - "activeForm text shown for in-progress items to give live progress context"

requirements-completed: [TODO-05, TODO-07]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 33 Plan 02: CLI Todo Display Summary

**Ink TodoPanel component with spinner/checkmark/circle status indicators, useChat todo.update handler, and Chat layout integration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T05:58:12Z
- **Completed:** 2026-02-22T06:01:37Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added TodoItem interface and todos state management to CLI useChat hook
- Created TodoPanel component with Spinner for active tasks, green + for completed, dimColor o for pending
- Integrated TodoPanel into Chat layout between streaming response and tool panel

## Task Commits

Each task was committed atomically:

1. **Task 1: Handle todo.update in CLI useChat and create TodoPanel component** - `4b28fac` (feat)
2. **Task 2: Integrate TodoPanel into CLI Chat layout** - `41cd1ef` (feat)

## Files Created/Modified
- `packages/cli/src/components/TodoPanel.tsx` - Compact Ink todo list component with status indicators
- `packages/cli/src/hooks/useChat.ts` - TodoItem interface, todos state, todo.update handler, clear on stream start/error
- `packages/cli/src/components/Chat.tsx` - TodoPanel import and rendering between StreamingResponse and ToolPanel

## Decisions Made
- TodoPanel placed after StreamingResponse and before ToolPanel to appear between streaming output and input area
- Todos clear on chat.stream.start (not stream.end) so they remain visible after completion until next request starts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rebuilt gateway package for updated type exports**
- **Found during:** Task 1
- **Issue:** Gateway dist was stale and did not include todo.update in ServerMessage type, causing TS2678 error
- **Fix:** Ran `npx turbo build --filter=@tek/gateway` to rebuild dist with TodoUpdate type
- **Files modified:** None (build artifacts only)
- **Verification:** TypeScript compilation passes after rebuild
- **Committed in:** N/A (build artifact, not source)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Build artifact staleness resolved. No scope creep.

## Issues Encountered
- TodoPanel.tsx was already committed by the 33-03 plan execution (ae68201) which ran before 33-02. The file content was identical to what this plan specified, so no conflict. Task 1 commit only includes the useChat.ts changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CLI todo display complete, users will see real-time task progress with spinners
- Desktop todo display (33-03) can reference the same patterns for consistency

---
## Self-Check: PASSED

All files exist on disk. All commit hashes found in git log.

---
*Phase: 33-todo-system-display-in-cli-and-desktop*
*Completed: 2026-02-22*
