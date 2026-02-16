# Phase 2: Gateway Core - Research

**Researched:** 2026-02-16
**Domain:** WebSocket gateway server, LLM streaming (Anthropic), session management, context assembly/inspection, token counting, cost tracking
**Confidence:** HIGH (core stack and patterns verified) / MEDIUM (token estimation accuracy, context inspector UX details)

## Summary

Phase 2 transforms the existing Fastify server (currently serving only the key-serving API on 127.0.0.1) into a full WebSocket gateway that routes messages between clients and the Anthropic LLM with streaming responses. The gateway manages isolated sessions per agent with transparent session keys, assembles context from multiple sources (system prompt, memory stubs, skills stubs, history, tools), exposes that assembled context for user inspection before sending, and tracks token usage and cost per request with running totals.

The core technical stack is already decided: Fastify 5.x with `@fastify/websocket` for WebSocket support, AI SDK 6.x with `@ai-sdk/anthropic` for LLM streaming, and Drizzle + SQLite for session/usage persistence. The primary challenge is designing a clean WebSocket JSON protocol that supports bidirectional communication (user messages, streaming chunks, context inspection requests, usage reports) while keeping the architecture extensible for future channels (CLI, Telegram, web dashboard) that will connect through the same gateway.

AI SDK 6 provides built-in token usage tracking via `streamText` -- the `usage` and `totalUsage` properties return `inputTokens`, `outputTokens`, and `totalTokens` after streaming completes. For pre-send token estimation (needed for GATE-07 context inspector), use the `tokenx` library (2kB, zero dependencies, ~95-98% accuracy) or a simple characters-per-token heuristic (Anthropic suggests ~3.5 chars/token). Cost calculation uses the official pricing: Anthropic Sonnet 4.5 at $3/$15 per MTok (input/output), Haiku 4.5 at $1/$5, Opus 4.5/4.6 at $5/$25.

**Primary recommendation:** Build WebSocket infrastructure first (server + protocol + connection management), then session management with persistence, then LLM integration with streaming, then context assembly and inspection, then token/cost tracking last (it depends on everything else being wired up).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @fastify/websocket | 11.x | WebSocket support for Fastify | Official Fastify plugin. Route-based WS handlers integrated with Fastify lifecycle (hooks, error handlers, decorators). Uses `ws` under the hood. |
| ai (Vercel AI SDK) | 6.x | Multi-provider LLM abstraction with streaming | The standard for TypeScript LLM apps. 2M+ weekly downloads. Unified `streamText` API with token usage tracking built in. |
| @ai-sdk/anthropic | latest (3.x for SDK 6) | Anthropic Claude provider | Official provider package. Supports all Claude models. `createAnthropic()` for custom config (API key, base URL). |
| ws | 8.x | WebSocket implementation | Transitive dependency of @fastify/websocket. 35M weekly npm downloads. Battle-tested. |
| tokenx | latest | Pre-send token estimation | 2kB bundle, zero dependencies, ~95-98% accuracy without a full tokenizer. Pattern-based estimation with language-specific configs. |
| zod | 4.x | WebSocket message schema validation | Already in use (Phase 1). Validates all inbound/outbound WS messages. |
| nanoid | 5.x | Session and message ID generation | URL-safe, non-sequential unique IDs. Smaller and faster than uuid. ESM-native. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/ws | latest | TypeScript types for ws | Required for TypeScript usage with @fastify/websocket. Dev dependency. |
| drizzle-orm | 0.45.x | Session and usage persistence | Already in @agentspace/db. Extend with session and usage tracking tables. |
| better-sqlite3 | 11.x | SQLite driver | Already in @agentspace/db. Sync API for session state persistence. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @fastify/websocket | Socket.IO | Socket.IO adds protocol overhead (handshake, rooms, namespaces) we do not need. We control both client and server. Pure WebSocket is cleaner. |
| Custom WS protocol | tRPC over WebSocket | tRPC adds complexity and coupling. Our protocol is simple enough (5-6 message types) that a custom JSON protocol is clearer and more transparent. |
| tokenx | @anthropic-ai/tokenizer | Anthropic's tokenizer is only accurate for pre-Claude-3 models. For Claude 3+ Anthropic recommends using the API `usage` response field. tokenx gives us pre-send estimates without an API call. |
| tokenx | Anthropic countTokens API | API call adds latency and rate limit consumption. tokenx gives instant local estimates. Use API for billing-grade accuracy if needed later. |
| nanoid | uuid | uuid v4 is 36 chars with dashes. nanoid is 21 chars, URL-safe, and faster. Better for session keys that users see. |

