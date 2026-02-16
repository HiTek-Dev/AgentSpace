---
phase: 04-multi-provider-intelligence
plan: 01
subsystem: api
tags: [ai-sdk, multi-provider, openai, ollama, anthropic, provider-registry, streaming]

# Dependency graph
requires:
  - phase: 02-gateway-core
    provides: "WebSocket handlers, session manager, usage tracking, streaming infrastructure"
  - phase: 01-secure-foundation
    provides: "Vault for API key storage, database schema"
provides:
  - "Provider registry with lazy singleton pattern (buildRegistry, getRegistry)"
  - "resolveModelId() for backward-compatible bare model name resolution"
  - "getAvailableProviders() for listing configured providers"
  - "Extended pricing for Anthropic, OpenAI, and Ollama models"
  - "Mid-conversation model switching via msg.model field"
  - "ProviderName and ModelTier types for plan 04-02"
affects: [04-02-PLAN, cli-model-switching, routing]

# Tech tracking
tech-stack:
  added: ["@ai-sdk/openai@^3", "@ai-sdk/openai-compatible@^2"]
  patterns: ["Provider registry singleton", "Provider-qualified model IDs (provider:model)", "Backward-compatible model resolution"]

key-files:
  created:
    - packages/gateway/src/llm/registry.ts
  modified:
    - packages/gateway/src/llm/stream.ts
    - packages/gateway/src/llm/types.ts
    - packages/gateway/src/llm/provider.ts
    - packages/gateway/src/llm/index.ts
    - packages/gateway/src/usage/pricing.ts
    - packages/gateway/src/ws/handlers.ts
    - packages/gateway/src/session/types.ts
    - packages/gateway/src/session/store.ts
    - packages/gateway/src/session/manager.ts
    - packages/gateway/package.json

key-decisions:
  - "Singleton registry pattern consistent with SessionManager and UsageTracker"
  - "resolveModelId() prefixes bare model names with anthropic: for backward compatibility"
  - "Ollama always registered even without a key (local, keyless)"
  - "Pricing keeps both bare and provider-prefixed Anthropic entries"
  - "Used Parameters<typeof createProviderRegistry>[0] for provider map type instead of importing ProviderV3"
  - "Cast model to never for registry.languageModel() due to dynamic registry type parameter"

patterns-established:
  - "Provider-qualified model IDs: all model references use provider:model format"
  - "Model resolution: resolveModelId() converts bare names to provider-qualified"
  - "Mid-conversation model switching via updateModel on SessionManager"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 04 Plan 01: Provider Registry Summary

**Multi-provider registry with AI SDK 6 createProviderRegistry supporting Anthropic, OpenAI, and Ollama via unified provider-qualified model IDs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T22:10:52Z
- **Completed:** 2026-02-16T22:15:10Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Created provider registry module with lazy singleton, conditional provider registration based on vault keys, and Ollama always available
- Replaced hardcoded Anthropic streaming with unified registry.languageModel() call supporting any registered provider
- Extended pricing with OpenAI models (gpt-4o, gpt-4.1 family, o3/o4-mini) and Ollama wildcard ($0)
- Added mid-conversation model switching in handleChatSend with session model persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Install provider packages and create provider registry** - `c3c81e4` (feat)
2. **Task 2: Update streaming, pricing, and chat handler for multi-provider** - `1c95d9a` (feat)

## Files Created/Modified
- `packages/gateway/src/llm/registry.ts` - Provider registry with buildRegistry, getRegistry, resolveModelId, getAvailableProviders
- `packages/gateway/src/llm/stream.ts` - Refactored to use registry instead of hardcoded Anthropic
- `packages/gateway/src/llm/types.ts` - Added ProviderName and ModelTier types
- `packages/gateway/src/llm/provider.ts` - Deprecated getAnthropicProvider with JSDoc pointing to registry
- `packages/gateway/src/llm/index.ts` - Added registry exports and new type exports
- `packages/gateway/src/usage/pricing.ts` - Extended with OpenAI, Ollama, and provider-prefixed Anthropic entries
- `packages/gateway/src/ws/handlers.ts` - Added resolveModelId and mid-conversation model switching
- `packages/gateway/src/session/types.ts` - DEFAULT_MODEL updated to "anthropic:claude-sonnet-4-5-20250929"
- `packages/gateway/src/session/store.ts` - Added updateSessionModel function
- `packages/gateway/src/session/manager.ts` - Added updateModel method
- `packages/gateway/package.json` - Added @ai-sdk/openai and @ai-sdk/openai-compatible dependencies

## Decisions Made
- Singleton registry pattern consistent with existing SessionManager and UsageTracker patterns
- resolveModelId() prefixes bare model names with "anthropic:" for backward compatibility with existing sessions
- Ollama always registered (local, keyless) even though it may not be running
- Pricing table keeps both bare and provider-prefixed Anthropic entries for maximum backward compat
- Used `Parameters<typeof createProviderRegistry>[0]` type extraction instead of importing ProviderV3 directly (not re-exported from "ai" package)
- Cast model string to `never` for `registry.languageModel()` since dynamic registry has empty type parameter

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ProviderV3 type for provider map**
- **Found during:** Task 1 (creating registry.ts)
- **Issue:** `Record<string, unknown>` not assignable to `Record<string, ProviderV3>`, and `ProviderV3` not directly importable from `@ai-sdk/provider`
- **Fix:** Used `Parameters<typeof createProviderRegistry>[0]` to extract the correct provider map type
- **Files modified:** packages/gateway/src/llm/registry.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** c3c81e4

**2. [Rule 1 - Bug] Fixed registry.languageModel() type parameter**
- **Found during:** Task 2 (stream.ts refactor)
- **Issue:** Dynamic registry has `never` type parameter, so `string` arg rejected by typed overload
- **Fix:** Cast model to `never` with explanatory comment
- **Files modified:** packages/gateway/src/llm/stream.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 1c95d9a

---

**Total deviations:** 2 auto-fixed (2 bugs - TypeScript type issues with AI SDK generics)
**Impact on plan:** Both fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
- `pnpm turbo build` fails with cyclic dependency between @agentspace/cli and @agentspace/gateway -- this is a pre-existing issue (verified by stashing changes), not caused by this plan. Direct `npx tsc` build succeeds. Logged to deferred-items.md.

## User Setup Required
None - no external service configuration required. OpenAI key can be added via `agentspace keys add openai` when ready.

## Next Phase Readiness
- Provider registry complete, ready for Plan 04-02 (intelligent routing with complexity classifier)
- ProviderName and ModelTier types already exported for routing implementation
- getAvailableProviders() ready for routing decisions
- Pre-existing turbo build cycle should be resolved (deferred item)

---
*Phase: 04-multi-provider-intelligence*
*Completed: 2026-02-16*
