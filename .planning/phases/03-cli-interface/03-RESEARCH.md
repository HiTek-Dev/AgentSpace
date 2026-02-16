# Phase 3: CLI Interface - Research

**Researched:** 2026-02-16
**Domain:** Terminal UI with React Ink, WebSocket chat client, markdown rendering
**Confidence:** HIGH

## Summary

Phase 3 builds a polished terminal chat interface in the existing `@agentspace/cli` package. The CLI already has Ink 6.x, React 19, `@inkjs/ui`, chalk, and commander installed from Phase 1 (onboarding wizard, key management). The new work adds a `chat` command that connects to the Phase 2 WebSocket gateway (`ws://127.0.0.1:{port}/gateway`), streams LLM responses in real-time, renders markdown with syntax-highlighted code blocks, and supports slash commands for session/model/config management.

The gateway writes `runtime.json` on startup with its PID and port, so the CLI can auto-discover the running gateway. The WebSocket protocol is already defined with Zod schemas (`ClientMessageSchema`, `ServerMessageSchema`) covering `chat.send`, `chat.stream.start`, `chat.stream.delta`, `chat.stream.end`, `session.list`, `session.created`, `context.inspect/inspection`, `usage.query/report`, and `error` message types.

**Primary recommendation:** Build the chat UI as Ink React components using the existing gateway protocol. Use `<Static>` for the scrolling message history and a live-updating `<Box>` for the current streaming response. Use `marked` + `marked-terminal` for markdown rendering and `cli-highlight` (via marked-terminal) for syntax highlighting. Use a custom `useWebSocket` hook to manage gateway connection lifecycle.

## Standard Stack

### Core (already installed in @agentspace/cli)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ink | ^6.0.0 | React terminal renderer | Only serious React-for-terminal solution. 3,247+ npm dependents. Flexbox via Yoga. v6.7.0 latest. |
| react | ^19.0.0 | Component model | Standard React hooks/components. Ink 6 supports React 19. |
| @inkjs/ui | ^2.0.0 | Pre-built UI components | TextInput, Spinner, Select, StatusMessage, Badge, Alert. Themed. |
| chalk | ^5.0.0 | Terminal colors | ESM-native string coloring within/outside Ink components. |
| commander | ^12.0.0 | CLI argument parsing | Subcommands: `agentspace chat`, `agentspace init`, etc. |

### New Dependencies Needed
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| marked | ^15.x | Markdown parser | Parse LLM markdown responses into tokens for rendering |
| marked-terminal | ^7.2.0 | Terminal markdown renderer | Render parsed markdown with terminal formatting (bold, italic, tables, etc.) |
| cli-highlight | ^2.1.11 | Syntax highlighting | Used by marked-terminal for fenced code block highlighting. Based on highlight.js, supports 180+ languages. |
| ws | ^8.x | WebSocket client | Connect to gateway from CLI. Already a transitive dep via @fastify/websocket in gateway. |
| nanoid | ^5.x | Request ID generation | Generate unique `id` fields for client messages. Already used in gateway. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| marked + marked-terminal | ink-markdown (npm) | ink-markdown wraps marked-terminal but is 2 years stale (v1.0.4), may not support Ink 6. Better to use marked-terminal directly and wrap in a custom Ink component. |
| marked-terminal | Custom markdown renderer | Massive effort for little gain. marked-terminal handles tables, lists, blockquotes, code blocks, links. |
| ws (raw) | react-use-websocket | Designed for browser React, not Ink. Build a simple custom hook instead. |
| Commander subcommands | Pastel (Next.js-like CLI framework) | Overkill. Commander already installed and working. Pastel adds routing complexity we don't need. |

**Installation:**
```bash
pnpm --filter @agentspace/cli add marked marked-terminal cli-highlight ws nanoid
pnpm --filter @agentspace/cli add -D @types/ws
```

## Architecture Patterns

