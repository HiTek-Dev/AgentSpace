---
phase: 33-todo-system-display-in-cli-and-desktop
verified: 2026-02-21T00:00:00Z
status: passed
score: 12/12 must-haves verified
---

# Phase 33: Todo System Display in CLI and Desktop — Verification Report

**Phase Goal:** Build a todo tracking system where agents call a `todo_write` tool to track progress on multi-step tasks, with real-time display in both CLI (Ink) and desktop (React/Tailwind) via `todo.update` WS protocol messages
**Verified:** 2026-02-21
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Gateway exposes a todo_write tool agents can call | VERIFIED | `packages/gateway/src/tools/todo.ts` — `createTodoWriteTool` factory with full `TodoItemSchema`, execute callback |
| 2 | When todo_write is called, a todo.update WS message is sent to the client | VERIFIED | `handlers.ts:377-389` — `onTodoUpdate` calls `transport.send({ type: "todo.update", ... })` |
| 3 | Todo tool is auto-approved and registered alongside existing tools | VERIFIED | `tool-registry.ts:332-339` — registered without `wrapToolWithApproval`, `perTool.todo_write = "auto"` |
| 4 | System prompt instructs agents to use todo_write for complex multi-step tasks | VERIFIED | `assembler.ts:30` — `"- For complex multi-step tasks (3+ steps), use the todo_write tool..."` |
| 5 | activeTodos cleared on each new chat.stream.start | VERIFIED | `handlers.ts:438` (handleChatSend path) and `handlers.ts:858` (handlePreflightApproval path) |
| 6 | CLI shows compact todo panel with spinner/checkmark/circle indicators | VERIFIED | `packages/cli/src/components/TodoPanel.tsx` — Spinner for in_progress, green + for completed, dimColor o for pending |
| 7 | CLI todo panel appears between StreamingResponse and ToolPanel/InputBar | VERIFIED | `Chat.tsx:190` — `<TodoPanel todos={todos} />` placed after StreamingResponse block |
| 8 | CLI todo state clears on new streaming response start | VERIFIED | `useChat.ts:110` — `setTodos([])` in `chat.stream.start` case |
| 9 | CLI progress count shows completed/total in panel header | VERIFIED | `TodoPanel.tsx:19` — `Tasks ({completed}/{todos.length})` |
| 10 | Desktop shows compact todo panel with animated Loader2 spinner, CheckCircle2, Circle | VERIFIED | `apps/desktop/src/components/TodoPanel.tsx` — all three Lucide icons present with animate-spin on Loader2 |
| 11 | Desktop todo panel appears above chat input | VERIFIED | `ChatView.tsx:176` — `<TodoPanel todos={todos} />` between usage footer and ChatInput |
| 12 | Desktop todo state clears on new streaming response start | VERIFIED | `apps/desktop/src/hooks/useChat.ts:97` — `setTodos([])` in `chat.stream.start` case |

**Score:** 12/12 truths verified

---

## Required Artifacts

### Plan 01 — Gateway

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/gateway/src/tools/todo.ts` | createTodoWriteTool factory | VERIFIED | 38 lines, exports `createTodoWriteTool` and `TodoItem`, uses `inputSchema` with zod schema |
| `packages/gateway/src/ws/protocol.ts` | TodoUpdate server message schema | VERIFIED | `TodoUpdateSchema` at line 701, added to `ServerMessageSchema` discriminated union at line 750, `TodoUpdate` type exported |
| `packages/gateway/src/ws/connection.ts` | activeTodos field on ConnectionState | VERIFIED | `activeTodos: TodoItem[]` in interface (line 34), initialized `activeTodos: []` in `initConnection()` (line 56) |

### Plan 02 — CLI

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/cli/src/components/TodoPanel.tsx` | Compact Ink todo list component | VERIFIED | 37 lines (above 25 min), exports `TodoPanel`, uses Spinner from @inkjs/ui, handles all three statuses |
| `packages/cli/src/hooks/useChat.ts` | todo.update message handler and todos state | VERIFIED | `TodoItem` interface exported, `todos` state, `todo.update` case at line 247, cleared on stream.start and error |

