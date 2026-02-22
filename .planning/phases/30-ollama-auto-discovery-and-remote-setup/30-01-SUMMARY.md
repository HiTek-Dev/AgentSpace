---
phase: 30-ollama-auto-discovery-and-remote-setup
plan: 01
subsystem: llm, cli
tags: [ollama, model-discovery, onboarding, fetch, abort-controller]

# Dependency graph
requires:
  - phase: 12-model-aliases-and-selection
    provides: "ollamaEndpoints config schema, MODEL_CATALOG, buildModelOptions, Onboarding flow"
provides:
  - "Ollama discovery client (listOllamaModels, isOllamaReachable) at @tek/core/ollama/client"
  - "buildOllamaModelOptions() async model catalog builder for Ollama"
  - "Ollama auto-detect, remote endpoint, and model listing onboarding steps"
  - "ollamaEndpoints persistence from onboarding to app config"
affects: [31-desktop-chat-app, 32-streaming-chat, 34-cli-chat-ux]

# Tech tracking
tech-stack:
  added: []
  patterns: [abort-controller-timeout, subpath-export, async-probe-on-mount]

key-files:
  created:
    - packages/core/src/ollama/client.ts
  modified:
    - packages/core/package.json
    - packages/cli/src/lib/models.ts
    - packages/cli/src/components/Onboarding.tsx
    - packages/cli/src/commands/init.ts

key-decisions:
  - "Used native /api/tags with /v1/models fallback for richer model metadata"
  - "Stored endpoint URLs only in config, not discovered model lists (models change dynamically)"
  - "Created sub-components (OllamaDetectStep, OllamaRemoteInputStep) to keep Onboarding manageable"

patterns-established:
  - "AbortController timeout pattern for network probes (2-3s max)"
  - "Subpath exports for optional core modules (@tek/core/ollama/client)"
  - "useEffect-based async probe on component mount for detection steps"

requirements-completed: [OLLM-01, OLLM-02, OLLM-03, OLLM-04]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 30 Plan 01: Ollama Auto-Discovery and Remote Setup Summary

**Ollama discovery client with /api/tags probe, CLI onboarding auto-detection, and remote endpoint input with OLLAMA_HOST hint**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T03:17:53Z
- **Completed:** 2026-02-22T03:21:20Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Ollama discovery client in @tek/core with dual-endpoint probing (native + OpenAI-compat fallback)
- Automatic local Ollama detection during `tek init` that lists discovered models with parameter size and quantization info
- Remote Ollama endpoint input with connectivity validation and OLLAMA_HOST=0.0.0.0 hint on failure
- Discovered Ollama models appear alongside cloud provider models in default model selection
- Graceful degradation when Ollama is not running (informative skip, no crash)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Ollama discovery client in @tek/core** - `7a13d84` (feat)
2. **Task 2: Integrate Ollama discovery into CLI model catalog and onboarding** - `49f9fcc` (feat)

## Files Created/Modified
- `packages/core/src/ollama/client.ts` - Ollama discovery client with listOllamaModels, isOllamaReachable, OllamaModel types
- `packages/core/package.json` - Added ./ollama/client subpath export
- `packages/cli/src/lib/models.ts` - Added buildOllamaModelOptions() and formatOllamaModelName()
- `packages/cli/src/components/Onboarding.tsx` - Added ollama-detect, ollama-remote-ask, ollama-remote-input steps with sub-components
- `packages/cli/src/commands/init.ts` - Added ollamaEndpoints persistence to saved config

## Decisions Made
- Used native /api/tags endpoint as primary (richer metadata: parameter_size, quantization_level, family) with /v1/models as fallback
- Store only endpoint URLs in config, not model lists -- models are discovered dynamically at setup time
- Created OllamaDetectStep and OllamaRemoteInputStep as separate sub-components for cleaner separation of concerns
- Used AbortController with 2-3s timeout to prevent UI freezing during probes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ollama discovery client is ready for use by desktop app (Phase 31) and chat UX (Phase 34)
- Gateway registry already reads ollamaEndpoints from config, so discovered endpoints are automatically registered
- Future phases can use buildOllamaModelOptions() for dynamic model listing in any UI context

---
*Phase: 30-ollama-auto-discovery-and-remote-setup*
*Completed: 2026-02-22*
