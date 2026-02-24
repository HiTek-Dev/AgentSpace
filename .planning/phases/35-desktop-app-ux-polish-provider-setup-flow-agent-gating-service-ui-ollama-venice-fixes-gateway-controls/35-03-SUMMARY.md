---
phase: 35-desktop-app-ux-polish-provider-setup-flow-agent-gating-service-ui-ollama-venice-fixes-gateway-controls
plan: 03
subsystem: ui
tags: [react, zustand, provider-gating, dynamic-models, gateway-rpc, agents]

# Dependency graph
requires:
  - phase: 35-desktop-app-ux-polish-provider-setup-flow-agent-gating-service-ui-ollama-venice-fixes-gateway-controls
    provides: "Ollama/Venice provider.models.list working, inline detail pattern"
provides:
  - "hasConfiguredProvider state gating Agents tab visibility"
  - "NavItem disabled prop for conditional sidebar navigation"
  - "Startup provider check redirecting to providers page when none configured"
  - "useAvailableModels hook fetching dynamic provider/model combos from gateway"
  - "Dynamic model pickers in AgentsView and ModelRoutingEditor"
affects: [desktop-app, agent-management, model-selection]

# Tech tracking
tech-stack:
  added: []
  patterns: [provider-gating-pattern, dynamic-model-discovery, startup-redirect]

key-files:
  created:
    - apps/desktop/src/hooks/useAvailableModels.ts
  modified:
    - apps/desktop/src/stores/app-store.ts
    - apps/desktop/src/components/ui/nav-item.tsx
    - apps/desktop/src/components/NavSidebar.tsx
    - apps/desktop/src/App.tsx
    - apps/desktop/src/views/AgentsView.tsx
    - apps/desktop/src/components/agents/ModelRoutingEditor.tsx

key-decisions:
  - "SERVICE_KEYS filter excludes telegram/brave/tavily from LLM provider checks"
  - "Startup provider check runs on gateway connect with fail-open on error"
  - "useAvailableModels hook fetches vault.keys.list then provider.models.list per configured provider"
  - "Model labels use provider/name format (e.g. anthropic/Claude Sonnet 4)"

patterns-established:
  - "Provider gating: Zustand hasConfiguredProvider state drives NavItem disabled and startup redirect"
  - "Dynamic model discovery: useAvailableModels hook chains vault + provider RPCs for model enumeration"

requirements-completed: [UXP-06, UXP-07, UXP-08, UXP-09]

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 35 Plan 03: Agent Gating and Dynamic Model Pickers Summary

**Provider gating disables Agents tab until configured, startup redirects to providers page, dynamic model pickers replace all hardcoded lists with gateway-fetched provider/model combos**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T17:49:58Z
- **Completed:** 2026-02-24T17:53:32Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Agents tab visually disabled and unclickable when no providers configured via hasConfiguredProvider Zustand state
- App startup checks gateway for configured providers and redirects to providers page if none found
- New useAvailableModels hook fetches provider/model combos dynamically from all configured LLM providers
- Agent create form and model routing editor both use dynamic model lists with "provider/model" format
- All hardcoded MODEL_OPTIONS arrays removed from codebase

## Task Commits

Each task was committed atomically:

1. **Task 1: Add provider gating to app store, nav sidebar, and startup check** - `e4661c5` (feat)
2. **Task 2: Create useAvailableModels hook and wire dynamic model pickers** - `0bc2f48` (feat)

## Files Created/Modified
- `apps/desktop/src/hooks/useAvailableModels.ts` - New hook fetching provider/model combos from gateway RPCs
- `apps/desktop/src/stores/app-store.ts` - Added hasConfiguredProvider boolean state and setter
- `apps/desktop/src/components/ui/nav-item.tsx` - Added disabled and tooltip props to NavItem
- `apps/desktop/src/components/NavSidebar.tsx` - Agents tab conditionally disabled based on hasConfiguredProvider
- `apps/desktop/src/App.tsx` - Startup provider check effect in ViewRouter with redirect logic
- `apps/desktop/src/views/AgentsView.tsx` - Dynamic model select from useAvailableModels, removed hardcoded options
- `apps/desktop/src/components/agents/ModelRoutingEditor.tsx` - Replaced MODEL_OPTIONS with dynamic options from hook

## Decisions Made
- SERVICE_KEYS (telegram, brave, tavily) excluded from LLM provider check to avoid false positives from service integrations
- Startup provider check uses fail-open (catch block does nothing) so gateway incompatibility doesn't block app
- useAvailableModels chains vault.keys.list then provider.models.list per configured provider sequentially
- Model value format uses raw modelId for agent config compatibility, label uses provider/name for display
- eslint-disable for exhaustive-deps on startup effect since it should only run on connect change

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript strict mode flagged `availableModels[0].modelId` as possibly undefined -- added non-null assertion after length guard

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 plans in phase 35 are complete
- Desktop app UX polish is ready for visual verification in Tauri dev mode
- Provider gating, model discovery, and gateway controls all wired end-to-end

## Self-Check: PASSED

All 7 files verified on disk. All 2 task commits (e4661c5, 0bc2f48) verified in git log.

---
*Phase: 35-desktop-app-ux-polish-provider-setup-flow-agent-gating-service-ui-ollama-venice-fixes-gateway-controls*
*Completed: 2026-02-24*
