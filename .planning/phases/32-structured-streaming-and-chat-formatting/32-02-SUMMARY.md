---
phase: 32-structured-streaming-and-chat-formatting
plan: 02
subsystem: ui
tags: [react, reasoning, sources, streaming, collapsible, lucide-react, websocket]

# Dependency graph
requires:
  - phase: 32-structured-streaming-and-chat-formatting
    provides: ChatStreamReasoning and ChatStreamSource WS protocol message types from gateway
  - phase: 31-desktop-chat-app-rebuild
    provides: useChat hook, StreamingMessage, MessageCard, MessageList, gateway-client types
provides:
  - ReasoningBlock collapsible UI component with streaming indicator
  - Desktop rendering of reasoning blocks (streaming + completed)
  - Desktop rendering of source attribution links
  - Extended ChatMessage union with reasoning and sources variants
affects: [32-03, desktop-chat]

# Tech tracking
tech-stack:
  added: []
  patterns: [collapsible reasoning block, ref-based reasoning accumulation, multi-message promotion on stream end]

key-files:
  created:
    - apps/desktop/src/components/ReasoningBlock.tsx
  modified:
    - apps/desktop/src/lib/gateway-client.ts
    - apps/desktop/src/hooks/useChat.ts
    - apps/desktop/src/components/StreamingMessage.tsx
    - apps/desktop/src/components/MessageCard.tsx
    - apps/desktop/src/components/MessageList.tsx
    - apps/desktop/src/views/ChatView.tsx

key-decisions:
  - "Reasoning message added before text message in array so it appears above response content"
  - "StreamingMessage renders when reasoning OR text present (not just text) to show early reasoning"

patterns-established:
  - "Multi-message promotion: stream end handler batches reasoning + text + sources into single setMessages call"
  - "Ref-based accumulation: streamingReasoningRef mirrors streamingReasoning state for closure safety"

requirements-completed: [STRM-04, STRM-07]

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 32 Plan 02: Desktop Reasoning and Sources Summary

**Collapsible reasoning blocks with streaming indicator and footnote-style source links in desktop chat UI**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T05:19:21Z
- **Completed:** 2026-02-22T05:21:41Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created ReasoningBlock component with Brain icon, collapsible toggle, and streaming pulse indicator
- Extended gateway-client types with ChatStreamReasoning, ChatStreamSource, and reasoning/sources ChatMessage variants
- Updated useChat hook to accumulate reasoning and sources during streaming, promoting to messages on stream end
- Updated StreamingMessage, MessageCard, MessageList, and ChatView to thread and render reasoning and sources

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ReasoningBlock component and extend gateway-client types** - `6b838f7` (feat)
2. **Task 2: Update useChat hook and message components to render reasoning and sources** - `2a82181` (feat)

## Files Created/Modified
- `apps/desktop/src/components/ReasoningBlock.tsx` - Collapsible reasoning block with Brain icon, streaming indicator
- `apps/desktop/src/lib/gateway-client.ts` - Added ChatStreamReasoning, ChatStreamSource, contentType on delta, reasoning/sources ChatMessage variants
- `apps/desktop/src/hooks/useChat.ts` - Added streamingReasoning state, pendingSources ref, new message type handlers
- `apps/desktop/src/components/StreamingMessage.tsx` - Renders ReasoningBlock above streaming content
- `apps/desktop/src/components/MessageCard.tsx` - Handles reasoning and sources message types in completed messages
- `apps/desktop/src/components/MessageList.tsx` - Threads streamingReasoning prop, shows streaming message on reasoning
- `apps/desktop/src/views/ChatView.tsx` - Destructures and passes streamingReasoning from useChat

## Decisions Made
- Reasoning message is added before the text message in the messages array so it renders above the response content
- StreamingMessage is shown when reasoning OR text is present (not just text), allowing early reasoning display before any text arrives

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Desktop fully renders all structured streaming content types (reasoning, sources, text with contentType)
- Ready for plan 32-03 (any remaining chat formatting work)
- ReasoningBlock component is reusable and exported for any future consumer

## Self-Check: PASSED

All 7 files verified present. Both commits (6b838f7, 2a82181) verified in git log.

---
*Phase: 32-structured-streaming-and-chat-formatting*
*Completed: 2026-02-21*
