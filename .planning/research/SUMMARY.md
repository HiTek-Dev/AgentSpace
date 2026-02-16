# Project Research Summary

**Project:** AgentSpace - Self-hosted AI Agent Gateway Platform
**Domain:** AI Agent Gateway / Multi-Provider LLM Orchestration
**Researched:** 2026-02-15
**Confidence:** MEDIUM-HIGH

## Executive Summary

AgentSpace is a self-hosted AI agent gateway platform designed to provide transparency and control over multi-provider LLM interactions. Research confirms the domain is well-established with clear patterns: successful platforms like OpenClaw, LiteLLM, and Claude Code demonstrate proven architectures for channel adapters, provider abstraction, and session management. The recommended approach is a **modular monolith** built with TypeScript/Node.js, using Fastify for the gateway server, AI SDK 6 for provider abstraction, SQLite with vector extensions for local storage, and a typed event bus for inter-module communication.

The core differentiator is **transparent context management** — showing users exactly what the agent sees and sends to the LLM, byte-by-byte. This addresses a gap in the market where OpenClaw injects skills silently, Claude Code shows tool calls but not full context assembly, and n8n hides prompt construction behind visual nodes. Combined with encrypted API key vaulting, multi-provider smart routing, and "Full Control vs Limited Control" dual-track onboarding, AgentSpace positions itself between power-user developer tools (Claude Code, Cursor) and simpler chat interfaces (ChatGPT, Perplexity).

The primary risk is **context window bloat** leading to degraded agent performance and runaway costs. Prevention requires explicit token budgeting, just-in-time context retrieval, and conversation summarization built into the core architecture from Phase 1. Secondary risks include insecure API key storage (mitigated with OS keychain integration), session state complexity (mitigated with bounded context decomposition), and WebSocket reliability over real networks (mitigated with reconnection logic and message sequencing). All critical pitfalls have established prevention patterns and must be addressed in foundational phases to avoid costly rewrites.

## Key Findings

### Recommended Stack

The research validates a **TypeScript/Node.js monorepo** with clear technology leaders in each category. Node.js 24.x LTS provides stability through April 2028, pnpm workspaces with Turborepo offers 3x faster builds than Nx for small projects, and the ecosystem has matured to the point where most choices have obvious winners.

**Core technologies:**
- **Fastify 5.x**: HTTP/WebSocket gateway server — 40K+ req/s performance, schema-based validation, mature plugin ecosystem; superior to Hono for Node.js-only deployment and to Express in every metric
- **AI SDK 6.x (Vercel)**: Multi-provider LLM abstraction — 2M+ weekly downloads, unified API for streaming/tool calling/structured output, type-safe throughout; dominates the TypeScript LLM toolkit space
- **Drizzle ORM + better-sqlite3**: Database layer — SQL-centric ORM with sync API for SQLite, zero-dependency, generates migrations; paired with sqlite-vec for embedded vector search (good for tens of thousands of embeddings)
- **Ink 6.x**: Terminal UI framework — React-based component model for rich CLI rendering, only serious option for interactive TUIs in Node.js ecosystem (blessed unmaintained since 2018)
- **@napi-rs/keyring**: Encrypted credential storage — keytar replacement with Rust-based native bindings, 100% API-compatible, no libsecret dependency for WSL2/headless support
- **Next.js 16.x + shadcn/ui**: Web dashboard (later phase) — App Router with Turbopack, copy-paste components give full ownership, Tailwind 4.x for styling
- **grammY**: Telegram bot framework (later phase) — TypeScript-first, modern successor to Telegraf, better DX and plugin ecosystem

**Critical version notes:**
- TypeScript 5.9 stable (not 6.0 beta), Node.js 24.x LTS tested with all native addons (node-pty, better-sqlite3, @napi-rs/keyring)
- AI SDK requires matching provider versions (@ai-sdk/anthropic@latest, @ai-sdk/openai@3.x)
- sqlite-vec is the successor to deprecated sqlite-vss (pure C, no FAISS dependency)

**What to avoid:** Express (slower, worse TypeScript), Prisma (heavy for embedded SQLite), keytar (archived Dec 2022), LangChain.js (heavyweight abstraction not needed), Socket.IO (unnecessary overhead when controlling both ends), blessed (unmaintained).