**Installation (Phase 2 packages):**
```bash
# Gateway package -- add WebSocket and LLM dependencies
pnpm --filter @agentspace/gateway add @fastify/websocket ai @ai-sdk/anthropic tokenx nanoid
pnpm --filter @agentspace/gateway add -D @types/ws
```

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions to @agentspace/gateway)

```
packages/gateway/src/
├── key-server/              # Existing from Phase 1
│   ├── index.ts
│   ├── server.ts
│   ├── routes.ts
│   └── auth.ts
├── ws/                      # NEW: WebSocket gateway
│   ├── index.ts             # Public API: createGatewayServer()
│   ├── server.ts            # Fastify + WS setup, route registration
│   ├── protocol.ts          # Message types, serialization, validation
│   ├── connection.ts        # Connection lifecycle, heartbeat, cleanup
│   └── handlers.ts          # Message dispatch (chat, inspect, usage query)
├── session/                 # NEW: Session management
│   ├── index.ts
│   ├── manager.ts           # Create/restore/expire sessions
│   ├── store.ts             # SQLite persistence via @agentspace/db
│   └── types.ts             # Session, SessionKey types
├── llm/                     # NEW: LLM integration
│   ├── index.ts
│   ├── stream.ts            # streamText wrapper with usage tracking
│   ├── provider.ts          # Anthropic provider setup (API key from vault)
│   └── types.ts             # LLM request/response types
├── context/                 # NEW: Context assembly and inspection
│   ├── index.ts
│   ├── assembler.ts         # Build context from sources
│   ├── inspector.ts         # Byte/token/cost breakdown per section
│   └── types.ts             # ContextSection, InspectionResult types
├── usage/                   # NEW: Token usage and cost tracking
│   ├── index.ts
│   ├── tracker.ts           # Per-request tracking, running totals
│   ├── pricing.ts           # Model pricing tables
│   └── store.ts             # SQLite persistence for usage records
└── index.ts                 # Updated: export both key-server and gateway
```

### New DB Schema (additions to @agentspace/db)

```
packages/db/src/schema/
├── audit-log.ts             # Existing
├── sessions.ts              # NEW: Session state persistence
├── messages.ts              # NEW: Conversation message history
├── usage.ts                 # NEW: Token usage records per request
└── index.ts                 # Updated: export all schemas
```

### Pattern 1: WebSocket JSON Protocol

**What:** A typed JSON protocol for all client-gateway communication. Each message has a `type` field that determines the payload shape. Messages are validated with Zod on both inbound and outbound paths.
**When to use:** Every WebSocket message. No raw text or binary messages.
**Confidence:** HIGH -- JSON-based WS protocols are the standard pattern for AI chat applications.

```typescript
// Source: Project-specific protocol design informed by MCP JSON-RPC pattern
import { z } from 'zod';

// Client -> Gateway messages
const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('chat.send'),
    id: z.string(),
    sessionId: z.string().optional(), // omit to create new session
    content: z.string(),
    model: z.string().optional(),     // override default model
  }),
  z.object({
    type: z.literal('context.inspect'),
    id: z.string(),
    sessionId: z.string(),
  }),
  z.object({
    type: z.literal('usage.query'),
    id: z.string(),
    sessionId: z.string().optional(), // omit for global totals
  }),
  z.object({
    type: z.literal('session.list'),
    id: z.string(),
  }),
]);

// Gateway -> Client messages
const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('chat.stream.start'),
    requestId: z.string(),
    sessionId: z.string(),
    model: z.string(),
  }),
  z.object({
    type: z.literal('chat.stream.delta'),
    requestId: z.string(),
    delta: z.string(), // text chunk
  }),
  z.object({
    type: z.literal('chat.stream.end'),
    requestId: z.string(),
    usage: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalTokens: z.number(),
    }),
    cost: z.object({
      inputCost: z.number(),  // USD
      outputCost: z.number(), // USD
      totalCost: z.number(),  // USD
    }),
  }),
  z.object({
    type: z.literal('context.inspection'),
    requestId: z.string(),
    sections: z.array(z.object({
      name: z.string(),        // 'system_prompt', 'history', 'memory', 'skills', 'tools'
      content: z.string(),
      byteCount: z.number(),
      tokenEstimate: z.number(),
      costEstimate: z.number(), // USD
    })),
    totals: z.object({
      byteCount: z.number(),
      tokenEstimate: z.number(),
      costEstimate: z.number(),
    }),
  }),
  z.object({
    type: z.literal('usage.report'),
    requestId: z.string(),
    perModel: z.record(z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalTokens: z.number(),
      totalCost: z.number(),
      requestCount: z.number(),
    })),
    grandTotal: z.object({
      totalCost: z.number(),
      totalTokens: z.number(),
      requestCount: z.number(),
    }),
  }),
  z.object({
    type: z.literal('error'),
    requestId: z.string().optional(),
    code: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal('session.created'),
    sessionId: z.string(),
    sessionKey: z.string(), // transparent session key visible to user
  }),
  z.object({
    type: z.literal('session.list'),
    requestId: z.string(),
    sessions: z.array(z.object({
      sessionId: z.string(),
      sessionKey: z.string(),
      model: z.string(),
      createdAt: z.string(),
      messageCount: z.number(),
    })),
  }),
]);
```

