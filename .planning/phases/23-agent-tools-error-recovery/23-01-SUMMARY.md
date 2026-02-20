---
phase: 23-agent-tools-error-recovery
plan: 01
subsystem: tools
tags: [filesystem, shell, fetch, error-handling, workspace, websocket]

# Dependency graph
requires:
  - phase: 06-tool-use
    provides: "AI SDK tool infrastructure, approval gates, tool registry"
provides:
  - "Workspace-aware filesystem tools with resolveAgentPath"
  - "delete_file tool for file removal within workspace"
  - "fetch_url tool for HTTP requests"
  - "Tool error relay to client via tool.error WS messages"
affects: [23-agent-tools-error-recovery, agent-tools]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resolveAgentPath pattern for workspace-relative path resolution before security checks"
    - "tool-error stream part handling for client-visible error relay"

key-files:
  created:
    - packages/gateway/src/tools/fetch.ts
  modified:
    - packages/gateway/src/tools/filesystem.ts
    - packages/gateway/src/tools/shell.ts
    - packages/gateway/src/agent/tool-registry.ts
    - packages/gateway/src/agent/tool-loop.ts
    - packages/gateway/src/ws/protocol.ts

key-decisions:
  - "resolveAgentPath as local helper in each tool file (3 lines, not worth shared module)"
  - "Shell tool defaults cwd to workspaceDir even in full-control mode (sensible default, not a restriction)"
  - "fetch_url uses session approval tier (can POST to external services)"
  - "30s timeout on fetch requests with AbortController"
  - "100KB response truncation for fetch_url to prevent memory issues"

patterns-established:
  - "resolveAgentPath before checkWorkspace: resolve relative paths against workspace, then enforce security"
  - "tool-error case in fullStream switch: relay SDK tool errors to client as WS messages"

requirements-completed: [TOOLS-PATH, TOOLS-ERROR, TOOLS-FREEZE, TOOLS-FETCH, TOOLS-DELETE]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 23 Plan 01: Tool Paths, Error Relay, Delete & Fetch Summary

**Workspace-aware path resolution for filesystem/shell tools, delete_file and fetch_url tools, and tool-error relay to prevent silent agent freezes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T07:24:51Z
- **Completed:** 2026-02-20T07:28:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- All filesystem tool paths resolve relative to workspace before security checks, fixing ENOENT errors from LLM-hallucinated absolute paths
- delete_file tool enables file removal within workspace boundaries
- fetch_url tool supports GET/POST/PUT/PATCH/DELETE with headers, body, 30s timeout, and 100KB response truncation
- Tool errors are now relayed to client as tool.error WS messages instead of being silently swallowed
- Shell tool defaults cwd to workspaceDir when no cwd specified

## Task Commits

Each task was committed atomically:

1. **Task 1: Add workspace path resolution, delete_file, and fetch tool** - `19ae24b` (feat)
2. **Task 2: Add tool-error handling to agent loop and WS protocol** - `8c2577f` (feat)

**Plan metadata:** (pending) (docs: complete plan)

## Files Created/Modified
- `packages/gateway/src/tools/filesystem.ts` - resolveAgentPath helper, workspace-relative descriptions, delete_file tool
- `packages/gateway/src/tools/shell.ts` - resolveAgentPath helper, workspace cwd defaults
- `packages/gateway/src/tools/fetch.ts` - HTTP fetch tool with method/headers/body/timeout support
- `packages/gateway/src/agent/tool-registry.ts` - fetch_url tool registration with session approval tier
- `packages/gateway/src/agent/tool-loop.ts` - tool-error case in fullStream switch, debug logging for unhandled parts
- `packages/gateway/src/ws/protocol.ts` - ToolErrorNotifySchema added to ServerMessage union

## Decisions Made
- resolveAgentPath kept as local helper in each tool file (3 lines, not worth a shared module)
- Shell tool defaults cwd to workspaceDir even in full-control mode as a sensible default
- fetch_url uses session approval tier since it can POST to external services
- 30s timeout on fetch with AbortController for safety
- 100KB response truncation prevents memory issues from large API responses

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in handlers.ts (from brave search key lookups in another plan) -- not caused by our changes, ignored per scope boundary rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Tool infrastructure is now robust: workspace paths, error relay, file CRUD, and HTTP fetch all working
- Ready for 23-02 (memory/system prompt loading fixes) and 23-03 (workspace permissions and Brave Search)

---
*Phase: 23-agent-tools-error-recovery*
*Completed: 2026-02-20*