### Recommended Project Structure
```
packages/cli/src/
├── index.ts                    # Commander entrypoint (existing)
├── commands/
│   ├── init.ts                 # Existing onboarding
│   ├── keys.ts                 # Existing key management
│   ├── config.ts               # Existing config command
│   ├── audit.ts                # Existing audit command
│   └── chat.ts                 # NEW: launches Ink chat UI
├── components/
│   ├── Onboarding.tsx          # Existing onboarding wizard
│   ├── Chat.tsx                # NEW: top-level chat app component
│   ├── MessageList.tsx         # NEW: scrollable message history (<Static>)
│   ├── MessageBubble.tsx       # NEW: single message (user/assistant/system)
│   ├── StreamingResponse.tsx   # NEW: live-updating assistant response
│   ├── InputBar.tsx            # NEW: user text input with slash command handling
│   ├── StatusBar.tsx           # NEW: session info, model, token count, cost
│   └── MarkdownRenderer.tsx    # NEW: renders markdown text with syntax highlighting
├── hooks/
│   ├── useWebSocket.ts         # NEW: gateway WebSocket connection + message dispatch
│   ├── useChat.ts              # NEW: chat state management (messages, streaming, sessions)
│   └── useSlashCommands.ts     # NEW: parse and execute slash commands
├── lib/
│   ├── gateway-client.ts       # NEW: typed WebSocket message helpers
│   ├── markdown.ts             # NEW: marked + marked-terminal configuration
│   └── discovery.ts            # NEW: read runtime.json to find gateway port
└── vault/                      # Existing vault code
```

### Pattern 1: Static + Live Split for Chat UI
**What:** Use Ink's `<Static>` component for completed messages and a regular `<Box>` for the currently streaming response.
**When to use:** Any terminal UI that displays a growing list of items with a live-updating item at the bottom.
**Example:**
```typescript
// Source: Ink docs - Static component pattern
import { Static, Box, Text } from "ink";

function Chat({ messages, streamingText }: ChatProps) {
  return (
    <Box flexDirection="column">
      {/* Completed messages - rendered once, never re-rendered */}
      <Static items={messages}>
        {(msg) => (
          <MessageBubble key={msg.id} message={msg} />
        )}
      </Static>

      {/* Currently streaming response - re-renders on each delta */}
      {streamingText && (
        <Box>
          <StreamingResponse text={streamingText} />
        </Box>
      )}

      {/* Input bar always at bottom */}
      <InputBar onSubmit={handleSubmit} />
    </Box>
  );
}
```

### Pattern 2: Custom useWebSocket Hook
**What:** A React hook that manages WebSocket connection to the gateway, dispatches typed messages, and provides callbacks for server events.
**When to use:** Any Ink component that needs to communicate with the gateway.
**Example:**
```typescript
import { useEffect, useRef, useCallback, useState } from "react";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "@agentspace/gateway";

interface UseWebSocketOptions {
  url: string;
  onMessage: (msg: ServerMessage) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
}

function useWebSocket({ url, onMessage, onError, onClose }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.on("open", () => setConnected(true));
    ws.on("message", (raw: Buffer) => {
      const msg = JSON.parse(raw.toString()) as ServerMessage;
      onMessage(msg);
    });
    ws.on("error", (err) => onError?.(err));
    ws.on("close", () => {
      setConnected(false);
      onClose?.();
    });

    return () => { ws.close(); };
  }, [url]);

  const send = useCallback((msg: ClientMessage) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  return { send, connected };
}
```

### Pattern 3: Gateway Auto-Discovery via runtime.json
**What:** The gateway writes `~/.config/agentspace/runtime.json` on startup with `{ pid, port, startedAt }`. The CLI reads this to find the gateway.
**When to use:** Every time the chat command starts, to locate the running gateway.
**Example:**
```typescript
import { readFileSync, existsSync } from "node:fs";
import { RUNTIME_PATH } from "@agentspace/core";

interface RuntimeInfo {
  pid: number;
  port: number;
  startedAt: string;
}

function discoverGateway(): RuntimeInfo | null {
  if (!existsSync(RUNTIME_PATH)) return null;
  try {
    const data = JSON.parse(readFileSync(RUNTIME_PATH, "utf-8")) as RuntimeInfo;
    // Verify process is actually running
    try { process.kill(data.pid, 0); } catch { return null; }
    return data;
  } catch { return null; }
}
```