### Pattern 2: Session Management with Transparent Keys

**What:** Sessions are identified by a human-readable key format (`agent:{agentId}:{sessionId}`) inspired by OpenClaw. Session keys are visible to the user and serve as the transparency mechanism. Each session is isolated -- separate conversation history, context, and usage tracking.
**When to use:** Every interaction. No anonymous/sessionless requests.
**Confidence:** HIGH -- Session isolation is a well-established pattern. The transparent key format is a design choice from OpenClaw that aligns with the transparency principle.

```typescript
// Source: OpenClaw session key pattern + project-specific adaptation
import { nanoid } from 'nanoid';

interface Session {
  id: string;          // Internal ID (nanoid)
  sessionKey: string;  // Transparent key: 'agent:default:abc123'
  agentId: string;     // Agent identifier (initially 'default')
  model: string;       // Active model for this session
  createdAt: string;   // ISO 8601
  lastActiveAt: string;
  messages: Message[]; // Conversation history (loaded on demand)
}

function createSession(agentId: string = 'default', model: string): Session {
  const id = nanoid();
  return {
    id,
    sessionKey: `agent:${agentId}:${id}`,
    agentId,
    model,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    messages: [],
  };
}
```

### Pattern 3: LLM Streaming with AI SDK 6

**What:** Use AI SDK 6's `streamText` function with the Anthropic provider. The API key is retrieved from the vault (Phase 1). Token usage comes from the `usage` property after streaming completes.
**When to use:** Every chat message that needs an LLM response.
**Confidence:** HIGH -- AI SDK 6's streamText with Anthropic provider is well-documented and widely used.

```typescript
// Source: AI SDK 6 docs (ai-sdk.dev) + @ai-sdk/anthropic provider docs
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { ModelMessage } from 'ai';

// Create provider with key from vault
function createProvider(apiKey: string) {
  return createAnthropic({ apiKey });
}

// Stream a chat response
async function* streamChatResponse(
  provider: ReturnType<typeof createAnthropic>,
  model: string,
  messages: ModelMessage[],
  system?: string,
) {
  const result = streamText({
    model: provider(model),
    messages,
    system,
  });

  // Yield text deltas as they arrive
  for await (const chunk of result.textStream) {
    yield { type: 'delta' as const, text: chunk };
  }

  // After stream completes, yield usage info
  const usage = await result.usage;
  yield {
    type: 'done' as const,
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
    },
  };
}
```

### Pattern 4: Context Assembly and Inspection

**What:** Before each LLM call, the gateway assembles context from multiple sources into a structured object. Each section (system prompt, conversation history, memory, skills, tools) is measured for byte count and token estimate. The assembled context is available for user inspection via the `context.inspect` message before sending.
**When to use:** Every chat request. The context inspector is triggered by explicit client request.
**Confidence:** MEDIUM -- The assembly pattern is straightforward, but exact section names and content will evolve as memory/skills are built in later phases.

