# Deferred Items - Phase 04

## Pre-existing Issues

### Cyclic dependency: @agentspace/cli <-> @agentspace/gateway
- **Found during:** 04-01 verification
- **Issue:** `pnpm turbo build` fails because @agentspace/cli depends on @agentspace/gateway and vice versa. Gateway imports vault from cli. Cli imports gateway for server startup.
- **Impact:** Cannot run `pnpm turbo build` for monorepo. Direct `npx tsc` per-package builds still work.
- **Suggested fix:** Extract vault/key management into a shared package (e.g., @agentspace/vault) that both cli and gateway can depend on without creating a cycle.
- **Priority:** Medium - blocks monorepo-wide turbo builds but doesn't block development.