### Expected Features

Research reveals a clear three-tier feature hierarchy: table stakes (users expect these or the product feels broken), differentiators (competitive advantage), and anti-features (commonly requested but problematic).

**Must have (table stakes):**
- **Multi-provider LLM support** — Every gateway (LiteLLM, Portkey, Bifrost) supports 100+ providers; users will not adopt platform locked to one provider
- **Conversation persistence** — OpenClaw, Claude Code, and every chat product stores history; losing context between sessions is a dealbreaker
- **Tool/function calling** — MCP support is mandatory (100M+ monthly downloads, 3000+ servers as of Jan 2026); agents without tools are just chatbots
- **Streaming responses** — All modern LLM interfaces stream; users will not wait for complete responses
- **Basic cost tracking** — LiteLLM, Portkey, and every gateway tracks token usage; users managing API spend expect visibility
- **API key configuration** — Secure storage (encrypted at rest), per-provider config, validation on entry
- **Markdown/code rendering** — Claude Code, Cursor, ChatGPT all render markdown with syntax highlighting
- **System prompt management** — Every agent platform allows customizing agent personality and constraints

**Should have (competitive differentiators):**
- **Transparent context management** — No other consumer platform shows users every byte sent to the model; this is AgentSpace's core differentiator
- **Encrypted API key vault serving local apps** — Local-only API (127.0.0.1) that other apps can request keys from; turns AgentSpace into infrastructure
- **Smart model routing** — Task-aware routing (planning uses high-thinking models, simple Q&A uses budget models); estimated 60-87% cost savings
- **Pre-flight thinking checklists** — Before complex tasks, agent generates plan with cost estimate and required permissions; user reviews/edits before execution
- **Full Control vs Limited Control onboarding** — Two distinct paths: "control everything" (shows all config) vs "just make it work" (sensible defaults)
- **Self-debugging agents with skill authoring** — Agents detect failure patterns, propose corrective skills, test in sandbox, user approves registration
- **Terminal proxy for interactive CLI** — PTY-based terminal that agent can interact with (vim, git rebase -i, debuggers); proven by interminai project

**Defer (v2+):**
- **Triple-mode workflow builder** — Visual canvas, code editor, conversational creation with round-trip sync; extremely complex bidirectional sync, build modes independently first
- **Voice/video input** — Adds complexity (STT pipeline); not core to gateway value proposition
- **Multi-channel support** (Telegram/Discord/Slack) — OpenClaw owns this; differentiate on desktop/web UX first
- **Autonomous background agents** — AutoGPT proved this is dangerous/expensive; use scheduled tasks with approval gates instead
- **Cloud-hosted SaaS mode** — Destroys core value proposition (transparency/control); make self-hosting so easy that cloud feels unnecessary

**Anti-features (deliberately exclude):**
- **Built-in LLM hosting** — Ollama/llama.cpp already solve this; treat local models as another provider
- **Plugin marketplace** — Premature (needs trust infrastructure, review processes); support local skills directory first, marketplace is v3+
- **Real-time collaboration** — Enormous complexity (CRDTs, conflict resolution); very few users need this for self-hosted platform
- **Everything-is-an-agent abstraction** — Over-abstraction inflates costs/latency; use agents only where judgment needed, tools for deterministic functions

### Architecture Approach

The architecture should be a **modular monolith** — single process with strict internal module boundaries enforced through TypeScript barrel exports and a typed event bus. This gives OpenClaw's capabilities (which has 153 files in gateway, 353 in agents directories) without OpenClaw's sprawl. Target is 60-80 files total by keeping modules focused and avoiding premature abstraction.

**Major components:**

1. **Interface Layer (Channel Adapters)** — CLI (Ink-based TUI), Web Dashboard (Next.js + WebSocket), Telegram Bot (grammY); every interface implements same adapter protocol, normalizing inputs to `GatewayMessage` format before entering gateway core

2. **Gateway Core** — Message Router (normalize, dispatch), Session Manager (lifecycle, context windows), Event Bus (typed pub/sub for module communication), Approval Gate (human-in-the-loop with async state persistence), Workflow Engine (multi-step with resumable state)

