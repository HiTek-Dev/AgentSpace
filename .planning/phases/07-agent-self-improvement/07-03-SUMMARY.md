---
phase: 07-agent-self-improvement
plan: 03
subsystem: cli
tags: [node-pty, terminal, pty, interactive, proxy, ink]

# Dependency graph
requires:
  - phase: 03-chat-ui
    provides: Chat component and slash command system
provides:
  - PTY proxy library for spawning interactive terminal subprocesses
  - /proxy slash command for launching terminal apps from CLI
affects: [cli, agent-capabilities]

# Tech tracking
tech-stack:
  added: [node-pty]
  patterns: [Ink unmount-before-PTY for raw mode handoff, callback prop for cross-component exit data passing]

key-files:
  created:
    - packages/cli/src/lib/pty-proxy.ts
  modified:
    - packages/cli/src/commands/chat.ts
    - packages/cli/src/components/Chat.tsx
    - packages/cli/src/hooks/useSlashCommands.ts
    - packages/cli/package.json

key-decisions:
  - "Callback prop pattern (onProxyRequest) to pass data from Ink component to post-exit entrypoint"
  - "xterm-256color TERM for full color support in proxied terminal apps"
  - "isTTY guard on setRawMode for safety in non-interactive environments"
  - "Type assertion (as null) to work around TS narrowing of closure-mutated variables"

patterns-established:
  - "Ink unmount pattern: store data via callback, call exit(), run post-exit logic in command entrypoint"
  - "PTY lifecycle: raw mode on -> forward stdin/stdout -> cleanup listeners -> raw mode off -> resolve"

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 07 Plan 03: Terminal Proxy Mode Summary

**node-pty terminal proxy with /proxy slash command for interactive CLI app passthrough (vim, git rebase, etc.)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T01:48:02Z
- **Completed:** 2026-02-17T01:51:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- PTY proxy library that spawns interactive subprocesses with full stdin/stdout routing and terminal resize forwarding
- /proxy slash command integrated into Chat with clean Ink unmount before PTY takeover
- Chat command entrypoint handles post-exit proxy flow with exit code passthrough

## Task Commits

Each task was committed atomically:

1. **Task 1: Install node-pty and create pty-proxy library** - `5647b9f` (feat)
2. **Task 2: Add /proxy slash command to Chat component** - `1810d9b` (feat)

## Files Created/Modified
- `packages/cli/src/lib/pty-proxy.ts` - PTY subprocess spawning with stdin/stdout routing and resize handling
- `packages/cli/src/commands/chat.ts` - Post-exit proxy flow with runPtyProxy call
- `packages/cli/src/components/Chat.tsx` - onProxyRequest callback prop and proxy action handling
- `packages/cli/src/hooks/useSlashCommands.ts` - /proxy command parsing and help text
- `packages/cli/package.json` - node-pty dependency added

## Decisions Made
- Used callback prop pattern (onProxyRequest) to communicate proxy request from Ink component to post-exit code, avoiding globals or temp files
- Used `as null` type assertion to work around TypeScript narrowing issue with closure-mutated variables
- Set xterm-256color as TERM for proxied processes for full color support
- Guarded setRawMode behind isTTY check for non-interactive environments

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript narrowing of closure-mutated variable**
- **Found during:** Task 2
- **Issue:** `pendingProxy` typed as `never` after null check because TS doesn't track closure mutations
- **Fix:** Added explicit type assertion `as { command: string; args: string[] } | null` on initialization
- **Files modified:** packages/cli/src/commands/chat.ts
- **Verification:** `tsc --noEmit` passes cleanly
- **Committed in:** 1810d9b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor TypeScript typing fix, no scope creep.

## Issues Encountered
None beyond the TypeScript narrowing issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Terminal proxy mode complete, ready for use with any interactive CLI application
- Pairs with agent self-improvement capabilities for interactive editing workflows

---
*Phase: 07-agent-self-improvement*
*Completed: 2026-02-17*

## Self-Check: PASSED

All files exist and all commits verified.
