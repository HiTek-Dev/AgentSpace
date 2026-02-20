# Deferred Items - Phase 25

## Pre-existing Issues

### 1. Cyclic dependency: @tek/gateway <-> @tek/telegram

**Discovered during:** 25-01 Task 2 verification
**Description:** `@tek/telegram` depends on `@tek/gateway` and vice versa. This cycle was previously masked by the larger cli/gateway/telegram cycle. Now that cli-gateway is broken, turbo surfaces this remaining cycle.
**Impact:** `pnpm turbo build` fails due to invalid dependency graph. Individual `tsc` builds succeed.
**Suggested fix:** Extract shared types/interfaces to `@tek/core` or make telegram a peer dependency of gateway.
