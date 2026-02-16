# Architecture Research: AgentSpace Gateway

**Domain:** AI Agent Gateway Platform
**Researched:** 2026-02-15
**Confidence:** MEDIUM-HIGH

## Design Philosophy: Modular Monolith

AgentSpace should use a **modular monolith** architecture -- a single process with strict internal module boundaries. This gives us OpenClaw's capabilities without OpenClaw's sprawl (153 files in gateway, 353 in agents).

**Why not microservices:** Single-user/small-team product running on macOS. Network overhead between services is waste. Service discovery, container orchestration, and distributed tracing are enterprise problems we do not have.

**Why not a flat monolith:** OpenClaw's 500+ files across gateway and agents directories demonstrate what happens when a monolith grows without internal boundaries. Modules become coupled, changes cascade unpredictably.

**Modular monolith means:** One process, one deployment, but strict module boundaries enforced through TypeScript barrel exports. Each module has a public API surface; internals are private. Modules communicate through a typed event bus, not direct imports of each other's internals.

**Confidence:** MEDIUM-HIGH. This pattern is well-established in the Node.js/TypeScript ecosystem. The modular-vs-monolithic tradeoff analysis from GoCodeo confirms modular design is essential for systems requiring "multiple external tools, long-context reasoning, and evolution over time" -- which describes AgentSpace exactly.

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      INTERFACE LAYER                             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐                   │
│  │   CLI    │  │ Web Dashboard│  │ Telegram │                   │
│  │  (TUI)   │  │  (HTTP+WS)   │  │   Bot    │                   │
│  └────┬─────┘  └──────┬───────┘  └────┬─────┘                   │
│       │               │               │                          │
│       └───────────────┼───────────────┘                          │
│                       │  Channel Adapter Protocol                │
├───────────────────────┼──────────────────────────────────────────┤
│                 GATEWAY CORE                                     │
│                       │                                          │
│  ┌────────────────────▼────────────────────┐                     │
│  │           Message Router                │                     │
│  │   (normalize, route, dispatch)          │                     │
│  └──┬──────────┬──────────┬───────────┬────┘                     │
│     │          │          │           │                           │
│  ┌──▼───┐  ┌──▼───┐  ┌──▼────┐  ┌───▼────┐                     │
│  │Session│  │Event │  │Approval│  │Workflow│                     │
│  │Manager│  │ Bus  │  │ Gate  │  │Engine  │                     │
│  └──┬────┘  └──┬───┘  └──┬────┘  └───┬────┘                     │
│     │          │          │           │                           │
├─────┼──────────┼──────────┼───────────┼──────────────────────────┤
│                    AGENT LAYER                                   │
│  ┌─────────────────────────────────────────┐                     │
│  │           Agent Runtime                 │                     │
│  │  ┌────────────┐  ┌──────────────────┐   │                     │
│  │  │  LLM Router│  │  Skill Registry  │   │                     │
│  │  │ (providers)│  │  (plugin system) │   │                     │
│  │  └──────┬─────┘  └────────┬─────────┘   │                     │
│  │         │                 │              │                     │
│  │  ┌──────▼─────────────────▼──────────┐  │                     │
│  │  │      Context Assembler            │  │                     │
│  │  │  (build prompt from memory+state) │  │                     │
│  │  └──────────────┬────────────────────┘  │                     │
│  └─────────────────┼───────────────────────┘                     │
│                    │                                              │
├────────────────────┼─────────────────────────────────────────────┤
│                 DATA LAYER                                       │
│  ┌─────────┐  ┌───▼─────┐  ┌──────────┐  ┌──────────────┐      │
│  │ Memory  │  │ Session │  │Credential│  │  Scheduler   │      │
│  │  Store  │  │  Store  │  │  Vault   │  │   (Cron)     │      │
│  │(SQLite+ │  │(SQLite) │  │(encrypted│  │              │      │
│  │ vec)    │  │         │  │ SQLite)  │  │              │      │
│  └─────────┘  └─────────┘  └──────────┘  └──────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Interface Layer

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| CLI (TUI) | Primary operator interface. Send commands, view agent output, manage config | Message Router via Channel Adapter |
| Web Dashboard | Browser-based monitoring and interaction. Real-time via WebSocket | Message Router via Channel Adapter |
| Telegram Bot | External messaging channel for remote interaction | Message Router via Channel Adapter |
| Channel Adapter | Normalize all interface inputs into a unified `GatewayMessage` format | Each interface on one side, Message Router on the other |