3. **Agent Layer** — Agent Runtime (orchestrates agent loop: assemble context, call LLM, parse response, execute tools), LLM Router (unified provider interface with failover/retries), Skill Registry (plugin system with typed tool definitions), Context Assembler (builds prompt from session history + memories + system instructions + available skills)

4. **Data Layer** — Memory Store (SQLite + sqlite-vec for vector embeddings), Session Store (SQLite for conversation state), Credential Vault (AES-256 encrypted storage with OS keychain fallback), Scheduler (cron-like for heartbeat checks and periodic workflows)

**Key architectural patterns:**
- **Channel Adapter Protocol**: Every interface normalizes to `GatewayMessage`; gateway is interface-agnostic (proven by OpenClaw's multi-channel support)
- **Typed Event Bus**: Modules communicate through events, not direct imports; prevents coupling that killed OpenClaw's maintainability
- **LLM Provider Abstraction**: All providers implement unified interface; router handles model selection, failover, retries (inspired by LiteLLM but native TypeScript)
- **Skill as Typed Tool Definition**: Plugins defined as typed tool definitions with runtime registration; code-first (no JSON drift)

**Build order** (dependency chain):
1. Foundation: shared utilities, SQLite connection, Event Bus
2. Data Layer: Credential Vault (needed before API calls), Memory Store, Session Manager
3. Agent Core: LLM Router, Skill Registry, Context Assembler, Agent Runtime
4. Gateway Routing: Message Router, first channel adapter (CLI for fastest testing)
5. Advanced Features: Approval Gate, Workflow Engine, Scheduler
6. Additional Channels: Web Dashboard, Telegram Bot

### Critical Pitfalls

Research identified 13 domain-specific pitfalls with authoritative sources (Anthropic engineering guidance, Microsoft PTY warnings, Playwright memory leak issues). Top 5 critical pitfalls that cause rewrites or data loss:

1. **Context Window Bloat Kills Reliability Before You Notice** — Sending everything on every turn (24K+ chars of bootstrap like OpenClaw) causes "context rot" where model attention degrades even before token limits; instructions buried in middle get ignored, leading to hallucinations and missed instructions. **Avoid with:** Explicit token budgets per context section, just-in-time context retrieval (load tool definitions only when needed), conversation summarization, scope tool definitions to current task. **Address in Phase 1** — foundational to context assembly pipeline.

2. **API Keys Stored in Plain Text or Config Files** — OpenClaw stores keys in plain JSON; 60% of API key leaks come from public repos. Real consequence: leaked OpenAI key can cost thousands in minutes. **Avoid with:** OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) for local apps, AES-256 encryption at rest as fallback, never log keys, implement key rotation support. **Address in Phase 1** — exponentially harder to retrofit.

3. **Session State Becomes Unmaintainable Monster** — Session management grows into 846-line god object managing conversation, tool states, approval queues, provider preferences, memory refs, active tasks, UI state; every change has blast radius. **Avoid with:** Decompose into bounded contexts (conversation state, provider state, tool state separate), event-driven updates instead of shared mutation, keep core session lean (ID, timestamps, refs only), define schema with versioning. **Address in Phase 1** — highest-leverage architectural decision for maintainability.

4. **Multi-Provider Failover That Makes Things Worse** — Naive failover creates retry storms during outages (hammering failing endpoints), burns tokens on redundant requests, adds latency as each provider times out sequentially; silent fallback to weaker model produces subtly wrong results harder to catch than outright failure. **Avoid with:** Three-layer resilience (retries with exponential backoff, fallbacks with capability matching, circuit breakers to remove unhealthy providers), normalize errors before routing, match fallback models by capability, log all failover events. **Address in Phase 2** — build into provider abstraction layer.

5. **Plugin/Skill System That Is Either Too Rigid or Too Fragile** — Two failure modes: too rigid (plugins can only do what core anticipated) or too fragile (plugins reach into internals, break each other, crash host). **Avoid with:** Start with 3 concrete plugins before designing system (let API emerge from real usage), minimal interface (register/initialize/execute/cleanup), sandbox API not core internals access, validate manifests at load time, version API explicitly, error boundaries per plugin. **Address in Phase 3** — build 3-5 built-in skills first as if they were plugins, then extract interface.

