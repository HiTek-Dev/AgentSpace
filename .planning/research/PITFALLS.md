# Pitfalls Research

**Domain:** AI Agent Gateway Platform
**Researched:** 2026-02-15
**Confidence:** HIGH (multiple authoritative sources per pitfall, including Anthropic's own engineering guidance)

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or make the platform unusable for daily work.

### Pitfall 1: Context Window Bloat Kills Reliability Before You Notice

**What goes wrong:**
The agent sends everything it knows on every turn -- bootstrap instructions, full conversation history, all tool definitions, previous tool outputs. At 24K+ chars of bootstrap alone (as OpenClaw does), you hit "context rot" well before the token limit: the model's attention concentrates on the beginning and end of input, so instructions buried in the middle get ignored. The result is hallucinations, missed instructions, and the agent doing the wrong thing even though the right information is technically "in context."

**Why it happens:**
Developers treat context like a database -- "more information = better decisions." In reality, LLMs degrade with irrelevant tokens. A focused 300-token context frequently outperforms an unfocused 113K-token context. The Anthropic engineering team calls this out explicitly: "find the smallest set of high-signal tokens that maximize the likelihood of your desired outcome."

**How to avoid:**
- Separate storage from presentation: maintain durable state (memory, config, history) outside the context window and inject only what the current turn needs
- Use compaction: summarize conversation history when approaching limits, preserving decisions while discarding verbose tool outputs
- Just-in-time context retrieval: load tool definitions, file contents, and reference data only when the agent's current task requires them, not upfront
- Scope tool definitions: if the agent is writing code, it does not need browser automation tool definitions in context
- Budget tokens explicitly: set a hard ceiling for each context section (system prompt, tools, history, working memory) and enforce it programmatically

**Warning signs:**
- Agent "forgets" instructions that are present in the prompt
- Agent stops using tools it was using earlier in the conversation
- Responses become generic or contradictory in long sessions
- Token usage per turn climbs steadily without more complex tasks

**Phase to address:**
Phase 1 (Core Architecture). Context management is foundational -- every feature built on top of a bloated context pipeline inherits the problem. Design the context assembly pipeline with explicit budgets from day one.

---

### Pitfall 2: API Keys Stored in Plain Text or Config Files

**What goes wrong:**
API keys for LLM providers, tool integrations, and services stored in plain JSON files, environment variables baked into config, or worse -- committed to git. OpenClaw stores keys in plain JSON. Real-world consequences: keys get leaked through logs, backups, screenshots, or repository exposure. A single leaked OpenAI key can rack up thousands of dollars in minutes from automated abuse. 60% of API key leaks come from publicly accessible repositories.

**Why it happens:**
It is the fastest path to "working." Environment variables feel secure enough during development. Developers conflate "not in source code" with "secure." The gap between `.env` files and proper secrets management feels like premature optimization -- until it is not.

**How to avoid:**
- Use the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) for local/desktop apps. This is the correct approach for a local agent platform
- Encrypt at rest: if you must store keys in a file, encrypt with a user-derived key, never plaintext
- Never log API keys -- mask them in all logging output
- Implement key rotation support from the start: the architecture should assume keys change
- For multi-user or server deployments, use a proper secrets manager (HashiCorp Vault, cloud KMS)
- Separate key storage from key usage: the component that reads the key should not be the same component that stores it

**Warning signs:**
- Keys visible in `grep -r "sk-" .` across the codebase
- Config files with `apiKey: "sk-..."` in any form
- Keys appear in debug logs or error messages
- No key rotation mechanism exists

**Phase to address:**
Phase 1 (Core Architecture). Secrets management is a foundation that gets exponentially harder to retrofit. Build the keychain integration before adding any provider integrations.

---

### Pitfall 3: Session State Becomes an Unmaintainable Monster

**What goes wrong:**
Session management grows from "track the conversation" to an 846-line utility file managing conversation history, tool states, approval queues, provider preferences, memory references, active tasks, and UI state -- all entangled. When anything changes (new feature, bug fix, provider update), the session object is the blast radius. Testing becomes impossible because you cannot instantiate a session without the entire system.