### Pattern 4: Slash Command Dispatch
**What:** Intercept input starting with `/` and dispatch to handlers instead of sending as chat message.
**When to use:** InputBar component processes all user input.
**Example:**
```typescript
const SLASH_COMMANDS: Record<string, SlashCommandHandler> = {
  "/model": handleModelSwitch,    // /model claude-sonnet-4-5
  "/session": handleSession,      // /session list | /session new | /session <id>
  "/context": handleContext,      // /context inspect
  "/usage": handleUsage,          // /usage
  "/config": handleConfig,        // /config show
  "/clear": handleClear,          // /clear
  "/help": handleHelp,            // /help
  "/quit": handleQuit,            // /quit or /exit
};

function processInput(input: string, send: SendFn) {
  const trimmed = input.trim();
  if (trimmed.startsWith("/")) {
    const [cmd, ...args] = trimmed.split(" ");
    const handler = SLASH_COMMANDS[cmd];
    if (handler) {
      handler(args, send);
    } else {
      // Unknown slash command
      showError(`Unknown command: ${cmd}. Type /help for available commands.`);
    }
  } else {
    // Regular chat message
    send({ type: "chat.send", id: nanoid(), content: trimmed });
  }
}
```

### Pattern 5: Markdown Rendering with marked-terminal
**What:** Configure marked + marked-terminal to render LLM responses with syntax highlighting.
**When to use:** Rendering assistant message content.
**Example:**
```typescript
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

// Configure once at module level
marked.setOptions({
  renderer: new TerminalRenderer({
    // Use full terminal width
    width: process.stdout.columns || 80,
    // Enable syntax highlighting via cli-highlight
    tab: 2,
    // Customize colors if desired
  }),
});

function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}
```

### Anti-Patterns to Avoid
- **Re-rendering entire message history:** Never put all messages in a regular `<Box>`. Use `<Static>` for completed messages -- it renders each item once and never re-renders.
- **Polling for gateway:** Do not poll for the gateway. Read `runtime.json` once at startup. If gateway is not running, show a clear error and exit.
- **Blocking the Ink render loop:** WebSocket message handling must be non-blocking. Use state updates (setState) to trigger re-renders, never synchronous waits.
- **Raw terminal escape codes:** Never write ANSI codes directly. Use chalk for coloring and Ink's `<Text>` props for styling. Mixing raw escapes with Ink's renderer causes layout corruption.
- **Building custom markdown parser:** marked-terminal handles the complexity of terminal markdown rendering (widths, wrapping, table alignment). Do not re-implement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom ANSI markdown parser | marked + marked-terminal | Tables, nested lists, blockquotes, link formatting all have edge cases. marked-terminal handles them. |
| Syntax highlighting | Custom code colorizer | cli-highlight (via marked-terminal) | 180+ languages via highlight.js. Theme support. Language auto-detection. |
| Terminal layout | Manual cursor positioning | Ink Flexbox (`<Box>`) | Yoga handles terminal resize, flexbox alignment, padding, borders. Manual positioning breaks on resize. |
| Input handling | Raw stdin reader | @inkjs/ui TextInput + Ink useInput | Handles line editing, backspace, cursor movement, paste. Building this correctly is surprisingly hard. |
| Scrollable output | Custom viewport/scroll buffer | Ink `<Static>` component | Static renders items once and pushes them above the viewport. Purpose-built for growing logs/chat. |
| WebSocket reconnection | Custom retry logic | Simple reconnect with exponential backoff | Keep it simple: try 3 times with 1s/2s/4s delays. Don't build a full reconnection manager for localhost. |

**Key insight:** The value of this phase is in the UX polish (Claude Code-style display, responsive layout, clear information hierarchy), not in reimplementing well-solved infrastructure problems.

## Common Pitfalls

### Pitfall 1: Streaming Text Causes Layout Thrashing
**What goes wrong:** Each `chat.stream.delta` triggers a re-render. If the markdown is re-parsed on every delta, partial markdown (unclosed code blocks, half-complete tables) causes rendering artifacts.
**Why it happens:** LLM responses stream token-by-token. Partial markdown is syntactically invalid.
**How to avoid:** During streaming, display raw text (or apply minimal formatting like newlines). Only apply full markdown rendering after `chat.stream.end`. Alternatively, buffer deltas and re-render markdown on a throttled interval (e.g., every 100ms) using a simple state batching approach.
**Warning signs:** Flickering output, code blocks appearing/disappearing, layout jumping.