**Additional critical pitfalls:**
- **WebSocket Gateway Cannot Survive Real Networks** — Connections drop constantly (mobile, laptop sleep, ISP hiccups); treating disconnection as exceptional loses messages/corrupts state. Needs reconnection with exponential backoff, session ID survives reconnect, message sequencing/replay, heartbeat/ping-pong. **Address in Phase 1** — transport layer is foundation.
- **SQLite Vector Search Hits Wall** — Performance degrades non-linearly; at 1M vectors with 3072 dimensions, queries take 8.5+ seconds. Use only for local/per-user memory (<10K documents), quantize vectors (int8), monitor query latency. **Address in Phase 2-3** — architect abstraction layer so storage backend can change.
- **Approval UX Makes Users Hate Agent** — Too many approvals (every action) turns 30-second task into 5 minutes; too few approvals (destructive actions auto-approve) destroys trust. Needs tiered approval (risk levels), user-configurable thresholds, batch approvals, action previews. **Address in Phase 2** — part of agent execution loop.

## Implications for Roadmap

Based on dependency analysis, pitfall prevention requirements, and feature complexity, research suggests **5-6 phases** with clear architectural boundaries.

### Phase 1: Foundation & Core Gateway
**Rationale:** Must establish foundational architecture (event bus, session boundaries, credential vault) before any features build on top. Context management and WebSocket reliability are critical-path pitfalls that cause rewrites if gotten wrong. This phase validates the modular monolith architecture and core hypothesis (users want transparency).

**Delivers:** Working gateway server with single provider, basic chat interface (CLI), transparent context inspector, encrypted API key storage

**Addresses (from FEATURES.md):**
- Multi-provider LLM support (start with Anthropic, architecture for multiple)
- Encrypted API key management (OS keychain + AES-256 fallback)
- Streaming chat interface (Ink TUI)
- Transparent context inspector (THE core differentiator)
- Basic cost tracking (token counts, cost estimates)
- WebSocket/event infrastructure (for future channels)

**Avoids (from PITFALLS.md):**
- Pitfall 1: Context window bloat (explicit token budgets in Context Assembler)
- Pitfall 2: Plain-text API keys (Credential Vault with @napi-rs/keyring)
- Pitfall 3: Session state monster (bounded context decomposition)
- Pitfall 6: WebSocket reliability (reconnection logic, message sequencing)

**Uses (from STACK.md):**
- Node.js 24.x, TypeScript 5.9, pnpm + Turborepo
- Fastify 5.x, @fastify/websocket, ws
- AI SDK 6.x + @ai-sdk/anthropic
- Drizzle ORM + better-sqlite3 for Session Store
- @napi-rs/keyring for Credential Vault
- Ink 6.x for CLI

**Success criteria:** User can chat with Claude via CLI, see full context before sending, costs displayed per turn, API key stored securely, sessions persist across restarts

### Phase 2: Multi-Provider Intelligence & Memory
**Rationale:** With foundation stable, add provider abstraction (OpenAI, Ollama), long-term memory with vector search, and conversation persistence. This phase enables smart routing and cross-session memory, validating the agent intelligence layer before adding complexity.

**Delivers:** Multiple LLM providers with smart routing, conversation history with semantic search, system prompt management, improved context assembly with memory retrieval

**Addresses (from FEATURES.md):**
- Multi-provider LLM support (OpenAI, Ollama via openai-compatible)
- Conversation persistence (SQLite with vector search)
- System prompt management (per-thread and global)
- Multiple conversation threads (thread management with search)
- Smart model routing (task classifier + capability matching)

**Uses (from STACK.md):**
- AI SDK providers: @ai-sdk/openai, @ai-sdk/openai-compatible (for Ollama)
- sqlite-vec for vector embeddings
- Drizzle ORM for Memory Store schema

**Avoids (from PITFALLS.md):**
- Pitfall 4: Multi-provider failover storms (circuit breakers, exponential backoff)
- Pitfall 7: SQLite vector performance wall (explicit limits, query monitoring)
- Pitfall 13: Treating providers as interchangeable (expose provider-specific capabilities)

**Implements (from ARCHITECTURE.md):**
- LLM Router with provider abstraction
- Memory Store with vector search
- Context Assembler with just-in-time retrieval