**Key design decision:** Every interface is a "channel" that implements the same adapter protocol. The gateway does not know or care whether a message came from CLI, web, or Telegram. This is how OpenClaw handles WhatsApp/Telegram/Discord/Slack -- a pattern worth copying directly.

### Gateway Core

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Message Router | Receives normalized messages, determines session context, dispatches to agent runtime or workflow engine | Channel Adapters (in), Session Manager, Agent Runtime, Workflow Engine |
| Session Manager | Creates/restores sessions, tracks conversation state, manages context windows | Message Router, Agent Runtime, Session Store |
| Event Bus | Typed publish/subscribe for intra-module communication. The nervous system of the modular monolith | All modules (loosely coupled) |
| Approval Gate | Intercepts actions that require human confirmation before execution. Sends notifications, waits for response | Workflow Engine, Event Bus, Channel Adapters (for notifications) |
| Workflow Engine | Executes multi-step workflows with decision branching. Persists workflow state for resumption | Message Router, Agent Runtime, Approval Gate, Scheduler |

### Agent Layer

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Agent Runtime | Orchestrates a single agent turn: assemble context, call LLM, parse response, execute tools, loop | Session Manager, LLM Router, Skill Registry, Context Assembler |
| LLM Router | Unified interface to multiple LLM providers (Anthropic, OpenAI, Ollama). Handles failover, retries, model selection | External LLM APIs |
| Skill Registry | Manages available tools/plugins. Agents can register new skills at runtime | Agent Runtime, Data Layer |
| Context Assembler | Builds the prompt by combining session history, relevant memories (via vector search), system instructions, and available skills | Memory Store, Session Manager, Skill Registry |

### Data Layer

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Memory Store | Long-term memory with SQLite + sqlite-vec for vector embeddings. Semantic search over past interactions | Context Assembler, Agent Runtime |
| Session Store | Persists session state, conversation history, context windows. SQLite | Session Manager |
| Credential Vault | Encrypted storage for API keys, tokens, secrets. AES-256 encryption at rest | LLM Router, Skill Registry, Channel Adapters |
| Scheduler | Cron-like task scheduler for heartbeat checks, periodic workflows, maintenance | Workflow Engine, Event Bus |

## Recommended Project Structure