### Pitfall 2: Ink Static Items Must Have Stable Keys
**What goes wrong:** `<Static>` tracks which items have been rendered using array position and keys. If items are reordered or keys change, items get re-rendered or duplicated.
**Why it happens:** `<Static>` is designed for append-only lists. It assumes new items only appear at the end.
**How to avoid:** Use stable, unique IDs as keys (e.g., message IDs from the gateway). Only append to the messages array, never mutate or reorder. Use a ref or state that grows monotonically.
**Warning signs:** Duplicate messages in output, missing messages.

### Pitfall 3: WebSocket Closes Silently on Gateway Restart
**What goes wrong:** If the gateway restarts (e.g., user stops/starts it), the WebSocket closes and the CLI shows no feedback, appearing frozen.
**Why it happens:** WebSocket `close` event fires but nothing updates the UI.
**How to avoid:** The `useWebSocket` hook must update a `connected` state on close. The UI must show a disconnection banner and attempt to reconnect. Show clear status: "Disconnected from gateway. Reconnecting..." with a spinner.
**Warning signs:** CLI appears frozen, no response to input.

### Pitfall 4: TextInput Conflicts with useInput
**What goes wrong:** If both `<TextInput>` and `useInput` are active, keystrokes get intercepted by both, causing double-handling or dropped characters.
**Why it happens:** Ink's input system delivers keystrokes to all active input handlers.
**How to avoid:** Use `useInput` only when TextInput is not focused (e.g., for global shortcuts like Ctrl+C). Use the `isActive` option on `useInput` to conditionally activate it. Or use `useFocus` to manage which component receives input.
**Warning signs:** Characters appearing twice, slash commands being partially eaten.

### Pitfall 5: Terminal Width Not Respected
**What goes wrong:** Markdown output overflows terminal width, creating ugly line wrapping or horizontal scrolling.
**Why it happens:** marked-terminal defaults to 80 columns. User's terminal may be different.
**How to avoid:** Read `process.stdout.columns` and pass it to marked-terminal's `width` option. Listen for terminal resize events (`process.stdout.on('resize', ...)`) and update the width.
**Warning signs:** Text wrapping at wrong positions, tables breaking.

### Pitfall 6: ESM + React JSX Configuration
**What goes wrong:** TypeScript fails to compile JSX in `.tsx` files, or Ink components fail at runtime with "React is not defined" or module resolution errors.
**Why it happens:** Ink 6 is ESM-only. React 19 needs the correct JSX transform configured.
**How to avoid:** The existing tsconfig.json already has `"jsx": "react-jsx"` and `"jsxImportSource": "react"` configured correctly. Ensure all new `.tsx` files are in the `src/` directory. Use `.js` extensions in imports (TypeScript ESM requires this).
**Warning signs:** Compilation errors mentioning JSX or React, runtime "Cannot find module" errors.

## Code Examples

### Gateway Discovery and Chat Launch
```typescript
// commands/chat.ts
import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { RUNTIME_PATH } from "@agentspace/core";
import { Chat } from "../components/Chat.js";
import { discoverGateway } from "../lib/discovery.js";

export const chatCommand = new Command("chat")
  .description("Start a chat session with your agent")
  .option("-m, --model <model>", "Model to use")
  .option("-s, --session <id>", "Resume an existing session")
  .action(async (options) => {
    const gateway = discoverGateway();
    if (!gateway) {
      console.error("Gateway is not running. Start it with: agentspace serve");
      process.exit(1);
    }

    const wsUrl = `ws://127.0.0.1:${gateway.port}/gateway`;
    const { waitUntilExit } = render(
      React.createElement(Chat, {
        wsUrl,
        initialModel: options.model,
        resumeSessionId: options.session,
      })
    );
    await waitUntilExit();
  });
```

### Chat Component Structure
```typescript
// components/Chat.tsx
import React, { useState, useCallback } from "react";
import { Box, Text, useApp } from "ink";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { useChat } from "../hooks/useChat.js";
import { MessageList } from "./MessageList.js";
import { StreamingResponse } from "./StreamingResponse.js";
import { InputBar } from "./InputBar.js";
import { StatusBar } from "./StatusBar.js";

interface ChatProps {
  wsUrl: string;
  initialModel?: string;
  resumeSessionId?: string;
}