**Success criteria:** User can switch providers mid-conversation, agent uses relevant past conversations in context, semantic search finds related threads, smart routing reduces costs measurably

### Phase 3: Tool System & MCP Integration
**Rationale:** MCP is table stakes (100M+ monthly downloads); tool calling enables real agent capabilities beyond chat. Build 3-5 built-in skills first to inform plugin API design, avoiding Pitfall 5 (premature abstraction).

**Delivers:** MCP client integration, Skill Registry with 3-5 built-in skills (web search, file operations, browser automation), typed tool definitions for agent use, basic approval gate for destructive actions

**Addresses (from FEATURES.md):**
- Tool/function calling (MCP standard)
- Basic approval system (tiered by risk level)
- Skills/prompt template system (reusable agent configurations)

**Uses (from STACK.md):**
- AI SDK 6.x MCP compatibility
- Playwright for browser automation skill
- zod for skill manifest validation
- Node.js dynamic import for skill loading

**Avoids (from PITFALLS.md):**
- Pitfall 5: Plugin system too rigid/fragile (build 3 skills first, extract API)
- Pitfall 8: Approval UX that annoys users (tiered approval by risk)
- Pitfall 11: Playwright memory leaks (recycle contexts, set timeouts)

**Implements (from ARCHITECTURE.md):**
- Skill Registry with runtime registration
- Approval Gate (async with persisted state)
- Agent Runtime tool execution loop

**Success criteria:** Agent can search web, read/write files, control browser; user approves only destructive actions; built-in skills work as examples for future plugins

### Phase 4: Web Dashboard & Multi-Channel
**Rationale:** With agent core stable, add web interface for monitoring/interaction and first external channel (Telegram). This validates the Channel Adapter Protocol and expands user touchpoints.

**Delivers:** Next.js web dashboard with WebSocket streaming, terminal viewer (@xterm/xterm), session management UI, Telegram bot channel adapter

**Addresses (from FEATURES.md):**
- Web dashboard (browser-based monitoring and interaction)
- Multi-channel foundation (Telegram as first external channel)
- Full Control vs Limited Control toggle (two UX paths in web UI)

**Uses (from STACK.md):**
- Next.js 16.x, React 19.x, shadcn/ui, Tailwind 4.x
- @xterm/xterm for web terminal viewer
- grammY for Telegram bot
- Recharts/Tremor for dashboard visualizations

**Implements (from ARCHITECTURE.md):**
- Channel Adapter Protocol (validate with 3 adapters: CLI, Web, Telegram)
- Web channel adapter (HTTP + WebSocket server)
- Telegram channel adapter

**Success criteria:** User can monitor agent from web dashboard in real-time, interact via web chat or Telegram, switch channels mid-conversation, UI adapts to Full Control vs Limited Control preference

### Phase 5: Advanced Features & Workflow
**Rationale:** Core platform is feature-complete; add differentiating features (pre-flight checklists, workflow engine, API key vault serving other apps). These are complex but non-blocking for daily use.

**Delivers:** Pre-flight thinking checklists, code-first workflow builder, API key vault with local API for other apps, enhanced self-debugging agent capabilities

**Addresses (from FEATURES.md):**
- Pre-flight thinking checklists (plan review before execution)
- Code-first workflow builder (multi-step automation)
- API key vault serving local apps (local-only API endpoint)
- Enhanced smart routing (with pre-flight cost estimates)

**Uses (from STACK.md):**
- Workflow Engine (new component)
- Scheduler for heartbeat/cron tasks
- Local API endpoint (Fastify routes on 127.0.0.1)

**Avoids (from PITFALLS.md):**
- Pitfall 10: Workflow over-engineering (start with sequential composition)
- Pitfall 12: Cron reliability (persistent job queue for critical tasks)

**Implements (from ARCHITECTURE.md):**
- Workflow Engine with resumable state
- Scheduler for periodic tasks
- Enhanced Context Assembler with pre-flight analysis

**Success criteria:** User reviews and edits agent plan before complex tasks, workflows survive app restart, other local apps can request API keys from vault, workflow tasks run on schedule

### Phase 6: Developer Tools & Terminal Proxy
**Rationale:** Niche developer-focused features (terminal proxy, enhanced debugging) for power users. Deferred because these are high-complexity, lower-demand features that require mature core.