### Plan 03 — Desktop

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/desktop/src/components/TodoPanel.tsx` | React/Tailwind todo panel with Lucide icons | VERIFIED | 46 lines (above 25 min), exports `TodoPanel`, CheckCircle2/Loader2/Circle from lucide-react |
| `apps/desktop/src/lib/gateway-client.ts` | TodoUpdate in ServerMessage union | VERIFIED | `TodoUpdate` interface at line 129, added to `ServerMessage` union at line 153 |
| `apps/desktop/src/hooks/useChat.ts` | todo.update handler and todos state | VERIFIED | `TodoItem` interface, `todos` state, `todo.update` case at line 240, cleared on stream.start and error and clearMessages |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/gateway/src/tools/todo.ts` | `packages/gateway/src/ws/handlers.ts` | `onUpdate callback wired in handleChatSend` | WIRED | `onTodoUpdate` option at handlers.ts:377, calls `createTodoWriteTool(options.onTodoUpdate)` in tool-registry.ts:333 |
| `packages/gateway/src/ws/handlers.ts` | `transport.send` | `todo.update message relay` | WIRED | handlers.ts:379-388 — `transport.send({ type: "todo.update", requestId: msg.id, todos: ... })` |
| `packages/gateway/src/agent/tool-registry.ts` | `packages/gateway/src/tools/todo.ts` | `import and register in buildToolRegistry` | WIRED | tool-registry.ts:20 imports `createTodoWriteTool`, registered at line 333 as `tools.todo_write` |
| `packages/cli/src/hooks/useChat.ts` | `packages/cli/src/components/Chat.tsx` | `todos state prop passed to TodoPanel` | WIRED | Chat.tsx:58 destructures `todos` from `useChat()`, passes as `<TodoPanel todos={todos} />` at line 190 |
| `packages/cli/src/components/TodoPanel.tsx` | `@inkjs/ui` | `Spinner component import` | WIRED | TodoPanel.tsx:3 — `import { Spinner } from "@inkjs/ui"`, used at line 23 |
| `apps/desktop/src/hooks/useChat.ts` | `apps/desktop/src/views/ChatView.tsx` | `todos state destructured and passed to TodoPanel` | WIRED | ChatView.tsx:36 destructures `todos` from `useChat()`, passed as `<TodoPanel todos={todos} />` at line 176 |
| `apps/desktop/src/components/TodoPanel.tsx` | `lucide-react` | `CheckCircle2, Loader2, Circle imports` | WIRED | TodoPanel.tsx:1 — `import { CheckCircle2, Circle, Loader2 } from "lucide-react"`, all three used in render |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TODO-01 | 33-01 | Gateway provides todo_write tool with full-replace semantics | SATISFIED | `tools/todo.ts` — execute replaces entire list each call via `onUpdate(todos)` |
| TODO-02 | 33-01 | WS protocol extended with todo.update server message type | SATISFIED | `protocol.ts:701-712` — `TodoUpdateSchema` in `ServerMessageSchema` union |
| TODO-03 | 33-01 | Todo tool auto-approved and registered in tool registry | SATISFIED | `tool-registry.ts:332-339` — registered without approval wrapper, `perTool.todo_write = "auto"` |
| TODO-04 | 33-01 | System prompt instructs agents to use todo_write for 3+ step tasks | SATISFIED | `assembler.ts:30` — instruction present in `RESPONSE_FORMAT_PROMPT` |
| TODO-05 | 33-02 | CLI displays compact todo panel with spinner/checkmark/circle | SATISFIED | `TodoPanel.tsx` — Ink component with three status indicators confirmed |
| TODO-06 | 33-03 | Desktop displays compact todo panel with animated spinner/checkmark/circle | SATISFIED | Desktop `TodoPanel.tsx` — Lucide icons, animate-spin on Loader2 |
| TODO-07 | 33-01, 33-02, 33-03 | Todo state cleared on chat.stream.start | SATISFIED | Gateway: handlers.ts:438, 858. CLI: useChat.ts:110. Desktop: useChat.ts:97 |

All 7 requirement IDs from plans accounted for. No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/cli/src/components/TodoPanel.tsx` | 12 | `return null` | Info | Intentional — renders nothing when todos array is empty |
| `apps/desktop/src/components/TodoPanel.tsx` | 11 | `return null` | Info | Intentional — renders nothing when todos array is empty |
| `packages/gateway/src/ws/handlers.ts` | 972 | `resolve: () => {}` comment references "placeholder" | Info | Pre-existing code unrelated to phase 33; not a phase artifact |

No blockers. No warnings. The `return null` guard patterns are the specified correct behavior for empty todo lists.

---

## Human Verification Required

### 1. Real-time spinner animation in CLI

**Test:** Run a multi-step agent task in the CLI that uses todo_write; observe the terminal during execution.
**Expected:** Ink Spinner from @inkjs/ui animates while a task is in_progress, switches to green "+" when completed.
**Why human:** Spinner animation is a real-time terminal rendering behavior, not verifiable statically.

### 2. Real-time spinner animation in desktop

**Test:** Run a multi-step agent task in the desktop app; observe the todo panel during execution.
**Expected:** Loader2 icon from lucide-react animates (rotates via animate-spin) for in_progress tasks, CheckCircle2 (green) for completed, Circle (muted) for pending.
**Why human:** CSS animation requires visual inspection in a running Tauri webview.

### 3. activeForm text displayed during in_progress

**Test:** Trigger an agent that uses todo_write with activeForm values (e.g., `activeForm: "Fixing bug"`).
**Expected:** The in_progress task shows "Fixing bug" instead of the base content in both CLI and desktop.
**Why human:** Requires a running agent that populates activeForm — cannot verify from static code alone (though the conditional rendering logic is verified at code level).

---

## Gaps Summary

No gaps. All must-haves verified, all key links wired, all 7 requirement IDs satisfied.

---

_Verified: 2026-02-21_
_Verifier: Claude (gsd-verifier)_