```typescript
// Source: Project-specific design aligned with GATE-06 and GATE-07 requirements
import { estimateTokenCount } from 'tokenx';

interface ContextSection {
  name: string;         // 'system_prompt' | 'history' | 'memory' | 'skills' | 'tools'
  content: string;      // The actual text that will be sent
  byteCount: number;    // Buffer.byteLength(content, 'utf8')
  tokenEstimate: number;
  costEstimate: number; // USD based on model pricing (input tokens)
}

interface AssembledContext {
  sections: ContextSection[];
  totals: { byteCount: number; tokenEstimate: number; costEstimate: number };
  messages: ModelMessage[]; // The actual messages array for AI SDK
  system?: string;          // System prompt string for AI SDK
}

function assembleContext(
  session: Session,
  userMessage: string,
  modelPricing: { inputPerMTok: number },
): AssembledContext {
  const sections: ContextSection[] = [];

  // System prompt (static for now, will come from SOUL.md in Phase 5)
  const systemPrompt = 'You are a helpful AI assistant.';
  addSection(sections, 'system_prompt', systemPrompt, modelPricing);

  // Conversation history
  const historyText = session.messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');
  addSection(sections, 'history', historyText, modelPricing);

  // Memory (stub for Phase 2 -- will be populated in Phase 5)
  addSection(sections, 'memory', '', modelPricing);

  // Skills (stub for Phase 2 -- will be populated in Phase 6)
  addSection(sections, 'skills', '', modelPricing);

  // Tools (stub for Phase 2 -- will be populated in Phase 6)
  addSection(sections, 'tools', '', modelPricing);

  // Current user message
  addSection(sections, 'user_message', userMessage, modelPricing);

  const totals = sections.reduce(
    (acc, s) => ({
      byteCount: acc.byteCount + s.byteCount,
      tokenEstimate: acc.tokenEstimate + s.tokenEstimate,
      costEstimate: acc.costEstimate + s.costEstimate,
    }),
    { byteCount: 0, tokenEstimate: 0, costEstimate: 0 },
  );

  return { sections, totals, messages: /* build ModelMessage[] */, system: systemPrompt };
}

function addSection(
  sections: ContextSection[],
  name: string,
  content: string,
  pricing: { inputPerMTok: number },
): void {
  const byteCount = Buffer.byteLength(content, 'utf8');
  const tokenEstimate = estimateTokenCount(content);
  const costEstimate = (tokenEstimate / 1_000_000) * pricing.inputPerMTok;
  sections.push({ name, content, byteCount, tokenEstimate, costEstimate });
}
```

### Pattern 5: Usage Tracking and Cost Calculation

