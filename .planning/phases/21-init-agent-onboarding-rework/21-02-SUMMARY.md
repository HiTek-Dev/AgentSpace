---
phase: 21-init-agent-onboarding-rework
plan: 02
subsystem: cli, gateway
tags: [commander, ink, websocket, zod, agent-selection, ws-protocol]

# Dependency graph
requires:
  - phase: 21-init-agent-onboarding-rework
    provides: AgentDefinition types, tek onboard command, per-agent identity directories
  - phase: 16-agent-personality-system
    provides: Agent identity cascade resolution, per-agent memory directories
provides:
  - tek chat --agent flag for explicit agent selection
  - Interactive agent picker for multi-agent environments
  - Per-message agentId in WS protocol (ChatSendSchema)
  - Gateway per-message identity resolution with config fallback
  - Tool registry cache invalidation on agent switch
affects: [21-03, desktop-chat, telegram-chat]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-message agentId flow from CLI through WS protocol to gateway identity resolution]

key-files:
  created: []
  modified:
    - packages/cli/src/commands/chat.ts
    - packages/cli/src/components/Chat.tsx
    - packages/cli/src/lib/gateway-client.ts
    - packages/gateway/src/ws/protocol.ts
    - packages/gateway/src/ws/handlers.ts
    - packages/gateway/src/ws/connection.ts
    - packages/gateway/src/agent/tool-registry.ts

key-decisions:
  - "Gateway uses per-message agentId from chat.send with config fallback to defaultAgentId"
  - "Tool registry cache invalidated when agentId changes between messages via lastAgentId tracking"
  - "Agent picker uses @inkjs/ui Select with Promise wrapper for pre-render resolution"

patterns-established:
  - "Per-message agentId: CLI resolves agent, sends via WS, gateway uses for identity and tools"
  - "Tool cache invalidation via lastAgentId comparison on ConnectionState"

requirements-completed:
  - "tek chat prompts for agent selection when multiple agents exist"
  - "Gateway manages identity injection and memory for the active agent"

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 21 Plan 02: Agent Selection & Gateway Identity Summary

**Agent selection in tek chat (--agent flag, auto-select, interactive picker) with per-message agentId flowing through WS protocol for gateway identity injection and memory tool scoping**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T03:50:54Z
- **Completed:** 2026-02-20T03:54:06Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added --agent flag to tek chat with exact ID and case-insensitive name matching
- Auto-selects single agent, shows interactive picker for 2+ agents, backward-compatible legacy mode for zero agents
- Added optional agentId field to ChatSendSchema in WS protocol
- Gateway resolves agentId from message (msg.agentId) with cascading fallback to config default and "default"
- Tool registry accepts agentId parameter, invalidates cache when agent switches mid-connection
- Full agentId data flow: chat.ts -> Chat.tsx -> gateway-client.ts -> WS protocol -> handlers.ts -> tool-registry.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Add agent selection to tek chat command and CLI components** - `a15d969` (feat)
2. **Task 2: Add agentId to WS protocol and wire gateway per-message identity** - `cf177f6` (feat)

## Files Created/Modified
- `packages/cli/src/commands/chat.ts` - Added --agent flag, pickAgent function, resolveAgentId with interactive Select picker
- `packages/cli/src/components/Chat.tsx` - Added agentId prop, passes through to createChatSendMessage
- `packages/cli/src/lib/gateway-client.ts` - Added agentId to createChatSendMessage opts
- `packages/gateway/src/ws/protocol.ts` - Added agentId: z.string().optional() to ChatSendSchema
- `packages/gateway/src/ws/handlers.ts` - Per-message agentId resolution with config fallback, tool cache invalidation, passes agentId to buildToolRegistry
- `packages/gateway/src/ws/connection.ts` - Added lastAgentId to ConnectionState for cache tracking
- `packages/gateway/src/agent/tool-registry.ts` - Added agentId to ToolRegistryOptions, uses it for memory tool scoping

## Decisions Made
- Gateway uses msg.agentId ?? config.agents.defaultAgentId ?? "default" cascade for identity resolution
- Tool registry cache invalidated via lastAgentId field comparison on ConnectionState (connState.tools = null when agent changes)
- Agent picker renders before Chat component using Promise wrapper around Ink render/unmount cycle
- Zero agents returns undefined agentId (legacy mode, backward-compatible with existing single-agent setups)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tools invalidation using null instead of undefined**
- **Found during:** Task 2
- **Issue:** ConnectionState.tools is typed as `Record<string, unknown> | null`, not `undefined`
- **Fix:** Changed `connState.tools = undefined` to `connState.tools = null`
- **Files modified:** packages/gateway/src/ws/handlers.ts
- **Verification:** Gateway TypeScript compiles without errors
- **Committed in:** cf177f6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial type fix. No scope creep.

## Issues Encountered
- Gateway needed clean build (rm -rf dist) before emitting .d.ts files due to "would overwrite input file" error from prior build artifacts

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent selection fully wired from CLI through gateway
- Ready for Plan 03 (full CLI code review and polish)
- All TypeScript packages compile cleanly

---
*Phase: 21-init-agent-onboarding-rework*
*Completed: 2026-02-19*
