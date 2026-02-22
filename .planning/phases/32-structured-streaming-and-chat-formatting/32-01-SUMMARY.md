---
phase: 32-structured-streaming-and-chat-formatting
plan: 01
subsystem: api
tags: [websocket, streaming, ai-sdk, fullstream, reasoning, sources, system-prompt]

# Dependency graph
requires:
  - phase: 31-desktop-chat-app-rebuild
    provides: WS protocol with chat.stream.delta, tool-loop fullStream, context assembler
provides:
  - ChatStreamReasoning and ChatStreamSource WS protocol message types
  - fullStream-based streaming in stream.ts with reasoning/source yields
  - Reasoning and source relay in tool-loop.ts
  - Conditional extended thinking for Claude models
  - Response formatting system prompt injection
affects: [32-02, 32-03, desktop-chat, cli-chat]

# Tech tracking
tech-stack:
  added: []
  patterns: [fullStream consumption, conditional providerOptions, structured stream protocol]

key-files:
  created: []
  modified:
    - packages/gateway/src/ws/protocol.ts
    - packages/gateway/src/llm/types.ts
    - packages/gateway/src/llm/stream.ts
    - packages/gateway/src/agent/tool-loop.ts
    - packages/gateway/src/context/assembler.ts

key-decisions:
  - "Used reasoning-delta (not reasoning) part type to match AI SDK v6 fullStream API"
  - "Filter source parts by sourceType=url to handle document sources gracefully"
  - "Defined local ProviderOptions type alias matching AI SDK JSONObject structure"
  - "Extended thinking budget set to 8000 tokens as starting point"

patterns-established:
  - "fullStream consumption: iterate result.fullStream with switch on part.type for all content types"
  - "Conditional provider options: getReasoningOptions() returns ProviderOptions | undefined based on model name"
  - "Source type filtering: only emit url-type sources to transport, skip document sources"

requirements-completed: [STRM-01, STRM-02, STRM-03, STRM-06]

# Metrics
duration: 6min
completed: 2026-02-21
---

# Phase 32 Plan 01: Gateway Structured Streaming Summary

**Extended WS protocol with reasoning/source message types, refactored both streaming paths to fullStream, and injected response formatting system prompt**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-22T05:09:29Z
- **Completed:** 2026-02-22T05:16:09Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Protocol extended with `chat.stream.reasoning` and `chat.stream.source` server message types
- Both streaming paths (stream.ts and tool-loop.ts) now use fullStream and emit structured content types
- Extended thinking conditionally enabled for Claude Opus 4, Sonnet 4, and Claude 3.7 Sonnet models
- Every LLM call now includes a response formatting system prompt section

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend WS protocol and StreamChunk types** - `989ea10` (feat)
2. **Task 2: Refactor streaming paths, reasoning options, formatting prompt** - `a089291` (feat)

## Files Created/Modified
- `packages/gateway/src/ws/protocol.ts` - Added ChatStreamReasoning/Source schemas, contentType field on delta
- `packages/gateway/src/llm/types.ts` - Added StreamReasoning and StreamSource to StreamChunk union
- `packages/gateway/src/llm/stream.ts` - Refactored to fullStream, added getReasoningOptions helper
- `packages/gateway/src/agent/tool-loop.ts` - Added reasoning-delta and source cases, provider options
- `packages/gateway/src/context/assembler.ts` - Added RESPONSE_FORMAT_PROMPT constant and injection

## Decisions Made
- Used `reasoning-delta` (not `reasoning`) part type matching AI SDK v6 fullStream API -- the research referenced an older API shape
- Filter source parts by `sourceType === "url"` since Source is a discriminated union with url and document variants
- Defined local `ProviderOptions` type alias (`Record<string, JSONObject>`) to match AI SDK's expected type without importing unexported types
- Set extended thinking budget to 8000 tokens as a moderate starting point

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed reasoning part type name from `reasoning` to `reasoning-delta`**
- **Found during:** Task 2 (refactoring stream.ts and tool-loop.ts)
- **Issue:** Plan specified `case "reasoning"` but AI SDK v6 fullStream emits `reasoning-delta` part type
- **Fix:** Changed both stream.ts and tool-loop.ts to use `reasoning-delta` in switch cases
- **Files modified:** packages/gateway/src/llm/stream.ts, packages/gateway/src/agent/tool-loop.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** a089291 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed source part type handling for discriminated union**
- **Found during:** Task 2 (refactoring stream.ts and tool-loop.ts)
- **Issue:** Plan accessed `part.url` directly but Source type is a discriminated union (url vs document), so url property only exists on sourceType=url variant
- **Fix:** Added `if (part.sourceType === "url")` guard before accessing url/title properties
- **Files modified:** packages/gateway/src/llm/stream.ts, packages/gateway/src/agent/tool-loop.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** a089291 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed providerOptions type from `Record<string, unknown>` to proper JSONObject structure**
- **Found during:** Task 2 (adding provider options to streamText calls)
- **Issue:** Plan used `Record<string, unknown>` return type for getReasoningOptions, but AI SDK expects `Record<string, JSONObject>` where JSONObject = `{ [key: string]: JSONValue | undefined }`
- **Fix:** Added local type aliases matching AI SDK's JSONObject structure and typed return as `ProviderOptions`
- **Files modified:** packages/gateway/src/llm/stream.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** a089291 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs from incorrect AI SDK API assumptions in plan)
**Impact on plan:** All fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the type/API deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Protocol types ready for desktop and CLI client consumption in plans 32-02 and 32-03
- getReasoningOptions exported from stream.ts for reuse by tool-loop.ts
- Response format prompt active in all assembled contexts

---
*Phase: 32-structured-streaming-and-chat-formatting*
*Completed: 2026-02-21*