```
src/
├── core/                    # Gateway core - the central nervous system
│   ├── router/              # Message routing and dispatch
│   │   ├── index.ts         # Public API (barrel export)
│   │   ├── router.ts        # Message Router implementation
│   │   └── types.ts         # GatewayMessage, RouteTarget types
│   ├── session/             # Session lifecycle management
│   │   ├── index.ts
│   │   ├── manager.ts       # Session create/restore/expire
│   │   └── context.ts       # Context window tracking
│   ├── events/              # Typed event bus
│   │   ├── index.ts
│   │   ├── bus.ts           # EventEmitter-based pub/sub
│   │   └── types.ts         # All event type definitions
│   ├── approval/            # Human-in-the-loop approval gates
│   │   ├── index.ts
│   │   ├── gate.ts          # Approval request/response lifecycle
│   │   └── policies.ts      # What requires approval
│   └── workflow/            # Multi-step workflow engine
│       ├── index.ts
│       ├── engine.ts        # Workflow execution and branching
│       ├── steps.ts         # Step definitions
│       └── state.ts         # Workflow state persistence
│
├── agent/                   # Agent runtime and intelligence
│   ├── runtime/             # Agent execution loop
│   │   ├── index.ts
│   │   ├── runtime.ts       # The core agent loop
│   │   └── turn.ts          # Single turn execution
│   ├── llm/                 # LLM provider abstraction
│   │   ├── index.ts
│   │   ├── router.ts        # Provider selection and failover
│   │   ├── providers/       # Provider implementations
│   │   │   ├── anthropic.ts
│   │   │   ├── openai.ts
│   │   │   └── ollama.ts
│   │   └── types.ts         # Unified LLM request/response types
│   ├── skills/              # Plugin/tool system
│   │   ├── index.ts
│   │   ├── registry.ts      # Skill registration and discovery
│   │   ├── loader.ts        # Dynamic skill loading
│   │   └── builtin/         # Built-in skills
│   │       ├── web-search.ts
│   │       ├── file-ops.ts
│   │       └── browser.ts
│   └── context/             # Context assembly
│       ├── index.ts
│       ├── assembler.ts     # Build prompts from multiple sources
│       └── strategies.ts    # Context window management strategies
│
├── channels/                # Interface adapters
│   ├── index.ts             # Channel adapter protocol definition
│   ├── protocol.ts          # Shared types for all channels
│   ├── cli/                 # TUI interface
│   │   ├── index.ts
│   │   └── tui.ts
│   ├── web/                 # HTTP + WebSocket server
│   │   ├── index.ts
│   │   ├── server.ts
│   │   └── ws.ts
│   └── telegram/            # Telegram bot adapter
│       ├── index.ts
│       └── bot.ts
│
├── data/                    # Data layer
│   ├── db/                  # Database management
│   │   ├── index.ts
│   │   ├── connection.ts    # SQLite connection management
│   │   └── migrations/      # Schema migrations
│   ├── memory/              # Long-term memory with vector search
│   │   ├── index.ts
│   │   ├── store.ts         # Memory CRUD + vector search
│   │   └── embeddings.ts    # Embedding generation
│   ├── credentials/         # Encrypted credential storage
│   │   ├── index.ts
│   │   └── vault.ts         # Encrypt/decrypt/store
│   └── scheduler/           # Cron/heartbeat system
│       ├── index.ts
│       └── scheduler.ts
│
├── shared/                  # Cross-cutting concerns
│   ├── config.ts            # Configuration loading
│   ├── logger.ts            # Structured logging
│   ├── errors.ts            # Error types and handling
│   └── types.ts             # Shared type definitions
│
└── main.ts                  # Entry point - wires everything together
```

**Target: ~60-80 files total.** OpenClaw has 500+. This structure covers the same capabilities with ~6x less file count by keeping modules focused and avoiding premature abstraction.

### Structure Rationale

- **`core/`:** Gateway-specific logic that would not exist in a simple CLI tool. This is the "gateway" part of "agent gateway."
- **`agent/`:** Intelligence and LLM interaction. Could theoretically run without the gateway (useful for testing).
- **`channels/`:** All interface adapters in one place. Adding a new channel means adding one folder here.
- **`data/`:** Everything that touches persistent storage. Single SQLite file strategy keeps deployment simple.
- **`shared/`:** Truly shared utilities. Keep this minimal -- if it grows past 10 files, something is wrong.

## Architectural Patterns

### Pattern 1: Channel Adapter Protocol

**What:** Every interface (CLI, web, Telegram) implements the same adapter interface. Messages are normalized into `GatewayMessage` before entering the router.
**When to use:** Always. This is the fundamental abstraction that keeps the gateway interface-agnostic.
**Trade-offs:** Slight overhead normalizing messages. Worth it for the decoupling.

```typescript
interface ChannelAdapter {
  readonly channelId: string;

  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;

  // Inbound: channel-specific format -> GatewayMessage
  onMessage(handler: (msg: GatewayMessage) => void): void;

  // Outbound: GatewayMessage -> channel-specific format
  send(sessionId: string, msg: GatewayMessage): Promise<void>;

  // Approval notifications
  requestApproval(req: ApprovalRequest): Promise<void>;
}

interface GatewayMessage {
  id: string;
  sessionId: string;
  channelId: string;
  timestamp: number;
  sender: { type: 'user' | 'agent' | 'system'; id: string };
  content: MessageContent;  // text, file, action, etc.
  metadata: Record<string, unknown>;
}
```

### Pattern 2: Typed Event Bus (Module Communication)

**What:** Modules communicate through a typed event bus instead of direct imports. This is the enforcement mechanism for module boundaries.
**When to use:** For all cross-module communication. Direct function calls only within a module.
**Trade-offs:** Slightly more indirection than direct calls. Prevents the coupling that killed OpenClaw's maintainability.

