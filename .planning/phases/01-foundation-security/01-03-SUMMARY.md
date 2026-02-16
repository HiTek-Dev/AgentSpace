---
phase: 01-foundation-security
plan: 03
subsystem: auth
tags: [fastify, bearer-auth, key-server, onboarding, ink, security-modes, gateway]

requires:
  - phase: 01-01
    provides: "@agentspace/core (config schema, loader, crypto tokens, errors, logger), @agentspace/db (audit log, recordAuditEvent)"
  - phase: 01-02
    provides: "@agentspace/cli (credential vault, getKey, getOrCreateAuthToken, keys command)"
provides:
  - "@agentspace/gateway package with Fastify key-serving API at 127.0.0.1"
  - "Bearer token authentication on local API endpoint"
  - "Security mode enforcement with isPathWithinWorkspace() for Limited Control"
  - "Onboarding wizard (Ink) for first-run mode selection and key setup"
  - "CLI commands: init, config (show/set mode/rotate-token), audit"
affects: [02-gateway, all-future-phases]

tech-stack:
  added: [fastify, "@fastify/bearer-auth"]
  patterns: [local-only-api-binding, bearer-auth-scoped-routes, ink-wizard-steps, runtime-json-lifecycle]

key-files:
  created:
    - packages/core/src/config/security.ts
    - packages/gateway/package.json
    - packages/gateway/tsconfig.json
    - packages/gateway/src/index.ts
    - packages/gateway/src/key-server/index.ts
    - packages/gateway/src/key-server/server.ts
    - packages/gateway/src/key-server/routes.ts
    - packages/gateway/src/key-server/auth.ts
    - packages/cli/src/commands/init.ts
    - packages/cli/src/commands/config.ts
    - packages/cli/src/commands/audit.ts
    - packages/cli/src/components/Onboarding.tsx
  modified:
    - packages/core/src/index.ts
    - packages/core/src/config/index.ts
    - packages/cli/src/index.ts
    - packages/cli/package.json

key-decisions:
  - "Scoped bearer-auth to /keys/* routes only, leaving /health unauthenticated"
  - "Runtime.json written on server start with PID/port/timestamp, cleaned on exit"
  - "Onboarding wizard uses multi-step Ink component with state machine flow"

patterns-established:
  - "Local API binding: 127.0.0.1 only, never 0.0.0.0, with EADDRINUSE port fallback"
  - "Authorization header redacted in Fastify logger serializers"
  - "Runtime.json lifecycle: write on start, clean on SIGTERM/SIGINT"
  - "Onboarding state machine: welcome -> mode -> workspace -> keys -> summary -> done"

duration: 2min
completed: 2026-02-16
---

# Phase 1 Plan 3: Security Mode Enforcement, Key-Serving API & Onboarding Summary

**Fastify key-serving API at 127.0.0.1 with bearer auth, isPathWithinWorkspace() security enforcement, and Ink onboarding wizard with init/config/audit CLI commands**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T07:11:14Z
- **Completed:** 2026-02-16T07:13:22Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 17

## Accomplishments
- Built @agentspace/gateway with Fastify key-serving API bound to 127.0.0.1, bearer token auth scoped to /keys/* routes, unauthenticated /health endpoint, and runtime.json lifecycle management
- Implemented isPathWithinWorkspace() in @agentspace/core for Limited Control mode path enforcement with symlink escape prevention
- Created Ink-based onboarding wizard with multi-step flow (welcome, mode selection, workspace config, key setup, summary) triggered by `agentspace init`
- Added CLI commands: config (show/set mode/rotate-token) and audit (formatted log viewer with --limit, --provider, --json options)
- All 10 end-to-end verification steps passed by human reviewer

## Task Commits

Each task was committed atomically:

1. **Task 1: Security mode enforcement and local API endpoint** - `f11f16a` (feat)
2. **Task 2: Onboarding wizard and CLI config/audit commands** - `5afc037` (feat)
3. **Task 3: Verify complete Phase 1 end-to-end flow** - checkpoint (human-verified, approved)

## Files Created/Modified
- `packages/core/src/config/security.ts` - isPathWithinWorkspace() with path.resolve + realpathSync symlink detection
- `packages/core/src/index.ts` - Re-exports security module
- `packages/gateway/package.json` - Gateway package with fastify, @fastify/bearer-auth dependencies
- `packages/gateway/tsconfig.json` - TypeScript config extending base
- `packages/gateway/src/index.ts` - Gateway entry point, starts key server
- `packages/gateway/src/key-server/server.ts` - createKeyServer() factory with port fallback and runtime.json
- `packages/gateway/src/key-server/routes.ts` - GET /keys/:provider (authed), GET /health (unauthed)
- `packages/gateway/src/key-server/auth.ts` - getAuthKeys() wrapping vault token for bearer validation
- `packages/gateway/src/key-server/index.ts` - Barrel exports
- `packages/cli/src/commands/init.ts` - agentspace init command with re-setup detection
- `packages/cli/src/commands/config.ts` - config show/set mode/rotate-token subcommands
- `packages/cli/src/commands/audit.ts` - Audit log viewer with filtering and JSON output
- `packages/cli/src/components/Onboarding.tsx` - Multi-step Ink onboarding wizard
- `packages/cli/src/index.ts` - Registers init, config, audit commands
- `packages/cli/package.json` - Added ink and @inkjs/ui dependencies

## Decisions Made
- Scoped @fastify/bearer-auth to /keys/* routes via Fastify plugin encapsulation, keeping /health publicly accessible without auth
- Runtime.json written to RUNTIME_PATH on server start (pid, port, startedAt), cleaned up on SIGTERM/SIGINT for process discovery
- Onboarding wizard implemented as Ink React component with state machine pattern rather than sequential prompts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 complete: all foundation packages built (core, db, cli, gateway)
- Full user flow works: init -> keys add -> gateway start -> authenticated key retrieval -> audit log
- Security enforcement ready: isPathWithinWorkspace() for Limited Control, bearer auth for API
- Ready for Phase 2: gateway proxy, provider routing, AI SDK integration

## Self-Check: PASSED

All 12 created files verified on disk. Both task commits (f11f16a, 5afc037) found in git log.

---
*Phase: 01-foundation-security*
*Completed: 2026-02-16*