**Delivers:** PTY-based terminal proxy for interactive CLI tools (vim, git rebase -i, debuggers), enhanced self-debugging with sandboxed skill testing, conversational workflow creation (describe workflows in natural language)

**Addresses (from FEATURES.md):**
- Terminal proxy for interactive CLI
- Self-debugging agents with skill authoring (sandbox testing)
- Conversational workflow creation (describe workflows, agent builds them)

**Uses (from STACK.md):**
- node-pty for pseudoterminal forking
- @xterm/xterm for terminal rendering
- Sandboxed execution environment (container or restricted user)

**Avoids (from PITFALLS.md):**
- Pitfall 9: Terminal proxy security leaks (sandbox PTY, track orphaned processes)

**Implements (from ARCHITECTURE.md):**
- PTY wrapper layer with security boundaries
- Sandboxed execution for skill testing
- Enhanced Skill Registry with self-authoring

**Success criteria:** Agent can interact with vim/git/debuggers, self-authored skills tested in sandbox before registration, user describes workflow in chat and agent builds runnable workflow

### Phase Ordering Rationale

**Dependency chain justification:**
- **Phase 1 first**: Cannot build features without foundation (event bus, session boundaries, credential security, WebSocket reliability). Context bloat and API key security are critical pitfalls that cause rewrites if wrong.
- **Phase 2 second**: Multi-provider and memory enable smart routing and cross-session intelligence. Memory Store must exist before tool system (tools may reference past knowledge).
- **Phase 3 third**: Tool calling is table stakes, but requires stable LLM layer. Building 3-5 skills first (before plugin system) avoids premature abstraction.
- **Phase 4 fourth**: Web dashboard and channels validate adapter protocol but need working agent to showcase. Full Control/Limited Control UX layer spans all features.
- **Phase 5 fifth**: Workflow engine and pre-flight checklists orchestrate existing capabilities; must come after tools/memory. API vault serving other apps is infrastructure play, non-blocking for core UX.
- **Phase 6 last**: Terminal proxy and self-debugging are complex, niche features for power users. Validate core product-market fit first.

**Architecture-driven groupings:**
- Phase 1 establishes all 4 layers (Interface, Gateway Core, Agent, Data)
- Phase 2 expands Agent and Data layers (intelligence)
- Phase 3 expands Agent layer (capabilities via tools)
- Phase 4 expands Interface layer (channels)
- Phase 5 expands Gateway Core (orchestration)
- Phase 6 adds specialized Agent capabilities (developer tools)

**Pitfall avoidance:**
- Critical pitfalls (1-6) addressed in Phases 1-2 (foundation)
- Moderate pitfalls (7-11) addressed when relevant features built (Phases 2-4)
- Minor pitfalls (12-13) noted as implementation details in later phases

### Research Flags

**Phases likely needing `/gsd:research-phase` during planning:**

- **Phase 3 (Tool System):** MCP protocol specifics need deeper research — spec is evolving, need to validate current best practices for MCP client implementation, tool definition formats, and error handling patterns
- **Phase 5 (Workflow Engine):** Workflow state persistence and resumption patterns need research — validate approaches for DAG execution, compensation patterns, and state recovery after crashes
- **Phase 6 (Terminal Proxy):** PTY sandboxing strategies need research — validate container vs restricted user approaches, escape sequence sanitization techniques, and cross-platform PTY security on macOS/Linux/Windows

**Phases with standard patterns (skip research-phase):**