**What:** After each LLM response completes, record the actual token usage (from AI SDK's `usage` object) and calculate cost based on model pricing. Store in SQLite with per-model aggregation. Provide running totals on demand.
**When to use:** After every completed LLM request.
**Confidence:** HIGH -- Straightforward recording and aggregation. Pricing data from official Anthropic docs.

```typescript
// Source: Anthropic pricing page (platform.claude.com/docs/en/about-claude/pricing)
// Prices in USD per million tokens
const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  // Anthropic models
  'claude-opus-4.6':      { inputPerMTok: 5,    outputPerMTok: 25 },
  'claude-opus-4.5':      { inputPerMTok: 5,    outputPerMTok: 25 },
  'claude-sonnet-4.5':    { inputPerMTok: 3,    outputPerMTok: 15 },
  'claude-sonnet-4':      { inputPerMTok: 3,    outputPerMTok: 15 },
  'claude-haiku-4.5':     { inputPerMTok: 1,    outputPerMTok: 5  },
  'claude-haiku-3.5':     { inputPerMTok: 0.80, outputPerMTok: 4  },
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { inputCost: number; outputCost: number; totalCost: number } {
  const pricing = MODEL_PRICING[model] ?? { inputPerMTok: 5, outputPerMTok: 25 };
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMTok;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMTok;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}
```

### Anti-Patterns to Avoid

- **Coupling WS protocol to HTTP routes:** The WebSocket handler should not share route logic with the REST key-server API. The WS protocol is its own message-based system. Keep them cleanly separated in different directories.
- **Blocking the event loop during streaming:** Never accumulate the entire LLM response before sending to client. Stream each text delta as it arrives via the WebSocket.
- **Storing full message content in session memory:** Keep message history in the database, load on demand. Do not hold unbounded conversation history in server memory.
- **Hardcoding model identifiers:** Use a configurable default model with per-session override. Model names change frequently (e.g., Anthropic's naming conventions).
- **Trusting client-provided session IDs blindly:** Always validate that the session exists and belongs to the connection. Reject unknown session IDs with a clear error.
- **Skipping WebSocket close/error handlers:** Always handle `close` and `error` events on the socket. Clean up session state, cancel in-progress streams, and log disconnections.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket server | Raw `ws.Server` with manual upgrade handling | @fastify/websocket | Integrates with Fastify lifecycle (hooks, error handlers, decorators). Handles upgrade negotiation. |
| LLM streaming | Direct Anthropic SDK HTTP calls with manual SSE parsing | AI SDK 6 `streamText` | Unified API across providers. Built-in token usage tracking. Handles retries, abort signals, multi-step tool loops. |
| Token estimation | Manual `text.length / 3.5` calculation | tokenx | Language-aware estimation at 95-98% accuracy. Handles CJK, code, and special characters better than a raw heuristic. |
| Unique IDs | `Math.random().toString(36)` or `crypto.randomUUID()` | nanoid | Shorter (21 chars vs 36), URL-safe, non-sequential, cryptographically strong. Better for session keys users see. |
| Message schema validation | Manual if/else type checking on WS messages | Zod discriminated unions | Type-safe parsing with clear error messages. Catches malformed messages at the boundary. |
| Cost calculation | Hardcoded arithmetic | Pricing table + calculation function | Pricing changes. A table-driven approach with a single calculation function is trivially updateable. |

**Key insight:** The gateway is a message-routing and orchestration layer. The complexity is in the protocol design and state management, not in the individual technology integrations. AI SDK handles LLM complexity; Fastify handles HTTP/WS complexity; Drizzle handles persistence complexity. The gateway's job is to wire them together cleanly.

## Common Pitfalls

### Pitfall 1: AI SDK 6 Breaking Changes from v5

**What goes wrong:** Code examples found online use AI SDK 5.x patterns that fail silently or throw errors in v6.
**Why it happens:** AI SDK 6 renamed several core types and deprecated key functions. `CoreMessage` became `ModelMessage`. `convertToCoreMessages()` became `convertToModelMessages()` and is now async. `generateObject`/`streamObject` are deprecated in favor of `streamText` with `output` parameter.
**How to avoid:** Use AI SDK 6 imports exclusively. Key renames: `CoreMessage` -> `ModelMessage`, `convertToCoreMessages` -> `convertToModelMessages` (now async with `await`). `cachedInputTokens` -> `inputTokenDetails.cacheReadTokens`. Run `npx @ai-sdk/codemod v6` if you encounter v5 patterns.
**Warning signs:** Import errors for `CoreMessage`, `convertToCoreMessages`, or `generateObject`.

### Pitfall 2: WebSocket Event Handlers Must Be Synchronous

**What goes wrong:** Message events are dropped because async setup occurs before attaching the `message` event handler.
**Why it happens:** @fastify/websocket documentation explicitly warns: "Websocket route handlers must attach event handlers synchronously during handler execution to avoid accidentally dropping messages."
**How to avoid:** Attach `socket.on('message', ...)` and `socket.on('close', ...)` handlers synchronously at the top of the route handler. Use Promises for async initialization but don't await them before attaching event handlers.
**Warning signs:** First message after connection is intermittently lost.

```typescript
// CORRECT: Attach handlers synchronously, then do async work
fastify.get('/ws', { websocket: true }, (socket, req) => {
  const sessionPromise = initSession(req); // start async, don't await

  socket.on('message', async (raw) => {
    const session = await sessionPromise; // await inside handler
    // process message
  });

  socket.on('close', () => { /* cleanup */ });
});
```

### Pitfall 3: Token Usage Returns NaN or Zero

**What goes wrong:** `usage.inputTokens` or `usage.outputTokens` are `NaN` or `0` after streaming.
**Why it happens:** Some providers or error conditions return incomplete usage data. The AI SDK reports what the provider sends.
**How to avoid:** Always null-coalesce usage values: `usage.inputTokens ?? 0`. Log warnings when usage is unexpectedly zero. In the Anthropic provider specifically, usage is reliable and well-reported, but guard against edge cases (timeouts, errors mid-stream).
**Warning signs:** Cost calculations show `NaN` or `$0.00` for real conversations.

### Pitfall 4: Unbounded Session Memory

**What goes wrong:** Long conversations consume increasing server memory as message arrays grow.
**Why it happens:** Keeping the full conversation history in the Session object in server memory.
**How to avoid:** Persist messages to SQLite immediately. Load only the most recent N messages for context assembly (e.g., last 50 messages). The context assembler decides what fits in the context window, not the session manager.
**Warning signs:** Node.js process memory grows linearly with conversation length. OOM after extended usage.

### Pitfall 5: Not Handling Concurrent Streams Per Session

**What goes wrong:** User sends a second message while the first is still streaming, causing garbled responses.
**Why it happens:** No guard against concurrent LLM requests on the same session.
**How to avoid:** Queue messages per session. If a stream is in progress, either reject the new message with a clear error ("Please wait for the current response to complete") or queue it. Start simple with rejection; add queuing later if needed.
**Warning signs:** Interleaved text deltas from two different responses on the same WebSocket.

### Pitfall 6: Gateway Server Competing with Key Server

**What goes wrong:** The gateway WebSocket server and the key-serving API try to bind to the same port.
**Why it happens:** Phase 1's key server already occupies port 3271. Phase 2 adds a WebSocket endpoint.
**How to avoid:** Two options: (A) Combine into one Fastify instance -- the key-server routes and WebSocket route coexist on the same server. This is the simpler approach. (B) Run them on separate ports. Option A is recommended because Fastify's plugin scoping keeps them isolated while sharing the port.
**Warning signs:** EADDRINUSE errors on gateway startup.

## Code Examples

### Complete WebSocket Route Handler

```typescript
// Source: @fastify/websocket README + AI SDK 6 docs
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { z } from 'zod';

const server = Fastify({ logger: true });
await server.register(websocket, {
  options: { maxPayload: 1048576 }, // 1MB max message
});

// WebSocket gateway endpoint
server.register(async (scoped) => {
  scoped.get('/gateway', { websocket: true }, (socket, req) => {
    const logger = req.log;
    logger.info('Client connected');

    // Synchronously attach handlers (critical -- see Pitfall 2)
    socket.on('message', async (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const parsed = ClientMessageSchema.safeParse(data);

        if (!parsed.success) {
          socket.send(JSON.stringify({
            type: 'error',
            code: 'INVALID_MESSAGE',
            message: parsed.error.message,
          }));
          return;
        }

        const msg = parsed.data;
        switch (msg.type) {
          case 'chat.send':
            await handleChatSend(socket, msg, logger);
            break;
          case 'context.inspect':
            await handleContextInspect(socket, msg);
            break;
          case 'usage.query':
            await handleUsageQuery(socket, msg);
            break;
          case 'session.list':
            await handleSessionList(socket, msg);
            break;
        }
      } catch (err) {
        logger.error(err, 'Error processing message');
        socket.send(JSON.stringify({
          type: 'error',
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        }));
      }
    });

    socket.on('close', () => {
      logger.info('Client disconnected');
      // Clean up any in-progress streams
    });

    socket.on('error', (err) => {
      logger.error(err, 'WebSocket error');
    });
  });
});
```

### Streaming Chat Handler

```typescript
// Source: AI SDK 6 streamText API + project-specific protocol
import { streamText, type ModelMessage } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

async function handleChatSend(
  socket: WebSocket,
  msg: ChatSendMessage,
  logger: Logger,
) {
  // 1. Resolve or create session
  const session = msg.sessionId
    ? sessionManager.get(msg.sessionId)
    : sessionManager.create(msg.model ?? 'claude-sonnet-4.5');

  if (!session) {
    socket.send(JSON.stringify({
      type: 'error',
      requestId: msg.id,
      code: 'SESSION_NOT_FOUND',
      message: `Session ${msg.sessionId} not found`,
    }));
    return;
  }

  // 2. Notify session creation if new
  if (!msg.sessionId) {
    socket.send(JSON.stringify({
      type: 'session.created',
      sessionId: session.id,
      sessionKey: session.sessionKey,
    }));
  }

  // 3. Add user message to history
  session.addMessage({ role: 'user', content: msg.content });

  // 4. Assemble context
  const context = assembleContext(session, msg.content, getModelPricing(session.model));

  // 5. Start streaming
  const requestId = msg.id;
  socket.send(JSON.stringify({
    type: 'chat.stream.start',
    requestId,
    sessionId: session.id,
    model: session.model,
  }));

  // 6. Get API key from vault
  const apiKey = getApiKey('anthropic');
  if (!apiKey) {
    socket.send(JSON.stringify({
      type: 'error',
      requestId,
      code: 'NO_API_KEY',
      message: 'Anthropic API key not configured. Run: agentspace keys add anthropic',
    }));
    return;
  }

  const anthropic = createAnthropic({ apiKey });

  // 7. Stream LLM response
  const result = streamText({
    model: anthropic(session.model),
    messages: context.messages,
    system: context.system,
  });

  let fullResponse = '';

  for await (const chunk of result.textStream) {
    fullResponse += chunk;
    socket.send(JSON.stringify({
      type: 'chat.stream.delta',
      requestId,
      delta: chunk,
    }));
  }

  // 8. Get usage and calculate cost
  const usage = await result.usage;
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? (inputTokens + outputTokens);
  const cost = calculateCost(session.model, inputTokens, outputTokens);

  // 9. Record usage
  usageTracker.record({
    sessionId: session.id,
    model: session.model,
    inputTokens,
    outputTokens,
    totalTokens,
    cost: cost.totalCost,
    timestamp: new Date().toISOString(),
  });

  // 10. Add assistant message to history
  session.addMessage({ role: 'assistant', content: fullResponse });

  // 11. Send completion with usage
  socket.send(JSON.stringify({
    type: 'chat.stream.end',
    requestId,
    usage: { inputTokens, outputTokens, totalTokens },
    cost,
  }));
}
```

### Session and Usage DB Schemas

```typescript
// Source: Drizzle ORM SQLite docs (orm.drizzle.team)
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Session table
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),              // nanoid
  sessionKey: text('session_key').notNull().unique(),
  agentId: text('agent_id').notNull().default('default'),
  model: text('model').notNull(),
  createdAt: text('created_at').notNull(),   // ISO 8601
  lastActiveAt: text('last_active_at').notNull(),
});

// Message history table
export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  role: text('role').notNull(),              // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
  tokenCount: integer('token_count'),        // Actual token count (from usage)
});

// Usage tracking table
export const usageRecords = sqliteTable('usage_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  cost: real('cost').notNull(),              // USD
  timestamp: text('timestamp').notNull(),
});
```

### Context Inspector

```typescript
// Source: Project-specific design for GATE-07
import { estimateTokenCount } from 'tokenx';

function inspectContext(
  session: Session,
  modelPricing: { inputPerMTok: number },
): ContextInspection {
  const sections: ContextSection[] = [];

  // System prompt
  const systemPrompt = session.systemPrompt ?? 'You are a helpful AI assistant.';
  sections.push(measureSection('system_prompt', systemPrompt, modelPricing));

  // Conversation history
  const historyContent = formatHistory(session.messages);
  sections.push(measureSection('history', historyContent, modelPricing));

  // Memory (stub -- will be populated in Phase 5)
  sections.push(measureSection('memory', '', modelPricing));

  // Skills (stub -- will be populated in Phase 6)
  sections.push(measureSection('skills', '', modelPricing));

  // Tools (stub -- will be populated in Phase 6)
  sections.push(measureSection('tools', '', modelPricing));

  const totals = sections.reduce(
    (acc, s) => ({
      byteCount: acc.byteCount + s.byteCount,
      tokenEstimate: acc.tokenEstimate + s.tokenEstimate,
      costEstimate: acc.costEstimate + s.costEstimate,
    }),
    { byteCount: 0, tokenEstimate: 0, costEstimate: 0 },
  );

  return { sections, totals };
}

function measureSection(
  name: string,
  content: string,
  pricing: { inputPerMTok: number },
): ContextSection {
  const byteCount = Buffer.byteLength(content, 'utf8');
  const tokenEstimate = content.length > 0 ? estimateTokenCount(content) : 0;
  const costEstimate = (tokenEstimate / 1_000_000) * pricing.inputPerMTok;
  return { name, content, byteCount, tokenEstimate, costEstimate };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI SDK 5.x `CoreMessage` | AI SDK 6.x `ModelMessage` | AI SDK 6.0 (2025) | Must use `ModelMessage` type and `convertToModelMessages()` (async). |
| AI SDK `generateObject` | AI SDK 6 `streamText` with `Output.object()` | AI SDK 6.0 (2025) | `generateObject` and `streamObject` are deprecated. Use `streamText` with `output` parameter. |
| `cachedInputTokens` in usage | `inputTokenDetails.cacheReadTokens` | AI SDK 6.0 (2025) | Token detail nesting changed. |
| @anthropic-ai/tokenizer for local counting | `tokenx` for estimation, API `usage` for actuals | Claude 3+ (2024) | Anthropic's own tokenizer package is inaccurate for Claude 3+. Use the API response `usage` field for billing-grade accuracy. `tokenx` for pre-send estimates. |
| Anthropic Opus 4.1 at $15/$75 MTok | Opus 4.5/4.6 at $5/$25 MTok | Opus 4.5/4.6 (2025-2026) | Significant price reduction for top-tier models. Update pricing tables. |
| Socket.IO for real-time AI chat | Raw WebSocket (ws) | Industry trend 2024-2025 | When you control both client and server, Socket.IO's overhead is unnecessary. Pure WebSocket is the standard for AI chat apps. |

**Deprecated/outdated:**
- AI SDK 5.x patterns: `CoreMessage`, `convertToCoreMessages`, `generateObject`, `streamObject` -- all deprecated in v6
- `@anthropic-ai/tokenizer`: Only accurate for pre-Claude-3 models. Not useful for current models.
- Socket.IO for controlled environments: Unnecessary abstraction when both sides are known.

## Open Questions

1. **Gateway Server Architecture: Combined vs Separate**
   - What we know: Phase 1 created a Fastify key-server on 127.0.0.1:3271. Phase 2 needs a WebSocket endpoint.
   - What's unclear: Should the WebSocket endpoint be on the same Fastify instance (same port) or a separate server (different port)? Same instance is simpler. Different port allows the gateway to be network-accessible while key-server stays localhost.
   - Recommendation: Use the same Fastify instance. Register @fastify/websocket alongside the existing key-server routes. The WS endpoint at `/gateway` coexists with `/health` and `/keys/*`. This avoids port conflicts and simplifies the architecture. If network exposure is needed later, add a reverse proxy. The key-server routes remain protected by bearer auth; the WS route can have its own auth mechanism.

2. **WebSocket Authentication**
   - What we know: The key-server uses `@fastify/bearer-auth`. WebSocket connections can pass auth tokens in the URL query string, a subprotocol header, or the first message.
   - What's unclear: What auth mechanism for WebSocket connections? Phase 2 is single-user/local, so auth may be optional initially.
   - Recommendation: For Phase 2, accept unauthenticated WebSocket connections on localhost. Add a `preValidation` hook that checks `req.ip === '127.0.0.1'`. Defer token-based WS auth to when network clients (Telegram, web dashboard) need to connect.

3. **Default Model Selection**
   - What we know: AI SDK supports multiple Anthropic models. The user may have different models available.
   - What's unclear: What should the default model be? Should it come from config?
   - Recommendation: Default to `claude-sonnet-4.5` (good balance of capability and cost). Allow override per-session via the `chat.send` message `model` field. Store the user's preferred default in `config.json` (extend the AppConfig schema). Falls back to `claude-sonnet-4.5` if not configured.

4. **Context Window Management**
   - What we know: Claude models have context windows (Sonnet 4.5: 200K default, 1M beta). Conversations can exceed the window.
   - What's unclear: When should we truncate/summarize history? How aggressively?
   - Recommendation: For Phase 2, implement a simple "last N messages" approach. Load the most recent 50 messages for context assembly. Log a warning when the estimated token count approaches 80% of the model's context window. Defer intelligent summarization/compaction to Phase 5 (Memory & Persistence).

5. **Token Estimation vs Actual Accuracy**
   - What we know: `tokenx` provides ~95-98% accuracy. AI SDK returns actual usage after streaming. Anthropic suggests ~3.5 chars/token as a heuristic.
   - What's unclear: Is tokenx's accuracy sufficient for the context inspector cost estimates?
   - Recommendation: Use tokenx for pre-send estimates in the context inspector (GATE-07). After each request, compare the estimate to the actual usage from AI SDK and log the delta. This builds confidence data. Display estimates as "~X tokens (estimated)" in the inspector to set user expectations. Use actual usage from AI SDK for the cost tracker (GATE-10).

## Sources

### Primary (HIGH confidence)
- [AI SDK 6 streamText Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) -- Function signature, parameters, usage tracking, streaming API
- [AI SDK 6 Anthropic Provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) -- Installation, provider setup, model initialization
- [AI SDK 6 Migration Guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) -- Breaking changes from v5 to v6, renamed types and functions
- [AI SDK 6 Blog Post](https://vercel.com/blog/ai-sdk-6) -- ToolLoopAgent, composable agents, v6 architecture
- [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) -- Per-model token pricing, batch pricing, tool use token overhead
- [@fastify/websocket GitHub](https://github.com/fastify/fastify-websocket) -- Route handler API, TypeScript support, configuration options, synchronous handler requirement
- [@fastify/websocket npm](https://www.npmjs.com/package/@fastify/websocket) -- Latest version, compatibility with Fastify 5

### Secondary (MEDIUM confidence)
- [tokenx GitHub](https://github.com/johannschopplich/tokenx) -- Token estimation library API, accuracy benchmarks (95-98%), language support
- [@anthropic-ai/tokenizer GitHub](https://github.com/anthropics/anthropic-tokenizer-typescript) -- Official tokenizer limitations for Claude 3+ models
- [Anthropic Token Counting API](https://platform.claude.com/docs/en/build-with-claude/token-counting) -- API-based token counting (free, rate limited)
- [Render: Real-Time AI Chat Infrastructure](https://render.com/articles/real-time-ai-chat-websockets-infrastructure) -- WebSocket + LLM streaming architecture patterns
- [Fastify WebSocket Best Practices](https://betterstack.com/community/guides/scaling-nodejs/fastify-websockets/) -- Production patterns for Fastify WebSocket applications

### Tertiary (LOW confidence)
- [Token Counting Guide (Propel)](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025) -- Cross-provider token counting comparison (needs validation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- AI SDK 6, @fastify/websocket, Drizzle all verified via official docs and npm. Versions confirmed current.
- Architecture: HIGH -- WebSocket JSON protocol, session management, and streaming patterns are well-established. Protocol design is project-specific but follows industry patterns.
- Pitfalls: HIGH -- AI SDK 6 migration issues, WS handler synchronous requirement, and token usage edge cases are all documented in official sources and GitHub issues.
- Context inspector: MEDIUM -- The assembly pattern is straightforward, but tokenx accuracy for Anthropic-specific tokenization needs validation during development. The inspector UX (what to show, how to show it) will be refined during Phase 3 (CLI).
- Cost tracking: HIGH -- Pricing data from official Anthropic docs. Calculation is simple arithmetic. Storage in SQLite is straightforward.

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days -- AI SDK and Anthropic pricing are relatively stable)
