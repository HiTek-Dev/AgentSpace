---
phase: 07-agent-self-improvement
plan: 04
subsystem: api, cli
tags: [websocket, pty, terminal, node-pty, ansi]

# Dependency graph
requires:
  - phase: 07-03
    provides: "PTY proxy with node-pty spawn, stdin/stdout routing, and /proxy slash command"
  - phase: 02-01
    provides: "WebSocket gateway with connection state, discriminated union protocol"
provides:
  - "Terminal WS protocol messages (snapshot, input, control grant/revoke)"
  - "Agent-observable PTY mode with ANSI-stripped throttled snapshots"
  - "Agent input injection into PTY sessions via WS messages"
  - "User reclaim of exclusive terminal control via Ctrl+backslash"
  - "ConnectionState tracking of terminal snapshot and control grant state"
affects: [agent-tool-loop, future-terminal-tool]

# Tech tracking
tech-stack:
  added: []
  patterns: [callback-based-event-wiring, throttled-snapshot-emission, rolling-buffer-pattern]

key-files:
  created: []
  modified:
    - packages/gateway/src/ws/protocol.ts
    - packages/gateway/src/ws/server.ts
    - packages/gateway/src/ws/connection.ts
    - packages/cli/src/lib/pty-proxy.ts
    - packages/cli/src/commands/chat.ts
    - packages/cli/src/components/Chat.tsx
    - packages/cli/src/hooks/useSlashCommands.ts

key-decisions:
  - "WS connection opened separately for terminal messages (not reusing Ink's connection which unmounts)"
  - "Rolling 4000-char buffer with 500ms throttled emission for snapshots (avoids flooding)"
  - "Agent control revoke via Ctrl+backslash consumes keystroke, does not forward to PTY"
  - "Snapshot buffer and agent input both gated on agentControlActive flag"

patterns-established:
  - "Callback prop pattern for PTY observation: onSnapshot/onAgentInput/onControlRevoke"
  - "Post-Ink WS connection: open WS after Ink unmounts for non-UI communication"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 7 Plan 4: Terminal Agent Observation Summary

**WS protocol extensions for terminal snapshot/input/control messages with agent-observable PTY proxy mode and Ctrl+backslash user reclaim**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T01:53:37Z
- **Completed:** 2026-02-17T01:55:37Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Terminal WS protocol messages defined for snapshot, input, and control grant/revoke
- PTY proxy enhanced with ANSI-stripped throttled snapshot emission and agent input injection
- User can revoke agent terminal control with Ctrl+backslash at any time
- /proxy --agent flag enables agent observation mode with persistent WS connection

## Task Commits

Each task was committed atomically:

1. **Task 1: Add terminal WS protocol messages and gateway handler** - `6ca4011` (feat)
2. **Task 2: Enhance pty-proxy with agent observation and input injection** - `6f68475` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `packages/gateway/src/ws/protocol.ts` - Terminal message schemas (snapshot, input, control grant/revoke, proxy start)
- `packages/gateway/src/ws/server.ts` - Terminal message handlers in WS switch
- `packages/gateway/src/ws/connection.ts` - lastTerminalSnapshot and terminalControlGranted fields
- `packages/cli/src/lib/pty-proxy.ts` - Agent observation mode with stripAnsi, snapshot buffer, agent input injection, Ctrl+backslash
- `packages/cli/src/commands/chat.ts` - Post-Ink WS connection for agent terminal messaging
- `packages/cli/src/components/Chat.tsx` - Updated onProxyRequest signature with agent flag
- `packages/cli/src/hooks/useSlashCommands.ts` - --agent flag on /proxy command with proxyAgent result field

## Decisions Made
- WS connection opened separately after Ink unmounts for terminal messages (Ink's WS tears down on exit)
- Rolling 4000-char snapshot buffer with 500ms throttled emission avoids flooding the gateway
- Ctrl+backslash (\x1c) consumed by proxy, not forwarded to PTY, to prevent SIGQUIT in subprocess
- Agent control gated on agentControlActive flag that starts true and toggles on revoke

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 07 complete: all 4 plans executed
- Agent self-improvement capabilities ready: step introspection, failure detection, skill authoring, terminal observation
- Terminal observation enables future read_terminal tool for agent to query PTY state

---
*Phase: 07-agent-self-improvement*
*Completed: 2026-02-17*

## Self-Check: PASSED