**Why it happens:**
Sessions are the natural "god object" in agent platforms. Every feature needs to read or write session state, so developers add fields incrementally. There is no natural boundary that says "this does not belong in the session."

**How to avoid:**
- Decompose session into bounded contexts: conversation state, provider state, tool state, and UI state are separate objects with separate lifecycles
- Use event-driven updates: components publish state changes rather than mutating a shared session object
- Define a session schema with versioning from day one -- migrations are inevitable
- Keep the core session lean: ID, timestamps, conversation thread reference, user reference. Everything else lives in associated stores
- Session serialization should be explicit (what gets persisted vs. what is transient runtime state)

**Warning signs:**
- Session utility file exceeds 200 lines
- Adding a feature requires modifying the session schema
- Tests require complex session setup/mocking
- "Session" appears in more than 5 import statements across the codebase

**Phase to address:**
Phase 1 (Core Architecture). Define the session boundary before building features that depend on it. This is the single highest-leverage architectural decision for long-term maintainability.

---

### Pitfall 4: Multi-Provider Failover That Makes Things Worse

**What goes wrong:**
Naive failover (try provider A, on error try provider B) creates "retry storms" during outages -- the system hammers failing endpoints, burns tokens on redundant requests, and adds latency as each provider times out sequentially. Cooldown/rotation schemes (like OpenClaw's) add complexity without solving the fundamental problem: different providers have different error formats, rate limit rules, and response structures. A fallback to a weaker model may produce subtly wrong results that are harder to catch than an outright failure.

**Why it happens:**
Failover feels simple: "if A fails, try B." But LLM providers are not interchangeable backends. They have different capabilities, different tool calling formats, different context limits, and different failure modes. A 429 from OpenAI means something different than a 429 from Anthropic.

**How to avoid:**
- Implement a three-layer resilience stack: retries (for transient glitches, with exponential backoff), fallbacks (for provider-level failures, with model capability matching), and circuit breakers (to proactively remove unhealthy providers from the pool)
- Normalize provider errors into a unified error taxonomy before routing decisions
- Match fallback models by capability: do not fall back from Claude Opus to GPT-3.5 for a complex coding task
- Set per-provider timeout budgets, not just retry counts
- Log all failover events with the original error -- silent failover hides problems
- Consider "delayed parallel retries": send to primary, if no response within N seconds, send to secondary in parallel, use whichever returns first

**Warning signs:**
- API costs spike during provider outages (retry storms)
- Users report quality degradation without clear cause (silent fallback to weaker model)
- Error logs show the same request attempted 5+ times
- Failover code has provider-specific conditionals scattered throughout

**Phase to address:**
Phase 2 (Provider Integration). Build the provider abstraction layer with circuit breakers from the start. Do not bolt reliability onto a working-but-fragile provider integration.

---

### Pitfall 5: Plugin/Skill System That Is Either Too Rigid or Too Fragile

**What goes wrong:**
Two failure modes: (1) Too rigid -- plugins can only do what the core anticipated, making the system barely more extensible than hardcoding. (2) Too fragile -- plugins can reach into core internals, break each other, or crash the host process. Both end in the same place: developers stop writing plugins because the system fights them.

**Why it happens:**
Plugin architecture requires upfront design investment that feels premature when you have zero plugins. Developers either skip it entirely (hardcode everything) or over-design it (complex lifecycle hooks, dependency injection, event buses) before understanding what plugins actually need.

**How to avoid:**
- Start with 3 concrete plugins before designing the plugin system. Let the API emerge from real usage, not speculation
- Define a minimal plugin interface: register, initialize, execute, cleanup. Nothing more until proven necessary
- Plugins get a sandbox API, not access to core internals. The sandbox defines what plugins can do (register tools, add routes, store data) and implicitly what they cannot
- Validate plugin manifests at load time, not at runtime -- fail fast with clear errors
- Version the plugin API explicitly. Breaking changes get a new major version
- Each plugin runs in its own error boundary -- one plugin crashing must never take down the host

**Warning signs:**
- Plugin API surface area exceeds 10 methods before you have 5 plugins
- Plugins import from core internal modules (not the public plugin API)
- A plugin bug crashes the entire application
- Plugin documentation requires understanding core architecture

**Phase to address:**
Phase 3 (Extensibility). Build 3-5 built-in skills first as if they were plugins. Extract the plugin interface from working code, not from a design document.

---

### Pitfall 6: WebSocket Gateway That Cannot Survive Real Networks

**What goes wrong:**
WebSocket connections drop constantly in production -- mobile networks, laptop sleep/wake, ISP hiccups, load balancer timeouts. A gateway that treats disconnection as exceptional rather than normal will lose messages, corrupt state, and leave users staring at a spinner. Users lose their in-progress agent task because the connection dropped for 2 seconds.

**Why it happens:**
WebSockets work perfectly on localhost. Developers build the happy path, ship it, and discover the unhappy path in production when every user hits it daily.

**How to avoid:**
- Implement reconnection with exponential backoff as a first-class feature, not an afterthought
- Assign each connection a session ID that survives reconnection. On reconnect, the client sends its session ID and last-received message sequence number
- Server-side: buffer recent messages (last N or last T seconds) per session for replay on reconnect
- Implement heartbeat/ping-pong to detect dead connections before the OS TCP timeout (which can be minutes)
- Client-side: queue outgoing messages during disconnection, replay on reconnect
- Never tie application state to connection state. The session exists independently of the WebSocket

**Warning signs:**
- Users report "lost" conversations or agent actions
- Reconnection produces duplicate messages or out-of-order state
- Application hangs after laptop sleep/wake
- No heartbeat mechanism exists

**Phase to address:**
Phase 1 (Core Architecture). The WebSocket layer is the transport for everything else. Getting this wrong means every feature built on top is unreliable.

---

## Moderate Pitfalls

### Pitfall 7: SQLite Vector Search That Hits a Wall

**What goes wrong:**
SQLite with vector extensions (sqlite-vec) works beautifully for small datasets but performance degrades non-linearly. At 1M vectors with 3072 dimensions, queries take 8.5+ seconds. Index building for moderate datasets (200K vectors) can take 45+ minutes. The system feels fast in development with 100 test documents and becomes unusable in production with a real knowledge base.

**Prevention:**
- Use SQLite vectors only for local/per-user memory (typically under 10K documents per user -- well within the performance envelope)
- Set explicit limits: max documents per collection, max vector dimensions. 1536 dimensions is sufficient for most embeddings; 3072 is rarely worth the cost
- Monitor query latency as a system metric with alerts
- Design the storage layer with a migration path to a dedicated vector DB (pgvector, Qdrant) if scale demands it, but do not start there
- Consider quantization (int8 instead of float32) to improve performance at minimal quality loss

**Warning signs:**
- Embedding search takes >200ms for a single query
- Database file exceeds 500MB
- Index rebuild takes more than a few seconds

**Phase to address:**
Phase 2 or 3 (Memory/Embeddings). Start with SQLite for simplicity, but architect the abstraction layer so the storage backend can change without touching the rest of the system.

---

### Pitfall 8: Approval UX That Makes Users Hate the Agent

**What goes wrong:**
Two failure modes: (1) Too many approvals -- the agent asks permission for every action, turning a 30-second task into 5 minutes of clicking "Approve." Users disable approvals entirely, defeating the purpose. (2) Too few approvals -- the agent does something destructive without asking, destroying trust permanently.

**Prevention:**
- Implement tiered approval: categorize actions by risk level (read-only = auto-approve, write = notify, destructive = require approval)
- Let users set their own approval thresholds per tool/action type. Power users want fewer interruptions; cautious users want more
- Use confidence-based escalation: the agent operates autonomously for high-confidence decisions and escalates when uncertain
- Show what will happen before asking for approval (preview the action, not just "Agent wants to run a command")
- Batch approvals when possible: "Agent wants to create 3 files and run 1 command" not 4 separate approval dialogs
- Remember approval patterns: if a user always approves file creation, suggest auto-approving that category

**Warning signs:**
- Users report the agent is "annoying" or "too slow"
- Users disable all approvals (signal the granularity is wrong)
- Users report surprise at agent actions (approvals too permissive)

**Phase to address:**
Phase 2 (Agent Loop). The approval system is part of the agent execution loop, not a UI overlay. Design it into the action execution pipeline.

---

### Pitfall 9: Terminal Proxy Security and Resource Leaks

**What goes wrong:**
node-pty spawns processes at the same permission level as the parent. In a web-accessible agent platform, this means the agent (and potentially a prompt injection) has full access to the user's filesystem, credentials, and running processes. Memory leaks from undisposed xterm.js terminals and orphaned PTY processes accumulate in long-running sessions. node-pty is not thread-safe, causing corruption in concurrent scenarios.

**Prevention:**
- Run PTY processes in a sandboxed environment (container, restricted user, seccomp profile) even for local use
- Implement explicit session lifecycle: create PTY on demand, destroy on session end, with hard timeouts for idle sessions
- Track all spawned processes and clean up on disconnect -- orphaned shell processes are invisible resource drains
- Limit concurrent PTY sessions per user
- Never expose raw PTY output to the frontend without sanitization (terminal escape sequence injection is a real attack vector)
- Dispose xterm.js Terminal instances properly: remove DOM listeners, clear buffers, call dispose() in the correct order

**Warning signs:**
- Memory usage grows steadily with uptime
- `ps aux` shows orphaned shell processes after sessions end
- Terminal sessions survive page reloads when they should not

**Phase to address:**
Phase 3 or 4 (Terminal Integration). This is not a Phase 1 feature. Get the core agent loop working first, then add terminal access with proper sandboxing.

---

### Pitfall 10: Workflow Engine Over-Engineering

**What goes wrong:**
Developers build a generic workflow engine (with DAGs, conditional branching, parallel execution, compensation, retry policies) before they have a single workflow that needs it. The engine becomes the most complex part of the system, requiring its own debugging tools, its own state management, and its own mental model. Simple tasks ("search the web, summarize results, save to file") get routed through a workflow engine designed for enterprise BPM.

**Prevention:**
- Start with sequential function composition. Agent does step 1, then step 2, then step 3. No engine needed
- Add complexity only when a real use case demands it: branching when you have a workflow that actually branches, parallelism when you have independent steps that are slow
- If you find yourself building a visual workflow editor in Phase 1, stop. You are building a workflow platform, not an agent platform
- Use the agent's own reasoning for orchestration instead of a separate workflow engine. The LLM can decide "do A then B" without a DAG runtime

**Warning signs:**
- Workflow engine has more code than the agent loop
- You are designing a DSL for workflow definitions
- Simple "do X then Y" tasks go through 5+ layers of abstraction

**Phase to address:**
Phase 3+ (Advanced Features). Only after you have 5+ real workflows running as simple sequential tasks and you can articulate exactly what the engine would add.

---

### Pitfall 11: Playwright Browser Automation Memory and Reliability

**What goes wrong:**
Playwright in a long-running server process leaks memory aggressively. Refreshing a page every second consumes 400MB in 20 minutes. HTTP response accumulation can leak 1GB+ per hour. Browser contexts that are not properly closed become orphaned Chromium processes consuming CPU and RAM. In agent scenarios where the browser stays open across multiple tasks, these leaks compound.

**Prevention:**
- Recycle browser contexts after a set number of page navigations or a time limit (e.g., new context every 50 pages or every 10 minutes)
- Always close pages, contexts, and browsers in finally blocks -- never rely on garbage collection
- Implement memory monitoring with heap usage thresholds; auto-restart the browser process when thresholds are exceeded
- Do not keep browser instances alive between agent tasks. Launch on demand, close on completion
- Disable unnecessary resource loading (images, fonts, media) when the agent only needs text content
- Set explicit navigation timeouts -- a hung page load can block the agent indefinitely

**Warning signs:**
- Node.js process memory exceeds 1GB during browser tasks
- Orphaned `chromium` processes in process list
- Browser tasks that worked for 5 minutes start failing after 30 minutes
- "JavaScript heap out of memory" errors

**Phase to address:**
Phase 3 or 4 (Browser Integration). Like terminal proxy, this is not a Phase 1 feature. Get the core right first.

---

## Minor Pitfalls

### Pitfall 12: Cron/Heartbeat in Single-Process Node.js

**What goes wrong:**
node-cron runs in-process. If the app crashes or restarts, scheduled jobs are lost silently. In distributed/multi-instance deployments, every instance runs the same cron job, causing duplicate execution. There is no built-in monitoring for missed or failed jobs.

**Prevention:**
- For critical scheduled tasks, use a persistent job queue (BullMQ + Redis) instead of in-process cron
- For simple heartbeat/keepalive, in-process timers are fine but implement task stacking prevention (skip if previous execution is still running)
- Log every scheduled execution with success/failure status
- Implement idempotent job handlers -- if a job runs twice, the result should be the same

**Phase to address:**
Phase 3+ (Background Tasks). Simple setInterval heartbeats are fine for Phase 1. Persistent job scheduling comes later when you have tasks that must not be missed.

---

### Pitfall 13: Treating All LLM Providers as Interchangeable

**What goes wrong:**
Building a provider abstraction that normalizes away meaningful differences between providers. Claude and GPT handle tool calling differently, have different strengths for different tasks, support different features (extended thinking, computer use, function calling schemas). A lowest-common-denominator abstraction loses the features that make each provider valuable.

**Prevention:**
- Normalize the common surface (chat completion, streaming, basic tool calling) but expose provider-specific capabilities through extension points
- Test with every provider you claim to support -- "should work" is not tested
- Document which features are provider-specific and which are universal
- Do not assume tool calling formats are identical: parameter schemas, response formats, and error handling all differ

**Phase to address:**
Phase 2 (Provider Integration). The abstraction layer must be designed with provider differences in mind, not papered over.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing full conversation history in memory | Simple implementation | Memory grows unbounded, context rot degrades quality | Never in production; use summarization + persistence |
| Plain-text API keys in .env | Fast to prototype | Security breach vector, no rotation support | Development only, never production |
| Single provider, no abstraction | Ship faster | Locked to one provider, no failover, painful to add second | MVP only if you accept a rewrite for provider #2 |
| Monolithic session object | Everything accessible from anywhere | Untestable, every change is a blast radius | Never; decompose from day one |
| In-process cron for critical tasks | No Redis dependency | Silent job loss on crash, duplicates in multi-instance | Only for non-critical heartbeats |
| Synchronous tool execution | Simple control flow | Agent blocks on slow tools, poor UX | Only for tools that complete in <1 second |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenAI API | Treating 429 rate limits as errors requiring failover | Respect Retry-After header, use token bucket rate limiting, only failover on 5xx |
| Anthropic API | Ignoring streaming event types (content_block_delta vs content_block_stop) | Handle every event type explicitly; unhandled events are bugs |
| Playwright | Keeping browser alive across tasks | Launch on demand, recycle contexts, close on completion |
| node-pty | Spawning PTY with host user permissions | Containerize or use restricted user for PTY processes |
| SQLite (WAL mode) | Multiple writers assuming concurrent write safety | SQLite allows only one writer at a time; queue writes or use a write lock |
| WebSocket libraries | Assuming connection = authenticated | Re-authenticate on every reconnection; connections can be hijacked |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full conversation history in every LLM call | Increasing latency per turn, rising costs | Summarize history, sliding window with pinned messages | >20 turns in a conversation |
| SQLite vector search with brute force | Slow semantic search | Quantize vectors, limit collection size, consider approximate NN indexes | >50K vectors |
| Unbounded message queue on reconnect | Memory spike on reconnect, slow recovery | Cap replay buffer (last 100 messages or 60 seconds) | >1000 queued messages during outage |
| Spawning new Playwright browser per tool call | High latency, memory exhaustion | Pool and recycle browser instances | >5 concurrent browser tasks |
| Storing all tool outputs in session | Session serialization slows, memory grows | Store tool output references, not full content; summarize large outputs | Tool outputs >10KB per turn |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| API keys in config files | Key theft, billing abuse (thousands of dollars) | OS keychain for local apps, secrets manager for server deployments |
| PTY processes with host permissions | Full system access via prompt injection | Containerize PTY, use restricted user, allowlist commands |
| No input sanitization on agent tool inputs | Prompt injection leads to arbitrary code/command execution | Validate and sanitize all tool inputs; use allowlists for shell commands |
| WebSocket connections without re-authentication | Session hijacking on reconnect | Require auth token on every connection, validate server-side |
| Storing conversation history with secrets | User accidentally pastes API key in chat, it persists forever | Scan and redact known secret patterns from stored conversations |
| Agent can read its own config/secrets | Prompt injection extracts API keys via "read the config file" | Agent filesystem access must exclude config/secrets directories |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Approval dialog for every action | Task that takes 30 seconds takes 5 minutes | Tiered approval: auto-approve reads, confirm writes, require approval for destructive actions |
| No streaming during agent "thinking" | User stares at blank screen for 10+ seconds, thinks it crashed | Stream agent reasoning and partial results in real-time |
| Silent failover to weaker model | User gets bad results without knowing why | Notify user when fallback is active: "Using GPT-4o-mini because Claude is unavailable" |
| Tool execution with no progress indication | "Is it still working?" | Show tool name, elapsed time, and partial output during execution |
| Conversation history with no search | User cannot find the task they ran yesterday | Full-text search over conversation history from day one |
| Error messages that expose internals | "TypeError: Cannot read property 'content' of undefined" | User-facing error messages with actionable guidance: "The AI provider returned an unexpected response. Try again or switch providers." |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **WebSocket connection:** Often missing reconnection logic, message ordering guarantees, and replay on reconnect -- verify by killing the connection mid-task and checking recovery
- [ ] **Provider integration:** Often missing streaming error handling, rate limit respect, and response validation -- verify by testing with rate-limited API keys
- [ ] **Session persistence:** Often missing schema migration support and corrupt-state recovery -- verify by upgrading the schema and loading old sessions
- [ ] **Tool execution:** Often missing timeout handling, output size limits, and cleanup on cancellation -- verify by killing a tool mid-execution
- [ ] **Approval system:** Often missing batch approval, remembered preferences, and timeout behavior -- verify by testing with a user who runs 50 tasks per day
- [ ] **Memory/embeddings:** Often missing deduplication, staleness detection, and capacity limits -- verify by inserting 10K+ documents and checking search quality
- [ ] **Browser automation:** Often missing page load timeout handling, resource cleanup, and memory monitoring -- verify by running 100 sequential browser tasks
- [ ] **Terminal proxy:** Often missing PTY cleanup on disconnect, escape sequence sanitization, and concurrent session limits -- verify by opening 10 terminals and disconnecting abruptly

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Context bloat degrading quality | MEDIUM | Implement context budgeting as middleware; requires touching every LLM call site but no data model changes |
| Plain-text API keys discovered | HIGH | Rotate all keys immediately, implement keychain, audit logs for unauthorized usage |
| Monolithic session object | HIGH | Incremental decomposition: extract one concern at a time behind interfaces, migrate storage |
| Provider failover storms | LOW | Add circuit breaker middleware; can be done without changing provider integration code |
| Plugin system too rigid | MEDIUM | Extract plugin interface from working built-in skills; existing skills become the first plugins |
| WebSocket state loss | MEDIUM | Add session ID and message sequencing; requires client and server changes but no data model rewrite |
| SQLite vector performance wall | MEDIUM | Swap storage backend behind abstraction layer; if abstraction exists, swap is straightforward |
| Memory leaks in browser/terminal | LOW | Implement lifecycle management (create/destroy) around existing code; add monitoring |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Context bloat | Phase 1: Core Architecture | Context token count per turn stays under budget; agent quality does not degrade over 20+ turns |
| API key security | Phase 1: Core Architecture | No plaintext keys on disk; keys loadable only through keychain API |
| Session state complexity | Phase 1: Core Architecture | Session schema has <10 fields; session file is <100 lines |
| WebSocket reliability | Phase 1: Core Architecture | Kill connection mid-task, verify auto-reconnect and state recovery within 5 seconds |
| Multi-provider failover | Phase 2: Provider Integration | Simulate provider outage; verify circuit breaker activates, fallback succeeds, no retry storms |
| Approval UX | Phase 2: Agent Loop | User completes 10 diverse tasks without being interrupted more than twice for low-risk actions |
| Provider abstraction leaks | Phase 2: Provider Integration | Run identical task on 2+ providers; verify results are comparable and provider-specific features are accessible |
| Plugin fragility | Phase 3: Extensibility | A crashing plugin does not take down the host; plugin API has <10 methods |
| SQLite vector limits | Phase 2-3: Memory System | Query latency <200ms with 10K vectors; graceful degradation at higher counts |
| Terminal proxy security | Phase 3-4: Terminal Integration | PTY process runs with restricted permissions; orphaned processes cleaned up on disconnect |
| Workflow over-engineering | Phase 3+: Advanced Features | Simple "do A then B" tasks use <3 abstraction layers |
| Browser automation leaks | Phase 3-4: Browser Integration | Memory stays stable across 100 sequential browser tasks; no orphaned Chromium processes |
| Cron job reliability | Phase 3+: Background Tasks | Scheduled job survives app restart; no duplicate execution in multi-instance |

## Sources

- [Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) -- HIGH confidence, primary source for context management
- [Redis: Context Window Overflow](https://redis.io/blog/context-window-overflow/) -- MEDIUM confidence, technical analysis of context rot
- [Portkey: Retries, Fallbacks, and Circuit Breakers in LLM Apps](https://portkey.ai/blog/retries-fallbacks-and-circuit-breakers-in-llm-apps/) -- MEDIUM confidence, production failover patterns
- [Portkey: Failover Routing Strategies for LLMs in Production](https://portkey.ai/blog/failover-routing-strategies-for-llms-in-production/) -- MEDIUM confidence, multi-provider reliability
- [GitGuardian: API Key Management Best Practices](https://blog.gitguardian.com/secrets-api-management/) -- MEDIUM confidence, secrets security
- [microsoft/node-pty GitHub](https://github.com/microsoft/node-pty) -- HIGH confidence, PTY limitations and security warnings
- [xtermjs/xterm.js Issue #1518](https://github.com/xtermjs/xterm.js/issues/1518) -- HIGH confidence, memory leak documentation
- [Playwright Issue #6319: Memory increases with same context](https://github.com/microsoft/playwright/issues/6319) -- HIGH confidence, memory leak confirmation
- [WebScraping.AI: Playwright Memory Management](https://webscraping.ai/faq/playwright/what-are-the-memory-management-best-practices-when-running-long-playwright-sessions) -- MEDIUM confidence, practical guidance
- [sqlite-vec stable release blog](https://alexgarcia.xyz/blog/2024/sqlite-vec-stable-release/index.html) -- HIGH confidence, performance benchmarks
- [BetterStack: Node-cron Scheduled Tasks](https://betterstack.com/community/guides/scaling-nodejs/node-cron-scheduled-tasks/) -- MEDIUM confidence, scheduling limitations
- [Permit.io: Human-in-the-Loop for AI Agents](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo) -- MEDIUM confidence, approval patterns
- [OneUptime: WebSocket Reconnection Logic](https://oneuptime.com/blog/post/2026-01-24-websocket-reconnection-logic/view) -- MEDIUM confidence, reconnection patterns

---
*Pitfalls research for: AI Agent Gateway Platform (AgentSpace)*
*Researched: 2026-02-15*
