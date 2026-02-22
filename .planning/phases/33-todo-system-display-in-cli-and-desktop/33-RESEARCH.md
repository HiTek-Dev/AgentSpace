# Phase 33: Todo System Display in CLI and Desktop - Research

**Researched:** 2026-02-21
**Domain:** Task tracking display, WebSocket protocol extension, Ink CLI components, React desktop components
**Confidence:** HIGH

## Summary

Phase 33 adds a task/todo tracking display to both the CLI (bottom status area) and desktop (chat interface). The system is modeled after Claude Code's task tracking, where agents create, update, and complete tasks during execution, and the client renders them with spinners and progress indicators.

There is **no existing todo system in Tek's codebase**. The phase description says "display the existing todo system," but investigation reveals no todo/task tools, protocol messages, or data structures exist anywhere in the gateway, CLI, or desktop packages. This phase must build the full vertical: gateway tool definitions, WS protocol messages, and client-side rendering in both CLI (Ink) and desktop (React/Tailwind).

The approach follows Claude Code's model: the agent calls tool(s) like `todo_write` or `task_create`/`task_update` during execution, the gateway relays task state changes to connected clients via new WS message types, and clients render task lists with status indicators (spinner for in-progress, checkmark for complete, circle for pending).

**Primary recommendation:** Use a single `todo_write` tool (full-replace semantics like Claude Code's `TodoWrite`) for simplicity, extend the WS protocol with a `todo.update` server message type, and render a compact task panel in both CLI and desktop.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ink (existing) | ^6.0.0 | CLI component rendering | Already used for all CLI UI |
| @inkjs/ui (existing) | ^2.0.0 | Spinner component | Already used for streaming spinner |
| react (existing) | ^19.x | Desktop component rendering | Already used in desktop |
| zod (existing) | (gateway dep) | WS protocol schema validation | Already used for all protocol messages |
| zustand (existing) | ^5.0.5 | Desktop state management | Already used in desktop app store |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react (existing) | ^0.487.0 | Icons for task status | CheckCircle, Circle, Loader2 icons in desktop |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single `todo_write` tool (full replace) | Separate `task_create`/`task_update`/`task_list` tools | Separate tools match Claude Code's newer model but add complexity; `todo_write` is simpler for v1 and matches the Agent SDK pattern |
| WS protocol message per task | Full task list in each message | Individual messages are more efficient but harder to reconcile; full-list replace is simpler and matches the tool model |

**Installation:** No new packages needed. All dependencies already exist.

## Architecture Patterns

### Recommended Project Structure

```
packages/gateway/src/
  tools/
    todo.ts              # New: todo_write tool definition (AI SDK tool)
  ws/
    protocol.ts          # Modified: add TodoUpdate server message schema
    handlers.ts          # Modified: handle todo state and relay to clients

packages/cli/src/
  components/
    TodoPanel.tsx         # New: compact task list below streaming response

apps/desktop/src/
  components/
    TodoPanel.tsx         # New: task progress panel in chat area
  lib/
    gateway-client.ts     # Modified: add TodoUpdate to ServerMessage union
  hooks/
    useChat.ts            # Modified: handle todo.update messages
```

### Pattern 1: Tool-Driven Todo State

**What:** The LLM agent calls a `todo_write` tool during execution. This tool accepts an array of todo items (each with content, status, and optional activeForm). The gateway stores the current todo list in the ConnectionState and relays updates to connected clients.

**When to use:** Every time the agent wants to track progress on a multi-step task.

**Example:**

```typescript
// packages/gateway/src/tools/todo.ts
import { tool } from "ai";
import { z } from "zod";

const TodoItemSchema = z.object({
  id: z.string().describe("Unique identifier for the todo item"),
  content: z.string().describe("Description of the task"),
  status: z.enum(["pending", "in_progress", "completed"]).describe("Current status"),
  activeForm: z.string().optional().describe("Present-continuous text shown during in_progress (e.g. 'Fixing bug')"),
});

export type TodoItem = z.infer<typeof TodoItemSchema>;

export function createTodoWriteTool(
  onUpdate: (todos: TodoItem[]) => void,
) {
  return tool({
    description: "Create or update a todo list to track task progress. Replace the entire list each time.",
    parameters: z.object({
      todos: z.array(TodoItemSchema).describe("The complete todo list"),
    }),
    execute: async ({ todos }) => {
      onUpdate(todos);
      const completed = todos.filter(t => t.status === "completed").length;
      return `Updated todo list: ${completed}/${todos.length} completed`;
    },
  });
}
```

### Pattern 2: WS Protocol Extension

**What:** New server message type `todo.update` carries the full todo list from gateway to clients.

**When to use:** Every time the `todo_write` tool is called.

**Example:**

```typescript
// In protocol.ts - new server message
const TodoUpdateSchema = z.object({
  type: z.literal("todo.update"),
  requestId: z.string(),
  todos: z.array(z.object({
    id: z.string(),
    content: z.string(),
    status: z.enum(["pending", "in_progress", "completed"]),
    activeForm: z.string().optional(),
  })),
});
```

### Pattern 3: CLI TodoPanel (Ink)

**What:** A compact Ink component that renders the active todo list above the input bar. Shows a spinner for in_progress items (using activeForm text), checkmarks for completed, and dimmed circles for pending.

**When to use:** Displayed when there are active todos during a streaming session.

**Example:**

```tsx
// packages/cli/src/components/TodoPanel.tsx
import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";

interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

export function TodoPanel({ todos }: { todos: TodoItem[] }) {
  if (todos.length === 0) return null;

  const completed = todos.filter(t => t.status === "completed").length;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>Tasks ({completed}/{todos.length})</Text>
      {todos.map((todo) => (
        <Box key={todo.id}>
          {todo.status === "completed" && <Text color="green">{"  + "}</Text>}
          {todo.status === "in_progress" && <Spinner label={` ${todo.activeForm || todo.content}`} />}
          {todo.status === "pending" && <Text dimColor>{"  o "}{todo.content}</Text>}
          {todo.status === "completed" && <Text strikethrough dimColor>{todo.content}</Text>}
        </Box>
      ))}
    </Box>
  );
}
```

### Pattern 4: Desktop TodoPanel (React/Tailwind)

**What:** A React component that renders the task list as a compact panel within the chat area, either above the input or as a floating status panel.

**When to use:** Displayed during agent execution when todos are present.

**Example:**

```tsx
// apps/desktop/src/components/TodoPanel.tsx
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

export function TodoPanel({ todos }: { todos: TodoItem[] }) {
  if (todos.length === 0) return null;
  const completed = todos.filter(t => t.status === "completed").length;

  return (
    <div className="border-t px-4 py-2 space-y-1">
      <div className="text-xs text-muted-foreground">
        Tasks ({completed}/{todos.length})
      </div>
      {todos.map((todo) => (
        <div key={todo.id} className="flex items-center gap-2 text-sm">
          {todo.status === "completed" && (
            <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
          )}
          {todo.status === "in_progress" && (
            <Loader2 className="size-3.5 text-blue-500 animate-spin shrink-0" />
          )}
          {todo.status === "pending" && (
            <Circle className="size-3.5 text-muted-foreground shrink-0" />
          )}
          <span className={todo.status === "completed" ? "line-through text-muted-foreground" : ""}>
            {todo.status === "in_progress" ? (todo.activeForm || todo.content) : todo.content}
          </span>
        </div>
      ))}
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Storing todos in the database:** Todos are ephemeral per-request state. They exist during agent execution and are cleared when the stream ends. Do NOT persist them to SQLite.
- **Building separate CRUD endpoints:** The todo system is tool-driven, not API-driven. The agent calls the tool, the gateway relays. No client->server todo messages needed.
- **Complex dependency tracking in v1:** Claude Code's newer TaskCreate/TaskUpdate has `blocks`/`blockedBy` dependencies. For Tek v1, skip dependencies -- just support `pending`/`in_progress`/`completed` status.
- **Per-item WS messages:** Don't send individual `todo.item.created`, `todo.item.updated` messages. Send the full list each time (it's small -- typically 3-10 items).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated spinner in CLI | Custom animation loop | `@inkjs/ui` Spinner component | Already in deps, handles terminal refresh correctly |
| Animated spinner in desktop | Custom CSS animation | Tailwind `animate-spin` on Lucide Loader2 | Already available, consistent with Tailwind patterns |
| Todo ID generation | Custom incrementing counter | `nanoid()` (CLI) / `crypto.randomUUID()` (desktop) | Already used throughout both codebases |
| Protocol validation | Manual type checks | Zod schemas in protocol.ts | Established pattern for all WS messages |

**Key insight:** The entire todo display is a thin layer on top of existing infrastructure. The gateway tool system, WS protocol, and Ink/React rendering patterns already exist. This phase is primarily "wire up a new tool and render its output."

## Common Pitfalls

### Pitfall 1: Todos Persisting After Stream Ends
**What goes wrong:** Todo list stays visible after the agent finishes responding, showing stale state.
**Why it happens:** Not clearing todo state on `chat.stream.end`.
**How to avoid:** Clear the todo list state when `chat.stream.end` is received. Optionally show a brief "completed" summary then fade.
**Warning signs:** Todos from a previous request showing during a new request.

### Pitfall 2: Todo Tool Not Available to Agent
**What goes wrong:** Agent never creates todos because the tool isn't registered.
**Why it happens:** Forgetting to add `todo_write` to the tool registry in `buildToolRegistry()`.
**How to avoid:** Add `todo_write` in tool-registry.ts, set approval policy to "auto" (no approval needed for status tracking).
**Warning signs:** Agent responds without any task tracking, even for complex multi-step tasks.

### Pitfall 3: Race Condition Between Tool Result and Todo Update
**What goes wrong:** Todo update arrives at client before or interleaved with the tool result that triggered it.
**Why it happens:** The `onUpdate` callback in the tool fires synchronously, but the tool result is async.
**How to avoid:** The `todo_write` tool's `onUpdate` callback should emit the WS message synchronously (before the tool result). Both arrive in order because they're on the same transport.
**Warning signs:** Flickering or out-of-order rendering in the client.

### Pitfall 4: Desktop TodoPanel Overlapping Chat Input
**What goes wrong:** Todo panel pushes the chat input off-screen or creates layout conflicts.
**Why it happens:** Flexbox layout not accounting for the new panel.
**How to avoid:** Place TodoPanel in the same position as the usage/cost footer (above ChatInput), using `shrink-0` to prevent compression.
**Warning signs:** Chat input hidden or partially visible when todos are shown.

### Pitfall 5: System Prompt Not Instructing Agent to Use Todos
**What goes wrong:** Agent has the `todo_write` tool but never uses it.
**Why it happens:** Without system prompt guidance, the agent doesn't know when to create todos.
**How to avoid:** Add a brief instruction to the base system prompt: "For complex multi-step tasks (3+ steps), use the todo_write tool to track progress. Update task status as you work."
**Warning signs:** Agent uses all other tools but ignores todo_write.

## Code Examples

Verified patterns from the existing codebase:

### Adding a New Server Message to Protocol (from Phase 32)

```typescript
// Source: packages/gateway/src/ws/protocol.ts (existing pattern)
const TodoUpdateSchema = z.object({
  type: z.literal("todo.update"),
  requestId: z.string(),
  todos: z.array(z.object({
    id: z.string(),
    content: z.string(),
    status: z.enum(["pending", "in_progress", "completed"]),
    activeForm: z.string().optional(),
  })),
});

// Add to ServerMessageSchema discriminated union
export const ServerMessageSchema = z.discriminatedUnion("type", [
  // ...existing schemas
  TodoUpdateSchema,
]);
```

### Adding a New Tool to Registry (from tool-registry.ts)

```typescript
// Source: packages/gateway/src/agent/tool-registry.ts (existing pattern)
// In buildToolRegistry(), after memory tools:

// 8. Add todo tracking tool
const todoWrite = createTodoWriteTool((todos) => {
  // Relay to transport -- need transport reference in closure
  // or use an event emitter pattern
});
tools.todo_write = todoWrite;
// No approval needed for todo tracking
if (approvalPolicy) {
  approvalPolicy.perTool.todo_write = "auto";
}
```

### Handling Server Messages in CLI useChat (existing pattern)

```typescript
// Source: packages/cli/src/hooks/useChat.ts (existing pattern)
case "todo.update": {
  setTodos(msg.todos);
  break;
}
```

### Handling Server Messages in Desktop useChat (existing pattern)

```typescript
// Source: apps/desktop/src/hooks/useChat.ts (existing pattern)
case 'todo.update': {
  setTodos(msg.todos);
  break;
}
```

### Tool-to-Transport Relay Pattern

The challenge is passing the transport reference into the tool's execute function. The existing codebase handles this in `tool-loop.ts` where the `transport` is available in the `runAgentLoop` closure. The todo tool's `onUpdate` callback can be created in the handler that sets up the agent loop:

```typescript
// In handlers.ts or where runAgentLoop is called:
const todoWrite = createTodoWriteTool((todos) => {
  transport.send({
    type: "todo.update",
    requestId,
    todos,
  });
  // Also store in connection state for late-joining clients
  connState.activeTodos = todos;
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Claude Code `TodoWrite` (single tool, full replace) | Claude Code `TaskCreate`/`TaskUpdate`/`TaskList`/`TaskGet` (separate CRUD tools) | Jan 2026 (Claude Code 2.1+) | Separate tools enable dependencies, blockers, multi-session coordination |
| Todos in conversation context | Tasks on disk (`~/.claude/tasks/`) | Jan 2026 | Zero context cost, crash recovery, cross-session persistence |

**For Tek v1:** Use the simpler `todo_write` full-replace approach. The CRUD model with dependencies can be added later if needed. The full-replace model is simpler to implement, simpler to render, and sufficient for single-session task tracking.

## Open Questions

1. **Phase 34 dependency: CLI layout changes**
   - What we know: Phase 34 will overhaul the CLI to have a "fixed bottom input area that expands as user types, status section pinned below input." The todo panel needs to integrate with this new layout.
   - What's unclear: Phase 34 hasn't been planned yet. The todo panel might be placed differently depending on the Phase 34 layout decisions.
   - Recommendation: Build the TodoPanel as a standalone component with no layout assumptions. Phase 34 can relocate it. For now, place it between StreamingResponse and InputBar in the CLI layout, and between the message list and cost footer in desktop.

2. **Should todos clear on stream end or persist?**
   - What we know: Claude Code keeps tasks visible (they're on disk). Tek's todos are ephemeral in-memory.
   - What's unclear: User preference -- should completed tasks remain visible after the response ends?
   - Recommendation: Keep todos visible until the next user message sends (allows reviewing what was done). Clear on `chat.stream.start` of the next request.

3. **Where does the todo tool get the transport reference?**
   - What we know: Tools are registered in `buildToolRegistry()` which doesn't have transport access. The transport is available in `handlers.ts` and `tool-loop.ts`.
   - What's unclear: Best pattern to connect them.
   - Recommendation: Create the todo tool with an `onUpdate` callback in the handler code (where transport is available), similar to how the Claude Code tool has a `canUseTool` callback. Pass it into the tool loop options.

4. **Connection state for todo persistence**
   - What we know: `ConnectionState` tracks per-connection state (streaming, approvals, etc.)
   - What's unclear: Whether todos should be stored there.
   - Recommendation: Add an `activeTodos: TodoItem[]` field to `ConnectionState`. This allows late-joining desktop/CLI clients to see current progress. Clear on stream start.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `packages/gateway/src/ws/protocol.ts` -- WS protocol schema patterns
- Existing codebase: `packages/gateway/src/agent/tool-loop.ts` -- agent tool execution and transport relay
- Existing codebase: `packages/gateway/src/agent/tool-registry.ts` -- tool registration patterns
- Existing codebase: `packages/cli/src/components/Chat.tsx` -- CLI layout and component composition
- Existing codebase: `apps/desktop/src/views/ChatView.tsx` -- desktop chat layout
- Existing codebase: `apps/desktop/src/hooks/useChat.ts` -- desktop WS message handling
- Existing codebase: `packages/cli/src/hooks/useChat.ts` -- CLI WS message handling

### Secondary (MEDIUM confidence)
- Anthropic Agent SDK docs (https://platform.claude.com/docs/en/api/agent-sdk/todo-tracking) -- TodoWrite tool model, lifecycle, display patterns
- Claude Code system prompts (https://github.com/Piebald-AI/claude-code-system-prompts) -- TaskCreate/TaskUpdate tool definitions and field structure

### Tertiary (LOW confidence)
- Community articles on Claude Code task evolution (TodoWrite -> TaskCreate/TaskUpdate) -- timeline and migration patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already exist in the project, no new packages needed
- Architecture: HIGH -- follows established patterns from Phase 32 (protocol extension + client rendering)
- Pitfalls: HIGH -- identified from direct codebase analysis, transport wiring and layout integration are the main risks
- Todo tool design: MEDIUM -- based on Claude Code's model which is well-documented, but Tek may want adjustments

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable domain, no fast-moving dependencies)