- **Phase 1 (Foundation):** Well-documented patterns for Fastify, SQLite, WebSocket reconnection; stack research already complete
- **Phase 2 (Multi-Provider):** LLM provider integration is well-documented in AI SDK docs; circuit breaker patterns are standard
- **Phase 4 (Web Dashboard):** Next.js + shadcn/ui is extremely well-documented; Telegram bot via grammY has comprehensive guides

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Core technologies (Fastify, AI SDK, Drizzle, Ink) have authoritative docs, proven track records, and active maintenance. Version compatibility verified via official release notes. Only medium confidence on @napi-rs/keyring (smaller community) and Next.js 16 dashboard details (later phase, exact component needs may shift). |
| Features | **MEDIUM** | Table stakes features well-documented via competitor analysis (OpenClaw, LiteLLM, Claude Code all public). Differentiators are novel with limited prior art (transparent context management, API vault serving local apps, triple-mode workflow) — these are hypotheses to validate. MCP adoption data from official sources (100M+ downloads) confirms tool calling as mandatory. |
| Architecture | **MEDIUM-HIGH** | Modular monolith pattern well-established in Node.js ecosystem. Channel Adapter Protocol proven by OpenClaw (16+ channels). Typed event bus is standard practice. LLM Router abstraction inspired by LiteLLM with clear patterns. Medium confidence on workflow engine design (defer complexity until Phase 5 when needs are clearer). Build order dependency chain is sound based on component relationships. |
| Pitfalls | **HIGH** | Multiple authoritative sources per critical pitfall: Anthropic engineering blog on context management, Microsoft warnings on node-pty security, Playwright GitHub issues on memory leaks, Portkey/LiteLLM production patterns on failover. 60% of pitfalls have primary sources (official docs, maintainer guidance). Prevention strategies validated by production deployments. |

**Overall confidence: MEDIUM-HIGH**

Research is comprehensive for core platform (Phases 1-3). Later phases (4-6) have medium confidence because exact feature needs and UX patterns will emerge from early user feedback. Architecture is sound but will need refinement as complexity grows (expected and acceptable).

### Gaps to Address

**Gaps requiring validation during planning/implementation:**

- **MCP Protocol Specifics (Phase 3):** Current research covers MCP existence and adoption, but not detailed protocol implementation. Need to research: authentication patterns for MCP servers, error handling and recovery, tool definition schemas, versioning strategy. **Validation approach:** Deep-dive research in Phase 3 planning using official MCP spec and reference implementations.

- **Full Control vs Limited Control UX Patterns (Phase 1/4):** Research identifies this as a differentiator but does not specify exact UI/UX implementation. Need to validate: what settings are "Full Control" vs "Limited Control", how users discover and switch modes, what defaults make sense for each. **Validation approach:** Design research in Phase 1 (CLI) and Phase 4 (Web UI), potentially user interviews or competitive UX analysis.

- **Smart Model Routing Heuristics (Phase 2):** Research cites 60-87% cost savings but does not provide task classification algorithms. Need to validate: how to classify task complexity, which model capabilities map to which tasks, how users override routing decisions. **Validation approach:** Implement simple heuristics first (e.g., code tasks → code models, long context → extended context models), refine based on usage data.

- **Plugin API Surface (Phase 3):** Research recommends building 3 skills first, but does not define exact plugin interface. Need to validate: what methods/hooks plugins need, what sandbox API looks like, versioning strategy. **Validation approach:** Build 3-5 built-in skills treating them as external plugins, extract common interface from working code.

- **Workflow DSL/Format (Phase 5):** Research warns against over-engineering but does not specify workflow definition format. Need to validate: YAML vs JSON vs TypeScript, DAG structure vs sequential steps, how users author workflows. **Validation approach:** Start with simple TypeScript function composition, add abstraction only when real use cases demand it.

- **SQLite Vector Performance Thresholds (Phase 2-3):** Research cites 1M vectors as problematic but does not specify exact thresholds for AgentSpace use case. Need to validate: at what vector count does query latency become unacceptable, optimal vector dimensions (1536 vs 3072), quantization trade-offs. **Validation approach:** Performance testing with realistic datasets, monitoring in production.

## Sources

### Primary (HIGH confidence)