```typescript
type EventMap = {
  'session:created': { sessionId: string; channelId: string };
  'session:message': { sessionId: string; message: GatewayMessage };
  'agent:response': { sessionId: string; content: MessageContent };
  'agent:tool-call': { sessionId: string; tool: string; args: unknown };
  'approval:requested': { id: string; action: string; context: unknown };
  'approval:resolved': { id: string; approved: boolean };
  'workflow:step-complete': { workflowId: string; stepId: string };
  'scheduler:tick': { taskId: string };
};

class TypedEventBus {
  on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void;
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
  off<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void;
}
```

### Pattern 3: LLM Provider Abstraction (Unified Interface)

**What:** All LLM providers implement the same interface. The router handles model selection, failover, and retries. Inspired by LiteLLM's architecture but implemented natively in TypeScript without the Python dependency.
**When to use:** Every LLM call goes through the router. Never call a provider directly.
**Trade-offs:** Must maintain provider implementations as APIs evolve. Keep provider adapters thin -- just translate request/response formats.

```typescript
interface LLMProvider {
  readonly providerId: string;
  readonly models: string[];

  chat(request: LLMRequest): Promise<LLMResponse>;
  chatStream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;

  // Health check for failover decisions
  healthCheck(): Promise<boolean>;
}

interface LLMRouter {
  // Route to best available provider for the requested model
  chat(request: LLMRequest): Promise<LLMResponse>;
  chatStream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;

  // Provider management
  registerProvider(provider: LLMProvider): void;
  setFallbackChain(models: string[]): void;
}
```

### Pattern 4: Skill as Typed Tool Definition

**What:** Skills (plugins) are defined as typed tool definitions that agents can discover and invoke. Agents can also register new skills at runtime.
**When to use:** Every capability the agent can use beyond raw LLM inference.
**Trade-offs:** Runtime skill registration adds complexity. Mitigate with a validation step before registration.

```typescript
interface Skill {
  readonly name: string;
  readonly description: string;
  readonly parameters: JSONSchema;  // For LLM tool-use format

  // Execution
  execute(args: unknown, context: SkillContext): Promise<SkillResult>;

  // Optional: does this skill require approval?
  requiresApproval?: boolean | ((args: unknown) => boolean);
}

interface SkillRegistry {
  register(skill: Skill): void;
  unregister(name: string): void;
  list(): Skill[];
  get(name: string): Skill | undefined;

  // For LLM tool-use: generate tool definitions
  toToolDefinitions(): ToolDefinition[];
}
```

## Data Flow

### Primary Message Flow (User -> Agent -> User)

```
User types in CLI/Web/Telegram
    │
    ▼
Channel Adapter normalizes to GatewayMessage
    │
    ▼
Message Router receives message
    │
    ├── Looks up or creates Session (Session Manager)
    │
    ▼
Event Bus: emit 'session:message'
    │
    ▼
Agent Runtime picks up message
    │
    ├── Context Assembler builds prompt:
    │   ├── Session history (Session Store)
    │   ├── Relevant memories (Memory Store + vector search)
    │   ├── System instructions
    │   └── Available skills (Skill Registry -> tool definitions)
    │
    ▼
LLM Router sends to provider (Anthropic/OpenAI/Ollama)
    │
    ├── If tool call in response:
    │   ├── Check if skill requires approval
    │   │   ├── YES: Approval Gate -> notify user -> wait
    │   │   └── NO: Execute skill directly
    │   ├── Append tool result to context
    │   └── Loop back to LLM Router (agent loop)
    │
    ▼
Final response
    │
    ├── Store in Session (Session Store)
    ├── Extract and store memories (Memory Store)
    │
    ▼
Event Bus: emit 'agent:response'
    │
    ▼
Message Router -> Channel Adapter -> User sees response
```

### Workflow Execution Flow

```
Trigger (user command, scheduled task, or agent decision)
    │
    ▼
Workflow Engine loads workflow definition
    │
    ├── Execute Step 1 -> may invoke Agent Runtime
    │   ├── Decision branch? Evaluate condition -> pick branch
    │   ├── Approval needed? -> Approval Gate -> pause workflow
    │   └── Step complete -> persist state
    │
    ├── Execute Step 2 -> ...
    │
    ▼
Workflow complete -> emit 'workflow:complete'
    │
    ▼
Notify via appropriate channel
```

### Memory Write/Read Flow

