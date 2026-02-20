---
phase: 25-foundation-blockers
plan: 01
subsystem: infra
tags: [monorepo, circular-dependency, vault, keychain, module-extraction]

# Dependency graph
requires: []
provides:
  - "@tek/core/vault sub-export with addKey, getKey, updateKey, removeKey, listProviders, getOrCreateAuthToken"
  - "Broken circular dependency between @tek/cli and @tek/gateway"
affects: [25-foundation-blockers, 26-cli-polish, 27-desktop, 28-stability]

# Tech tracking
tech-stack:
  added: ["@napi-rs/keyring in @tek/core"]
  patterns: ["vault as @tek/core/vault sub-export (separate entry point from main)", "audit logging at CLI call sites instead of inside vault functions"]

key-files:
  created:
    - packages/core/src/vault/index.ts
    - packages/core/src/vault/keychain.ts
    - packages/core/src/vault/providers.ts
  modified:
    - packages/core/package.json
    - packages/gateway/package.json
    - packages/gateway/src/ws/handlers.ts
    - packages/gateway/src/llm/provider.ts
    - packages/gateway/src/llm/registry.ts
    - packages/gateway/src/key-server/auth.ts
    - packages/gateway/src/key-server/routes.ts
    - packages/gateway/src/index.ts
    - packages/cli/package.json
    - packages/cli/src/commands/keys.ts
    - packages/cli/src/commands/config.ts
    - packages/cli/src/commands/init.ts
    - packages/cli/src/commands/onboard.ts
    - packages/cli/src/commands/uninstall.ts
    - packages/cli/src/components/Onboarding.tsx

key-decisions:
  - "Vault as separate sub-export (@tek/core/vault) to avoid desktop app importing native @napi-rs/keyring"
  - "Audit logging removed from vault functions and moved to CLI call sites to avoid @tek/core -> @tek/db dependency"
  - "keychainSet/keychainGet/keychainDelete re-exported from vault index for consumers like uninstall.ts"

patterns-established:
  - "Sub-export pattern: @tek/core/vault as separate entry point, not re-exported from @tek/core main"
  - "Call-site audit logging: vault operations are pure, callers decide whether to audit"

requirements-completed: [FOUND-01]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 25 Plan 01: Vault Extraction Summary

**Vault module extracted from @tek/cli to @tek/core/vault sub-export, breaking cli-gateway circular dependency**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-20T23:05:35Z
- **Completed:** 2026-02-20T23:10:49Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Extracted vault module (index.ts, keychain.ts, providers.ts) from @tek/cli to @tek/core with ./vault sub-export
- Updated all 6 gateway files and 6 CLI files to import from @tek/core/vault
- Removed @tek/cli dependency from @tek/gateway, breaking the circular dependency
- Preserved audit logging at CLI command call sites (keys.ts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Move vault files to @tek/core and configure sub-export** - `58f6b95` (feat)
2. **Task 2: Update all vault imports across gateway and CLI** - `a0fb1ed` (feat)

## Files Created/Modified
- `packages/core/src/vault/index.ts` - Vault API (addKey, getKey, updateKey, removeKey, listProviders, getOrCreateAuthToken)
- `packages/core/src/vault/keychain.ts` - OS keychain access with migration support
- `packages/core/src/vault/providers.ts` - Provider type, PROVIDERS list, validateProvider
- `packages/core/package.json` - Added ./vault sub-export and @napi-rs/keyring dependency
- `packages/gateway/package.json` - Removed @tek/cli dependency
- `packages/gateway/src/ws/handlers.ts` - Import changed to @tek/core/vault
- `packages/gateway/src/llm/provider.ts` - Import changed to @tek/core/vault
- `packages/gateway/src/llm/registry.ts` - Import changed to @tek/core/vault
- `packages/gateway/src/key-server/auth.ts` - Import changed to @tek/core/vault
- `packages/gateway/src/key-server/routes.ts` - Import changed to @tek/core/vault
- `packages/gateway/src/index.ts` - Dynamic import changed to @tek/core/vault
- `packages/cli/package.json` - Removed ./vault sub-export and @napi-rs/keyring
- `packages/cli/src/commands/keys.ts` - Import from @tek/core/vault, added recordAuditEvent calls
- `packages/cli/src/commands/config.ts` - Import from @tek/core/vault
- `packages/cli/src/commands/init.ts` - Import from @tek/core/vault
- `packages/cli/src/commands/onboard.ts` - Import from @tek/core/vault
- `packages/cli/src/commands/uninstall.ts` - Use keychainDelete from @tek/core/vault
- `packages/cli/src/components/Onboarding.tsx` - Import from @tek/core/vault

## Decisions Made
- Vault as separate sub-export (@tek/core/vault) rather than re-exported from @tek/core main index, to prevent desktop app from importing native @napi-rs/keyring module
- Audit logging removed from vault functions and moved to CLI call sites to avoid creating @tek/core -> @tek/db circular dependency
- Re-exported keychainSet/keychainGet/keychainDelete from vault index for direct consumers like uninstall.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed uninstall.ts direct @napi-rs/keyring import**
- **Found during:** Task 2 (Update all vault imports)
- **Issue:** `packages/cli/src/commands/uninstall.ts` imported `Entry` directly from `@napi-rs/keyring` and `KEYCHAIN_SERVICE` from `@tek/core` for keychain cleanup. After removing `@napi-rs/keyring` from CLI dependencies, this broke.
- **Fix:** Changed to use `keychainDelete` from `@tek/core/vault` instead of direct `Entry` usage. Simpler and consistent with the new vault abstraction.
- **Files modified:** packages/cli/src/commands/uninstall.ts
- **Verification:** `pnpm tsc` in CLI passes
- **Committed in:** a0fb1ed (Task 2 commit)

**2. [Rule 3 - Blocking] Updated gateway test-stream.mjs**
- **Found during:** Task 2 verification (grep for remaining @tek/cli/vault)
- **Issue:** `packages/gateway/test-stream.mjs` still referenced `@tek/cli/vault`
- **Fix:** Changed import to `@tek/core/vault`
- **Files modified:** packages/gateway/test-stream.mjs
- **Committed in:** a0fb1ed (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both fixes necessary for CLI compilation and import consistency. No scope creep.

## Issues Encountered
- Pre-existing circular dependency between @tek/gateway and @tek/telegram prevents `pnpm turbo build` from completing. This cycle was previously masked by the larger cli/gateway/telegram cycle. Individual `tsc` builds for all packages succeed. Logged to deferred-items.md.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Vault module in @tek/core ready for all consumers
- Gateway no longer depends on CLI -- gateway test isolation is unblocked
- Remaining @tek/gateway <-> @tek/telegram cycle needs resolution (logged in deferred-items.md)

---
*Phase: 25-foundation-blockers*
*Completed: 2026-02-20*
