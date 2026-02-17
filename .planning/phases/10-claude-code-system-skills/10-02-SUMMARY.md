---
phase: 10-claude-code-system-skills
plan: 02
subsystem: agent
tags: [claude-code, approval-proxy, ws-protocol, workflow-tool, ai-sdk]

# Dependency graph
requires:
  - phase: 10-claude-code-system-skills
    plan: 01
    provides: ClaudeCodeSessionManager, event relay, SpawnSessionOptions types
provides:
  - Approval proxy (canUseTool callback) for proxying tool permissions to user transports
  - WS protocol messages for starting and aborting Claude Code sessions
  - Handler wiring connecting WS messages to session manager
  - Claude Code as an AI SDK workflow tool via createClaudeCodeTool
  - runToCompletion method for headless workflow execution
affects: [10-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Approval proxy via canUseTool callback with abort signal racing", "Dynamic import for claude-code module in handlers (circular dep avoidance)", "runToCompletion headless mode with acceptEdits permission"]

key-files:
  created:
    - packages/gateway/src/claude-code/approval-proxy.ts
    - packages/gateway/src/tools/claude-code.ts
  modified:
    - packages/gateway/src/ws/protocol.ts
    - packages/gateway/src/ws/handlers.ts
    - packages/gateway/src/ws/connection.ts
    - packages/gateway/src/claude-code/session-manager.ts
    - packages/gateway/src/claude-code/index.ts

key-decisions:
  - "Read-only tools (Read, Grep, Glob, WebFetch, LS, View) auto-approved in approval proxy"
  - "Approval proxy reuses existing pendingApprovals Map and tool.approval.response handler flow"
  - "runToCompletion uses acceptEdits permission mode for workflow automation (no user approval needed)"
  - "Dynamic imports for claude-code module in handlers to avoid circular dependencies"

patterns-established:
  - "Approval proxy pattern: canUseTool callback bridges Agent SDK permissions to transport-based approval UI"
  - "waitForApprovalWithAbort: races timeout, abort signal, and user response for clean cancellation"
  - "Headless session pattern: runToCompletion collects SDK generator output without transport relay"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 10 Plan 02: Approval Proxy, WS Protocol & Workflow Tool Summary

**Claude Code approval proxying via canUseTool callback, WS protocol extensions for session start/abort, and Claude Code as an AI SDK workflow tool with headless runToCompletion**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T05:09:12Z
- **Completed:** 2026-02-17T05:12:47Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Approval proxy that bridges Agent SDK canUseTool to transport-based approval with auto-approve for read-only tools, 60s timeout, and abort signal racing
- WS protocol extended with claude-code.start and claude-code.abort client messages, wired to handlers via dynamic imports
- Claude Code exposed as AI SDK workflow tool via createClaudeCodeTool with headless runToCompletion method
- ConnectionState extended with claudeCodeSessions Map for tracking active sessions per connection

## Task Commits

Each task was committed atomically:

1. **Task 1: Approval proxy and WS protocol + handler wiring** - `3e7f165` (feat)
2. **Task 2: Claude Code as a workflow tool** - `37ef94e` (feat)

## Files Created/Modified
- `packages/gateway/src/claude-code/approval-proxy.ts` - createApprovalProxy returning canUseTool callback with read-only auto-approve, abort signal racing, and 60s timeout
- `packages/gateway/src/tools/claude-code.ts` - createClaudeCodeTool returning AI SDK tool for workflow integration
- `packages/gateway/src/ws/protocol.ts` - Added ClaudeCodeStartSchema and ClaudeCodeAbortSchema to client message union
- `packages/gateway/src/ws/handlers.ts` - handleClaudeCodeStart and handleClaudeCodeAbort with dynamic imports and singleton manager
- `packages/gateway/src/ws/connection.ts` - Added claudeCodeSessions Map to ConnectionState
- `packages/gateway/src/claude-code/session-manager.ts` - Added runToCompletion method for headless workflow execution
- `packages/gateway/src/claude-code/index.ts` - Added exports for createApprovalProxy and createClaudeCodeTool

## Decisions Made
- Read-only tools (Read, Grep, Glob, WebFetch, LS, View) are auto-approved in the approval proxy to avoid unnecessary user prompts for safe operations
- Approval proxy reuses the existing pendingApprovals Map on ConnectionState and the existing tool.approval.response handler -- no new approval infrastructure needed
- runToCompletion uses acceptEdits permission mode by default for workflow context (workflows are pre-approved)
- Dynamic imports for claude-code module in handlers.ts to avoid circular dependencies, matching existing pattern from workflow handlers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - uses existing ANTHROPIC_API_KEY environment variable.

## Next Phase Readiness
- Claude Code is now fully wirable from any WS client (start, abort, approval proxying)
- Workflow tool ready for use in workflow step definitions
- Plan 04 can build on the full Claude Code integration

## Self-Check: PASSED

---
*Phase: 10-claude-code-system-skills*
*Completed: 2026-02-17*