```
WRITE (after each agent response):
Agent Runtime -> Memory Store
    ├── Store raw conversation turn (SQLite)
    ├── Generate embedding for content (local model or API)
    └── Store embedding vector (sqlite-vec)

READ (during context assembly):
Context Assembler -> Memory Store
    ├── Query: "find memories relevant to current message"
    ├── sqlite-vec: cosine similarity search on embeddings
    ├── Return top-K relevant memories
    └── Inject into prompt as "relevant context"
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Anthropic API | HTTP REST via provider adapter | Primary LLM. Messages API with tool use |
| OpenAI API | HTTP REST via provider adapter | Secondary LLM. Chat completions with function calling |
| Ollama | HTTP REST (localhost) via provider adapter | Local models. OpenAI-compatible API |
| Telegram Bot API | grammY library, long polling or webhooks | Channel adapter wraps grammY |
| Embedding models | HTTP REST or local (Ollama) | For memory vectorization. Can use same Ollama instance |

### Internal Boundaries (Module Communication Rules)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Channel <-> Core | Channel Adapter Protocol (typed interface) | Channels never access Core internals |
| Core <-> Agent | Event Bus events + direct runtime invocation | Router invokes Agent Runtime; responses come back via events |
| Agent <-> Data | Direct function calls within data module's public API | Agent Runtime calls Memory Store and Session Store APIs |
| Core <-> Data | Direct function calls within data module's public API | Session Manager calls Session Store APIs |
| Any module <-> Credentials | Vault public API only | No module accesses raw encrypted storage |

**Rule:** If two modules need to communicate and there is no defined boundary above, they must go through the Event Bus. This prevents ad-hoc coupling.

## Anti-Patterns to Avoid

### Anti-Pattern 1: God Router

**What people do:** Put business logic in the message router -- validation, transformation, agent invocation, response formatting all in one place.
**Why it is wrong:** The router becomes the bottleneck for every change. OpenClaw's gateway grew to 153 files partly because routing logic accumulated business rules.
**Do this instead:** Router does exactly three things: identify session, determine destination, dispatch. Everything else belongs in the destination module.

### Anti-Pattern 2: Provider Lock-in via Direct API Calls

**What people do:** Import `@anthropic-ai/sdk` directly in agent code and call it without abstraction.
**Why it is wrong:** Every agent module becomes coupled to one provider. Switching models or adding fallback requires touching every call site.
**Do this instead:** All LLM calls go through the LLM Router. Agent code never imports a provider SDK directly.

### Anti-Pattern 3: Shared Mutable Session State

**What people do:** Pass session objects by reference between modules, letting any module mutate session state.
**Why it is wrong:** Race conditions when multiple event handlers modify the same session. Impossible to track what changed the state.
**Do this instead:** Session Manager owns all session mutations. Other modules request state changes through the Session Manager API or events. Session snapshots (read-only copies) are passed to consumers.

### Anti-Pattern 4: Synchronous Approval Blocking

**What people do:** Block the entire agent loop waiting for human approval.
**Why it is wrong:** Other sessions and workflows freeze while waiting for one approval. User may not respond for hours.
**Do this instead:** Approval Gate persists the pending action, pauses the specific workflow/turn, and resumes asynchronously when approval arrives. Other work continues.

### Anti-Pattern 5: Flat File Skill Definitions

**What people do:** Store skill/plugin definitions as loose JSON files that must be manually kept in sync with implementation.
**Why it is wrong:** Definitions drift from implementation. Skills break silently.
**Do this instead:** Skills are code-first. The TypeScript `Skill` interface IS the definition. JSON schemas for LLM tool-use are generated from the typed interface, not maintained separately.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user (personal assistant) | Single process, single SQLite file, in-memory event bus. This is the primary target. |
| 5-10 users (small team) | Same architecture. SQLite handles concurrent reads well. WAL mode for write concurrency. May need session isolation per user. |
| 100+ users | Move session store to PostgreSQL. Event bus becomes Redis pub/sub. LLM Router adds request queuing. This is NOT the initial target -- do not design for it prematurely. |

### Scaling Priorities

1. **First bottleneck:** LLM API rate limits. Mitigate with provider failover and request queuing in the LLM Router. This is a provider-side constraint, not an architecture problem.
2. **Second bottleneck:** SQLite write contention under concurrent sessions. Mitigate with WAL mode (handles most cases) or eventual migration to PostgreSQL for the session store only.
3. **Third bottleneck:** Memory (vector) search latency as memories grow. Mitigate with sqlite-vec indexing and periodic memory consolidation/summarization.

## Build Order (Dependency Chain)

The architecture implies this build order, because each layer depends on the one below it:

```
Phase 1: Foundation
  shared/ (config, logger, errors, types)
  data/db/ (SQLite connection, migrations)
  core/events/ (Event Bus)