export function Chat({ wsUrl, initialModel, resumeSessionId }: ChatProps) {
  const { exit } = useApp();
  const {
    messages,
    streamingText,
    sessionId,
    model,
    usage,
    connected,
    handleServerMessage,
    addUserMessage,
  } = useChat({ initialModel, resumeSessionId });

  const { send } = useWebSocket({
    url: wsUrl,
    onMessage: handleServerMessage,
    onClose: () => { /* update connected state */ },
  });

  const handleSubmit = useCallback((input: string) => {
    // Slash command handling would go here
    addUserMessage(input);
    send({
      type: "chat.send",
      id: nanoid(),
      sessionId,
      content: input,
      model,
    });
  }, [send, sessionId, model]);

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar
        connected={connected}
        sessionId={sessionId}
        model={model}
        usage={usage}
      />
      <MessageList messages={messages} />
      {streamingText && <StreamingResponse text={streamingText} />}
      <InputBar onSubmit={handleSubmit} />
    </Box>
  );
}
```

### Markdown Rendering Component
```typescript
// components/MarkdownRenderer.tsx
import React from "react";
import { Text } from "ink";
import { renderMarkdown } from "../lib/markdown.js";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const rendered = renderMarkdown(content);
  return <Text>{rendered}</Text>;
}

// lib/markdown.ts
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

const renderer = new TerminalRenderer({
  width: process.stdout.columns || 80,
  tab: 2,
  reflowText: true,
});

marked.setOptions({ renderer });

export function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}
```

### useChat Hook (State Management)
```typescript
// hooks/useChat.ts
import { useState, useCallback } from "react";
import type { ServerMessage } from "@agentspace/gateway";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

interface UseChatState {
  messages: ChatMessage[];
  streamingText: string;
  sessionId: string | null;
  model: string;
  connected: boolean;
  usage: { totalTokens: number; totalCost: number };
}

export function useChat(opts: { initialModel?: string; resumeSessionId?: string }) {
  const [state, setState] = useState<UseChatState>({
    messages: [],
    streamingText: "",
    sessionId: opts.resumeSessionId ?? null,
    model: opts.initialModel ?? "claude-sonnet-4-5-20250929",
    connected: false,
    usage: { totalTokens: 0, totalCost: 0 },
  });

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "session.created":
        setState(s => ({ ...s, sessionId: msg.sessionId }));
        break;
      case "chat.stream.start":
        setState(s => ({ ...s, streamingText: "", model: msg.model }));
        break;
      case "chat.stream.delta":
        setState(s => ({ ...s, streamingText: s.streamingText + msg.delta }));
        break;
      case "chat.stream.end":
        setState(s => ({
          ...s,
          messages: [...s.messages, {
            id: msg.requestId,
            role: "assistant",
            content: s.streamingText,
            timestamp: new Date().toISOString(),
          }],
          streamingText: "",
          usage: {
            totalTokens: s.usage.totalTokens + msg.usage.totalTokens,
            totalCost: s.usage.totalCost + msg.cost.totalCost,
          },
        }));
        break;
      case "error":
        // Add error as system message
        setState(s => ({
          ...s,
          messages: [...s.messages, {
            id: msg.requestId ?? "error",
            role: "system",
            content: `Error: ${msg.message}`,
            timestamp: new Date().toISOString(),
          }],
          streamingText: "",
        }));
        break;
    }
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setState(s => ({
      ...s,
      messages: [...s.messages, {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      }],
    }));
  }, []);

  return { ...state, handleServerMessage, addUserMessage };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| blessed/blessed-contrib | Ink 6.x (React renderer) | blessed unmaintained since 2018 | React component model, hooks, Flexbox layout |
| Vorpal/Inquirer for CLI | Commander + Ink + @inkjs/ui | 2023-2024 | Declarative UI, themed components |
| console.log-based chat | Static + streaming Box pattern | Ink 3+ (2020) | Efficient rendering of growing message lists |
| Custom ANSI markdown | marked + marked-terminal v7 | marked-terminal v7 (Oct 2024) | 180+ language syntax highlighting, table support |
| ink-markdown wrapper | Direct marked-terminal | ink-markdown stale (v1.0.4, 2 years old) | More control, guaranteed Ink 6 compat |

**Deprecated/outdated:**
- blessed/blessed-contrib: Unmaintained since 2018. Do not use.
- ink-markdown (npm): Last updated 2+ years ago, uncertain Ink 6 compatibility. Use marked-terminal directly.
- vorpal: Abandoned. Commander is the standard.

