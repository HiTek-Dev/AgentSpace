---
phase: 04-multi-provider-intelligence
plan: 02
subsystem: api
tags: [routing, complexity-classifier, model-tiers, websocket-protocol, auto-routing]

# Dependency graph
requires:
  - phase: 04-multi-provider-intelligence
    plan: 01
    provides: "Provider registry, resolveModelId, getAvailableProviders, ProviderName/ModelTier types"
  - phase: 02-gateway-core
    provides: "WebSocket handlers, session manager, context assembler, streaming infrastructure"
provides:
  - "Complexity classifier (classifyComplexity) with high/standard/budget tiers"
  - "routeMessage() selecting model based on message complexity and provider availability"
  - "getAlternatives() for presenting model options in manual mode"
  - "chat.route.propose server message and chat.route.confirm client message"
  - "Auto-mode routing with tier/reason in chat.stream.start"
  - "Manual-mode routing with proposal/confirm flow via pendingRouting state"
  - "streamToClient() reusable streaming helper"
affects: [05-tool-system, cli-routing-display, session-settings]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Complexity classification with priority-sorted rules", "Proposal/confirm protocol for user-controlled routing", "Shared streaming helper to avoid duplication"]

key-files:
  created:
    - packages/gateway/src/llm/router.ts
    - packages/gateway/src/llm/router-rules.ts
  modified:
    - packages/gateway/src/llm/types.ts
    - packages/gateway/src/llm/index.ts
    - packages/gateway/src/ws/protocol.ts
    - packages/gateway/src/ws/handlers.ts
    - packages/gateway/src/ws/connection.ts
    - packages/gateway/src/ws/server.ts

key-decisions:
  - "Default routing mode is auto (routes silently, shows tier in stream.start)"
  - "Manual mode requires explicit opt-in (future: via slash command or session setting)"
  - "When user explicitly sets msg.model, routing is bypassed entirely"
  - "streamToClient helper extracted to avoid code duplication between normal and route-confirm flows"
  - "Confidence scoring: 1.0 for keyword match, 0.7 for length/history, 0.5 for default fallback"

patterns-established:
  - "Routing bypass: explicit msg.model skips routing entirely"
  - "Protocol extension pattern: add schema, add to discriminated union, wire handler in server.ts"
  - "PendingRouting state pattern for deferred streaming after user confirmation"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 04 Plan 02: Intelligent Routing Summary

**Complexity-based message routing with three tiers (high/standard/budget), auto-mode silent routing in stream.start, and manual-mode proposal/confirm WebSocket protocol**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T22:17:51Z
- **Completed:** 2026-02-16T22:21:28Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created complexity classifier that categorizes messages into high/standard/budget tiers using keyword patterns, message length, and conversation history
- Built routing engine that selects provider-qualified models with fallback when preferred provider unavailable
- Extended WebSocket protocol with chat.route.propose and chat.route.confirm for manual routing mode
- Integrated auto-mode routing into handleChatSend with tier/reason visible in chat.stream.start
- Extracted streamToClient helper for reuse between normal flow and route-confirm flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Create routing engine and default rules** - `91dd82c` (feat)
2. **Task 2: Add routing protocol messages and wire routing into chat handler** - `7c1ae8d` (feat)

## Files Created/Modified
- `packages/gateway/src/llm/router.ts` - Complexity classifier, routeMessage, getAlternatives
- `packages/gateway/src/llm/router-rules.ts` - DEFAULT_RULES (high/standard/budget) and DEFAULT_TIERS mapping
- `packages/gateway/src/llm/types.ts` - Added RoutingMode, RoutingDecision, RoutingRule, TierConfig types
- `packages/gateway/src/llm/index.ts` - Barrel exports for routing types and functions
- `packages/gateway/src/ws/protocol.ts` - ChatRouteProposal, ChatRouteConfirm schemas, routing field on stream.start
- `packages/gateway/src/ws/handlers.ts` - Routing integration in handleChatSend, new handleChatRouteConfirm, streamToClient helper
- `packages/gateway/src/ws/connection.ts` - PendingRouting interface and pendingRouting field on ConnectionState
- `packages/gateway/src/ws/server.ts` - Wired chat.route.confirm handler in message dispatcher

## Decisions Made
- Default routing mode is "auto" -- routing happens silently with tier/reason included in chat.stream.start for client display
- Manual mode requires explicit opt-in (will be configurable via slash command or session setting in future phases)
- Explicit msg.model bypasses routing entirely (user choice takes precedence)
- Extracted streamToClient as shared helper to eliminate code duplication between handleChatSend and handleChatRouteConfirm
- Confidence scoring differentiates keyword matches (1.0) from length/history heuristics (0.7) from default fallback (0.5)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed streamToClient context parameter type**
- **Found during:** Task 2 (handlers.ts refactor)
- **Issue:** Generic `{ messages: Array<{ role: string; content: string }>; system?: string }` type incompatible with `ModelMessage[]` from AI SDK
- **Fix:** Used `Pick<AssembledContext, "messages" | "system">` for proper type compatibility
- **Files modified:** packages/gateway/src/ws/handlers.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 7c1ae8d

---

**Total deviations:** 1 auto-fixed (1 bug - TypeScript type mismatch)
**Impact on plan:** Fix necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed type issue.

## User Setup Required
None - routing uses already-configured provider keys from Phase 04-01.

## Next Phase Readiness
- Phase 04 complete: multi-provider intelligence with registry and routing
- Routing classifies complexity and selects model tier automatically
- Protocol ready for CLI to display routing decisions and handle manual mode
- Ready for Phase 05 (tool system) or CLI routing display integration

---
*Phase: 04-multi-provider-intelligence*
*Completed: 2026-02-16*