Phase 2: Data Layer
  data/credentials/ (Vault - needed before any API calls)
  data/memory/ (Memory Store with sqlite-vec)
  core/session/ (Session Manager + Session Store)

Phase 3: Agent Core
  agent/llm/ (Provider abstraction + at least Anthropic provider)
  agent/skills/ (Skill Registry + 2-3 built-in skills)
  agent/context/ (Context Assembler)
  agent/runtime/ (Agent loop - ties it all together)

Phase 4: Gateway Routing
  core/router/ (Message Router)
  channels/cli/ (First channel - fastest to test with)

Phase 5: Advanced Features
  core/approval/ (Approval Gate)
  core/workflow/ (Workflow Engine)
  data/scheduler/ (Cron/heartbeat)

Phase 6: Additional Channels
  channels/web/ (HTTP + WebSocket dashboard)
  channels/telegram/ (Telegram bot)
```

**Rationale:** You cannot test the gateway without an agent. You cannot run an agent without LLM providers. You cannot store credentials without the vault. You cannot assemble context without memory. Start from the bottom, build up.

## Key Architectural Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Process model | Single process, modular monolith | macOS-first personal tool. Microservices are overkill |
| Module communication | Typed event bus | Prevents coupling between modules. OpenClaw's main pain point |
| Database | Single SQLite file | Zero-config, embedded, portable. sqlite-vec for vectors |
| LLM integration | Custom provider abstraction | Avoids LiteLLM Python dependency. Keeps entire stack TypeScript |
| Channel system | Adapter protocol pattern | Proven by OpenClaw. Interface-agnostic gateway |
| Plugin system | Code-first typed skills | No JSON drift. TypeScript compiler catches skill definition errors |
| Approval model | Async with persisted state | Never block the main loop waiting for humans |
| Workflow state | SQLite-persisted, resumable | Workflows survive process restarts |

## Sources

- [OpenClaw Gateway Architecture](https://docs.openclaw.ai/concepts/architecture) -- PRIMARY reference for channel adapter pattern and WebSocket protocol design (HIGH confidence)
- [GoCodeo: Modular vs Monolithic AI Agent Frameworks](https://www.gocodeo.com/post/decoding-architecture-patterns-in-ai-agent-frameworks-modular-vs-monolithic) -- Architecture pattern trade-offs (MEDIUM confidence)
- [LiteLLM AI Gateway](https://docs.litellm.ai/docs/simple_proxy) -- Multi-provider routing patterns and failover strategies (HIGH confidence)
- [Azure AI Agent Orchestration Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) -- Workflow and approval gate patterns (HIGH confidence)
- [Google Cloud Agentic AI Architecture](https://docs.google.com/architecture/choose-agentic-ai-architecture-components) -- Component selection and design pattern guidance (HIGH confidence)
- [Composio MCP Gateways Guide](https://composio.dev/blog/mcp-gateways-guide) -- Gateway-as-reverse-proxy pattern for AI agents (MEDIUM confidence)
- [Medium: AI Gateway as Enterprise Pattern](https://medium.com/vedcraft/agentic-ai-gateway-the-proven-architecture-pattern-for-enterprise-genai-security-and-governance-3abe0ca8af6a) -- Enterprise gateway patterns applicable at smaller scale (LOW confidence)
- [WebSocket Gateway Reference Architecture](https://www.dasmeta.com/docs/solutions/websocket-gateway-reference-architecture/index) -- WebSocket session management best practices (MEDIUM confidence)
- [sqlite-vec for Vector Embeddings](https://medium.com/@stephenc211/how-sqlite-vec-works-for-storing-and-querying-vector-embeddings-165adeeeceea) -- SQLite vector storage implementation details (MEDIUM confidence)

---
*Architecture research for: AgentSpace AI Agent Gateway Platform*
*Researched: 2026-02-15*