**Note on Claude Code's approach:** Claude Code originally used Ink but later rewrote the renderer from scratch while keeping React as the component model, because Ink did not support the fine-grained incremental updates they needed. For AgentSpace's simpler chat interface, standard Ink is sufficient. The custom renderer approach is only needed for extremely complex terminal UIs with many independent updating regions.

## Open Questions

1. **Gateway auto-start from CLI**
   - What we know: The gateway needs to be running before `agentspace chat` works. Currently it starts via `node packages/gateway/dist/index.js`.
   - What's unclear: Should `agentspace chat` auto-start the gateway if it's not running? Or should there be a separate `agentspace serve` command?
   - Recommendation: Add an `agentspace serve` command that starts the gateway in the foreground. The `agentspace chat` command should check for the gateway and print a clear error if it is not running. Auto-starting is a nice-to-have for later but adds complexity (background process management, stdout conflicts with Ink).

2. **Default command behavior**
   - What we know: Currently `agentspace` (no subcommand) shows help or suggests init.
   - What's unclear: Should `agentspace` with no args launch chat directly (like Claude Code does)?
   - Recommendation: Make `agentspace` (no args) launch chat if onboarding is complete and gateway is running. This matches Claude Code UX. Fall back to help otherwise.

3. **Inline tool call / bash command display (CLI-02)**
   - What we know: The requirement says "displays bash commands, tool calls, and reasoning inline." The current gateway protocol only streams text deltas -- it does not send structured tool call events.
   - What's unclear: Tool calling is Phase 6. How to satisfy CLI-02 now?
   - Recommendation: Build the message display components with a `MessageType` union that includes `tool_call`, `bash_command`, and `reasoning` variants alongside `text`. For Phase 3, only the `text` variant is populated. The UI structure is in place for Phase 6 to fill in tool calls. For now, if the LLM response contains markdown code blocks with `bash` language tags, render them with special styling (similar to how Claude Code shows bash blocks differently).

4. **Streaming markdown rendering fidelity**
   - What we know: Rendering markdown mid-stream produces artifacts (unclosed code fences, partial tables).
   - What's unclear: Exactly how much markdown should be rendered during streaming vs. after completion.
   - Recommendation: During streaming, render plain text with basic newline handling. Apply full markdown rendering only on `stream.end`. This is the simplest correct approach. A future improvement could add a throttled incremental markdown renderer.

## Sources

### Primary (HIGH confidence)
- Ink GitHub repo (https://github.com/vadimdemedes/ink) -- v6.7.0 latest, components, hooks, Static pattern
- ink-ui GitHub repo (https://github.com/vadimdemedes/ink-ui) -- @inkjs/ui v2, TextInput, Spinner, Select, StatusMessage, themed components
- marked-terminal GitHub repo (https://github.com/mikaelbr/marked-terminal) -- v7.2.0, cli-highlight integration, config options
- Existing codebase: `packages/cli/` (Phase 1 CLI), `packages/gateway/src/ws/protocol.ts` (WebSocket protocol), `packages/gateway/src/key-server/server.ts` (runtime.json discovery)

### Secondary (MEDIUM confidence)
- Claude Code Internals blog (https://kotrotsos.medium.com/claude-code-internals-part-11-terminal-ui-542fe17db016) -- Claude Code uses React+Ink, later rewrote renderer. Confirms React/Ink is the right starting point.
- How Claude Code is built (https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built) -- Tech stack choices, "on distribution" philosophy for TypeScript+React.
- ivanleo.com (https://ivanleo.com/blog/migrating-to-react-ink) -- Building a coding CLI with React Ink, practical patterns.

### Tertiary (LOW confidence)
- ink-markdown npm (https://www.npmjs.com/package/ink-markdown) -- v1.0.4, last published 2+ years ago, Ink 6 compat unverified. Recommend avoiding.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Ink 6, React 19, @inkjs/ui, marked-terminal are all verified current and actively maintained. Already partially installed.
- Architecture: HIGH -- Static + live Box pattern is documented by Ink. WebSocket hook pattern is standard React. Gateway protocol is well-defined with Zod schemas.
- Pitfalls: HIGH -- Streaming markdown artifacts, Static key stability, and input handler conflicts are well-documented issues in the Ink ecosystem.

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days -- Ink ecosystem is stable)