**Stack research:**
- [AI SDK Documentation](https://ai-sdk.dev/docs/introduction) — AI SDK architecture, provider model, v6 features
- [Drizzle ORM SQLite Docs](https://orm.drizzle.team/docs/get-started-sqlite) — better-sqlite3 integration, sync API
- [Ink GitHub](https://github.com/vadimdemedes/ink) — React terminal renderer, v6.7.0
- [Node.js 24 LTS Release](https://nodejs.org/en/blog/release/v24.13.1) — Current Active LTS support timeline
- [Playwright Documentation](https://playwright.dev/docs/release-notes) — v1.58.x features
- [sqlite-vec GitHub](https://github.com/asg017/sqlite-vec) — Pure C vector search, SIMD acceleration

**Feature research:**
- [OpenClaw GitHub](https://github.com/openclaw/openclaw) — Feature list, channel support, skills system
- [LiteLLM Proxy Documentation](https://docs.litellm.ai/docs/proxy/security_encryption_faq) — Key management patterns
- [Claude Code Overview](https://code.claude.com/docs/en/overview) — Claude Code features and architecture

**Architecture research:**
- [OpenClaw Gateway Architecture](https://docs.openclaw.ai/concepts/architecture) — Channel adapter pattern, WebSocket protocol design
- [LiteLLM AI Gateway](https://docs.litellm.ai/docs/simple_proxy) — Multi-provider routing, failover strategies
- [Azure AI Agent Orchestration Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) — Workflow and approval gate patterns

**Pitfalls research:**
- [Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — Context management best practices
- [microsoft/node-pty GitHub](https://github.com/microsoft/node-pty) — PTY limitations and security warnings
- [Playwright Issue #6319](https://github.com/microsoft/playwright/issues/6319) — Memory leak documentation
- [sqlite-vec stable release blog](https://alexgarcia.xyz/blog/2024/sqlite-vec-stable-release/index.html) — Performance benchmarks

### Secondary (MEDIUM confidence)

**Stack research:**
- [Fastify vs Hono Comparison](https://betterstack.com/community/guides/scaling-nodejs/hono-vs-fastify/) — Performance benchmarks
- [@napi-rs/keyring GitHub](https://github.com/Brooooooklyn/keyring-node) — keytar replacement, Rust bindings
- [Turborepo 2.7 Blog](https://turborepo.dev/blog/turbo-2-7) — Devtools, composable config
- [Nx vs Turborepo Comparison](https://www.wisp.blog/blog/nx-vs-turborepo-a-comprehensive-guide-to-monorepo-tools) — Monorepo tool selection

**Feature research:**
- [5 Best AI Gateways in 2026](https://www.getmaxim.ai/articles/5-best-ai-gateways-in-2026/) — Gateway feature landscape
- [OpenClaw Architecture, Explained](https://ppaolo.substack.com/p/openclaw-system-architecture-overview) — Component architecture
- [interminai GitHub](https://github.com/mstsirkin/interminai) — Terminal proxy prior art
- [Command Proxy MCP Server](https://skywork.ai/skypage/en/command-proxy-mcp-server-ai-engineers/1979084403256893440) — CLI bridge for AI agents

**Architecture research:**
- [GoCodeo: Modular vs Monolithic AI Agent Frameworks](https://www.gocodeo.com/post/decoding-architecture-patterns-in-ai-agent-frameworks-modular-vs-monolithic) — Architecture pattern trade-offs
- [Composio MCP Gateways Guide](https://composio.dev/blog/mcp-gateways-guide) — Gateway-as-reverse-proxy pattern
- [WebSocket Gateway Reference Architecture](https://www.dasmeta.com/docs/solutions/websocket-gateway-reference-architecture/index) — WebSocket session management

**Pitfalls research:**
- [Portkey: Retries, Fallbacks, and Circuit Breakers](https://portkey.ai/blog/retries-fallbacks-and-circuit-breakers-in-llm-apps/) — Production failover patterns
- [GitGuardian: API Key Management Best Practices](https://blog.gitguardian.com/secrets-api-management/) — Secrets security
- [WebScraping.AI: Playwright Memory Management](https://webscraping.ai/faq/playwright/what-are-the-memory-management-best-practices-when-running-long-playwright-sessions) — Practical guidance
- [OneUptime: WebSocket Reconnection Logic](https://oneuptime.com/blog/post/2026-01-24-websocket-reconnection-logic/view) — Reconnection patterns

### Tertiary (LOW confidence)

- [AI Model Router Saves 87% on API Costs](https://www.techedubyte.com/ai-model-router-saves-api-costs/) — Cost optimization data (unverified claim)
- [Medium: AI Gateway as Enterprise Pattern](https://medium.com/vedcraft/agentic-ai-gateway-the-proven-architecture-pattern-for-enterprise-genai-security-and-governance-3abe0ca8af6a) — Enterprise patterns (may not apply at self-hosted scale)

---
*Research completed: 2026-02-15*
*Ready for roadmap: yes*
