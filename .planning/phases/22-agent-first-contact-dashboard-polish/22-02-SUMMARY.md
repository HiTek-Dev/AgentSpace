---
phase: 22-agent-first-contact-dashboard-polish
plan: 02
subsystem: config, identity, cli
tags: [agent-id, sentinel-removal, backward-compat, config-schema]

# Dependency graph
requires:
  - phase: 21-init-agent-onboarding-rework
    provides: per-message agentId in WS protocol, agent onboarding command
provides:
  - "Clean agent ID resolution without 'default' sentinel throughout codebase"
  - "Zero-agent state prompts user to run tek onboard"
  - "Agent-scoped loadUser() and updateIdentityFileSection()"
affects: [22-01, 22-03, gateway, cli, db]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Falsy check (!agentId) for global memory fallback instead of === 'default' comparison"
    - "|| operator chain for agentId resolution (empty string falls through to undefined)"

key-files:
  created: []
  modified:
    - packages/core/src/config/schema.ts
    - packages/db/src/memory/agent-resolver.ts
    - packages/db/src/memory/soul-manager.ts
    - packages/db/src/memory/identity-manager.ts
    - packages/gateway/src/ws/handlers.ts
    - packages/gateway/src/agent/tool-registry.ts
    - packages/gateway/src/session/manager.ts
    - packages/cli/src/commands/onboard.ts
    - packages/cli/src/commands/chat.ts

key-decisions:
  - "Use || instead of ?? for agentId resolution so empty string config falls through to undefined"
  - "Session key uses 'global' prefix when no agentId (preserves key format compatibility)"
  - "Zero-agent chat exits with message instead of silently falling back to legacy mode"

patterns-established:
  - "Falsy agentId pattern: !agentId means global/shared fallback throughout all packages"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 22 Plan 02: Remove Default Agent Sentinel Summary

**Eliminated "default" string sentinel from all agent ID resolution paths, replacing with falsy checks for clean backward-compatible global memory fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T06:01:33Z
- **Completed:** 2026-02-20T06:04:03Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Removed all `=== "default"` comparisons from config schema, db layer, gateway, session manager, and CLI
- Config schema now defaults defaultAgentId to empty string instead of "default"
- tek chat with zero agents shows clear prompt to run tek onboard instead of silent legacy fallback
- Added agentId parameter to loadUser() and updateIdentityFileSection() for agent-scoped memory operations

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove "default" sentinel from config schema and db layer** - `0e089ea` (feat)
2. **Task 2: Remove "default" sentinel from gateway, session manager, and CLI** - `1707d99` (feat)

## Files Created/Modified
- `packages/core/src/config/schema.ts` - defaultAgentId default changed from "default" to ""
- `packages/db/src/memory/agent-resolver.ts` - Falsy checks replace === "default" in resolveIdentityFile and resolveAgentDir
- `packages/db/src/memory/soul-manager.ts` - Falsy check in loadSoul, agentId param added to updateIdentityFileSection
- `packages/db/src/memory/identity-manager.ts` - Falsy checks in loadIdentity/loadStyle, agentId param added to loadUser
- `packages/gateway/src/ws/handlers.ts` - agentId resolution uses || chain, session.create passes resolved agentId
- `packages/gateway/src/agent/tool-registry.ts` - Memory tool agentId resolution uses || falsy chain
- `packages/gateway/src/session/manager.ts` - Optional agentId param, "global" key prefix for undefined
- `packages/cli/src/commands/onboard.ts` - Empty string init for defaultAgentId, falsy check for first-agent default
- `packages/cli/src/commands/chat.ts` - Zero-agent state prompts tek onboard instead of returning undefined

## Decisions Made
- Used `||` instead of `??` for agentId resolution chains so empty string ("") from config also falls through to undefined, matching the new empty-string default
- Session key format uses "global" as prefix when no agentId is provided (`agent:global:{id}`) to preserve the transparent key pattern
- Zero-agent detection exits with informative message rather than silently entering legacy mode -- explicit onboarding is now required

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All agent ID resolution is now sentinel-free and backward-compatible
- Ready for plan 01 (first-contact identity) and plan 03 (dashboard polish) which depend on clean agentId resolution

---
*Phase: 22-agent-first-contact-dashboard-polish*
*Completed: 2026-02-19*
