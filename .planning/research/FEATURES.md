# Feature Research

**Domain:** Self-hosted AI agent gateway platform
**Researched:** 2026-02-15
**Confidence:** MEDIUM (competitive landscape well-documented; some user-requested features are novel with limited prior art)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multi-provider LLM support | Every gateway (LiteLLM, Portkey, Bifrost) supports 100+ providers via unified API. Users will not adopt a platform locked to one provider. | MEDIUM | Use OpenAI-compatible API format as the lingua franca. Support Anthropic, OpenAI, Google, Ollama, and local models at minimum. |
| Conversation persistence | OpenClaw, Claude Code, and every chat product stores history. Losing context between sessions is a dealbreaker. | MEDIUM | SQLite for local, with optional Postgres for multi-user. Include hybrid search (vector + BM25) like OpenClaw for retrieval. |
| Tool/function calling | Every major agent platform supports tool use. Agents without tools are just chatbots. | HIGH | Must support MCP (100M+ monthly downloads, 3000+ servers as of Jan 2026). MCP is the standard, not optional. |
| Self-hosted deployment | Core value proposition. n8n, OpenClaw, LiteLLM all offer self-hosting. Users choosing this category demand it. | MEDIUM | Docker-first deployment. Single command to start. No cloud dependency for core functionality. |
| Streaming responses | All modern LLM interfaces stream. Users will not wait for complete responses. | LOW | SSE or WebSocket streaming from the gateway to the UI. |
| Basic cost tracking | LiteLLM, Portkey, and every gateway tracks token usage and costs. Users managing API spend expect visibility. | LOW | Track tokens in/out, cost per request, running totals per model/key. |
| Multiple conversation threads | Every chat interface supports this. Single-thread is a toy. | LOW | Thread management with titles, search, archival. |
| API key configuration | Users must be able to add their own API keys for each provider. This is day-one functionality. | LOW | Secure storage (encrypted at rest), per-provider configuration, validation on entry. |
| Markdown/code rendering | Claude Code, Cursor, ChatGPT all render markdown and code blocks with syntax highlighting. | LOW | Standard markdown renderer with code block support, copy buttons, language detection. |
| System prompt management | Every agent platform allows customizing the system prompt. Users expect to control agent personality and constraints. | LOW | Per-thread or global system prompts, templates library. |

### Differentiators (Competitive Advantage)

Features that set AgentSpace apart. These are the "why use this instead of ChatGPT/OpenClaw/n8n" answers.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Transparent context management** | No other consumer-facing platform shows users every byte sent to the model. Claude Code shows tool calls but not full context assembly. OpenClaw injects skills silently. This is AgentSpace's core differentiator -- full visibility into what the model sees. | HIGH | Show the assembled prompt: system prompt + memory + skills + conversation history + tool results. Byte count, token count, cost estimate before sending. Collapsible inspector panel. |
| **Encrypted API key vault serving local apps** | LiteLLM offers virtual keys but requires running their proxy. No platform offers a local vault that other apps (CLI tools, scripts, IDE extensions) can request keys from via a local API. This turns AgentSpace into infrastructure. | HIGH | Local-only API endpoint (127.0.0.1). Apps authenticate with a session token. Keys never leave the machine unencrypted. Audit log of which app accessed which key. |
| **Triple-mode workflow builder** | n8n has visual. Langflow has visual. Claude Code has conversational. Nobody offers all three in one: visual canvas, code editor, and conversational creation -- with round-trip sync between them. | HIGH | Visual node graph, TypeScript/Python code view, and "describe what you want" conversational mode. Changes in one mode reflect in the others. This is the hardest feature to build well. |
| **Full Control vs Limited Control onboarding** | No platform does this. Claude Code has permission modes but they are binary (allow/deny). AgentSpace should offer two distinct onboarding paths: "I want to control everything" (shows all config, manual setup) vs "Just make it work" (sensible defaults, progressive disclosure). | MEDIUM | Not just a toggle -- different UI flows, different defaults, different documentation paths. Limited Control users get guardrails; Full Control users get raw access. Preference persists but can be changed. |
| **Self-debugging agents with skill authoring** | OpenClaw's skills system is the closest -- agents can draft SKILL.md files. But no platform has agents that diagnose their own failures, write corrective skills, and test them in a sandbox before adding to their repertoire. | HIGH | Agent detects failure patterns, proposes a new skill or tool, tests it in sandbox, user approves, skill is registered. Requires: failure detection, skill templating, sandboxed execution, approval workflow. |
| **Pre-flight thinking checklists** | Novel feature. No platform shows users a structured plan before execution. Claude Code's "thinking" is hidden. Cursor's agent mode just executes. AgentSpace should surface the plan, let users edit it, then execute. | MEDIUM | Before complex tasks: agent generates a checklist of steps, estimated cost, required permissions, potential risks. User reviews, edits, approves. Results are tracked against the plan. |
| **Smart model routing** | Portkey and Bifrost do routing at the gateway level but lack task-awareness. OpenClaw routes by agent, not by task complexity. AgentSpace should route by intent: planning/architecture uses high-thinking models, simple Q&A uses budget models, code generation uses code-specialized models. | HIGH | Task classifier determines complexity/type. Router selects model based on task + user budget preferences + model capabilities. Show users the routing decision and let them override. Estimated 60-87% cost savings based on industry data. |
| **Terminal proxy for interactive CLI** | interminai (PTY proxy) proves this is possible. Command Proxy MCP Server exists. But no integrated platform wraps this into the agent experience -- where the agent can interact with vim, git rebase -i, debuggers, and other TUI programs. | HIGH | PTY-based terminal emulator that the agent can read from and write to. User sees the terminal in real-time. Agent can be given control or observe. Critical for developer-focused users who live in the terminal. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Deliberately exclude these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Cloud-hosted SaaS mode** | "I don't want to self-host." | Destroys the core value proposition of transparency and control. Cloud hosting means trusting a third party with API keys and conversations. Splits engineering focus. | Provide excellent Docker deployment and one-click install scripts. Make self-hosting so easy that cloud feels unnecessary. Consider a "hosted gateway" tier much later (v3+) if there is demand. |
| **Built-in LLM hosting** | "Run models locally through AgentSpace." | Massive complexity (GPU management, model downloading, quantization). Ollama and llama.cpp already solve this well. | First-class Ollama integration. Treat local model servers as another provider, not a built-in feature. |
| **Plugin/extension marketplace** | "Let the community extend it." | Premature. Marketplaces require trust infrastructure, review processes, versioning, and security auditing. OpenClaw's ClawHub is community-maintained and quality varies wildly. | Support a skills/tools directory (local filesystem) first. Document the extension API well. Community sharing can happen via Git repos initially. Marketplace is a v3+ consideration. |
| **Real-time collaboration** | "Multiple users editing workflows together." | Enormous complexity (CRDTs, conflict resolution, presence). Very few users need this for a self-hosted agent platform. | Multi-user support with separate sessions. Shared workflow library (export/import). Real-time collab is a v4+ consideration if ever. |
| **Voice/video input** | "Talk to my agent." | Adds significant complexity (speech-to-text pipeline, audio processing). Not core to the agent gateway value proposition. | Integrate with existing STT services (Whisper API) as an optional input mode in v2+. Not a launch feature. |
| **Autonomous background agents** | "Agents that run 24/7 doing tasks." | AutoGPT proved this is dangerous and expensive. Runaway agents burn API credits and take unreviewed actions. Conflicts with the "user control" value. | Scheduled tasks with approval gates. Cron-triggered workflows that pause for user review before destructive actions. Never fully autonomous without human checkpoints. |
| **Everything-is-an-agent abstraction** | "Every component should be an agent." | Over-abstraction. Not every task needs LLM reasoning. A file reader does not need to be an "agent." This pattern inflates costs and latency. | Clear separation: tools are deterministic functions, agents use LLM reasoning. Use agents only where judgment is needed. Tools for everything else. |

## Feature Dependencies

```
[API Key Vault]
    +-- requires --> [Encrypted Storage Layer]
    +-- enables  --> [Smart Model Routing] (needs key access to multiple providers)
    +-- enables  --> [Multi-provider LLM Support]

[Multi-provider LLM Support]
    +-- requires --> [API Key Configuration]
    +-- requires --> [Streaming Responses]
    +-- enables  --> [Smart Model Routing]

[Conversation Persistence]
    +-- requires --> [Database Layer (SQLite)]
    +-- enables  --> [Multiple Threads]
    +-- enables  --> [Context Assembly]

[Context Assembly]
    +-- requires --> [Conversation Persistence]
    +-- requires --> [System Prompt Management]
    +-- enables  --> [Transparent Context Management] (can't show what you can't assemble)

[Transparent Context Management]
    +-- requires --> [Context Assembly]
    +-- enhances --> [Pre-flight Checklists] (shows what will be sent)
    +-- enhances --> [Cost Tracking] (shows cost before sending)

[Tool/Function Calling]
    +-- requires --> [MCP Client Implementation]
    +-- enables  --> [Self-debugging Agents] (needs tools to test/write skills)
    +-- enables  --> [Terminal Proxy] (terminal is a tool)

[Workflow Builder]
    +-- requires --> [Tool/Function Calling]
    +-- requires --> [Multi-provider LLM Support]
    +-- requires --> [Context Assembly]
    +-- enhances --> [Self-debugging Agents] (visual debugging)

[Self-debugging Agents]
    +-- requires --> [Tool/Function Calling]
    +-- requires --> [Sandboxed Execution]
    +-- requires --> [Skills/Prompt Template System]

[Pre-flight Checklists]
    +-- requires --> [Context Assembly]
    +-- requires --> [Cost Tracking]
    +-- enhances --> [Smart Model Routing] (shows routing decision)

[Terminal Proxy]
    +-- requires --> [PTY Wrapper Layer]
    +-- requires --> [Tool/Function Calling] (terminal as a tool)

[Full Control vs Limited Control]
    +-- requires --> [System Prompt Management]
    +-- requires --> [API Key Configuration]
    +-- affects  --> ALL features (UI/UX layer across everything)
```

### Dependency Notes

- **Transparent Context Management requires Context Assembly:** You cannot show users what the model sees until you have a well-structured context assembly pipeline. This is foundational -- build it first, then add the transparency UI.
- **Smart Model Routing requires API Key Vault:** Routing across providers means having keys for multiple providers readily available and managing them centrally.
- **Self-debugging Agents requires Tool Calling + Sandbox:** Agents writing their own skills need both the ability to execute tools and a safe place to test them. Without sandboxing, a buggy self-authored skill could corrupt the system.
- **Workflow Builder requires most core features:** This is a late-phase feature because it orchestrates everything else. Build the components first, then the visual orchestrator.
- **Full Control vs Limited Control is a UX layer:** It does not depend on specific features but affects how every feature is presented. Design it into the architecture from the start but implement the full UX in a dedicated phase.

## MVP Definition

### Launch With (v1)

Minimum viable product -- validate that a transparent, self-hosted agent platform has an audience.

- [ ] **Multi-provider LLM support** -- OpenAI, Anthropic, Google, Ollama via unified API
- [ ] **Encrypted API key management** -- Secure local storage, per-provider keys
- [ ] **Conversation persistence** -- SQLite-based, multiple threads, search
- [ ] **Streaming chat interface** -- Markdown rendering, code highlighting
- [ ] **Transparent context inspector** -- See assembled prompt, token counts, cost estimate
- [ ] **System prompt management** -- Per-thread and global system prompts
- [ ] **Basic cost tracking** -- Per-request and cumulative cost display
- [ ] **MCP tool support** -- Connect to MCP servers, execute tool calls
- [ ] **Full Control vs Limited Control toggle** -- Two onboarding paths with different defaults

**Why these:** They validate the core thesis (transparency + control + multi-provider) with minimum engineering. The context inspector is the key differentiator that must ship in v1 to test the hypothesis that users want to see what their agent sees.

### Add After Validation (v1.x)

Features to add once the core is working and users confirm the value proposition.

- [ ] **Pre-flight thinking checklists** -- Trigger: users report wanting to review before complex tasks execute
- [ ] **Smart model routing** -- Trigger: users with multiple provider keys want cost optimization
- [ ] **API key vault with local API** -- Trigger: users want to share keys with other local tools
- [ ] **Skills/prompt template system** -- Trigger: users want reusable agent configurations
- [ ] **Basic workflow builder (code-first)** -- Trigger: users want multi-step automated workflows

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Visual workflow canvas** -- Defer: requires significant frontend investment, code-first workflow builder validates demand first
- [ ] **Conversational workflow creation** -- Defer: requires workflow builder to exist first
- [ ] **Self-debugging agents** -- Defer: requires mature skills system + sandboxing + significant R&D
- [ ] **Terminal proxy** -- Defer: niche developer feature, validate audience size first
- [ ] **Multi-channel support** (Telegram, Discord, Slack) -- Defer: OpenClaw already owns this. Differentiate on desktop/web UX first, channels later
- [ ] **Triple-mode workflow sync** -- Defer: extremely complex bidirectional sync. Build each mode independently first

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Multi-provider LLM support | HIGH | MEDIUM | P1 |
| Encrypted API key storage | HIGH | LOW | P1 |
| Conversation persistence + threads | HIGH | MEDIUM | P1 |
| Streaming chat interface | HIGH | LOW | P1 |
| Transparent context inspector | HIGH | MEDIUM | P1 |
| MCP tool support | HIGH | HIGH | P1 |
| System prompt management | MEDIUM | LOW | P1 |
| Basic cost tracking | MEDIUM | LOW | P1 |
| Full Control / Limited Control UX | MEDIUM | MEDIUM | P1 |
| Pre-flight thinking checklists | HIGH | MEDIUM | P2 |
| Smart model routing | HIGH | HIGH | P2 |
| API key vault (local API for other apps) | MEDIUM | MEDIUM | P2 |
| Skills/template system | MEDIUM | MEDIUM | P2 |
| Code-first workflow builder | MEDIUM | HIGH | P2 |
| Visual workflow canvas | MEDIUM | HIGH | P3 |
| Self-debugging agents | HIGH | HIGH | P3 |
| Terminal proxy | MEDIUM | HIGH | P3 |
| Multi-channel adapters | MEDIUM | HIGH | P3 |
| Conversational workflow creation | MEDIUM | HIGH | P3 |
| Triple-mode workflow sync | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- validates core thesis
- P2: Should have, add when core is validated
- P3: Nice to have, future consideration after product-market fit

## Competitor Feature Analysis

| Feature | OpenClaw | Claude Code | Cursor/Windsurf | n8n/Langflow | AutoGPT | AgentSpace (Our Plan) |
|---------|----------|-------------|-----------------|--------------|---------|----------------------|
| Multi-provider LLM | Yes (via config) | Anthropic only | Multiple (built-in) | Yes (nodes) | Yes | Yes -- unified API |
| Self-hosted | Yes | Local CLI | Local app | Yes | Yes | Yes -- Docker-first |
| Context transparency | No (silent injection) | Partial (shows tool calls) | No | Partial (visual flow) | No | **Full visibility** -- every byte |
| Encrypted key vault | No | No | No | Credential store | No | **Yes -- with local API** |
| Multi-channel | **16+ channels** | Terminal only | IDE only | Triggers | Web only | Desktop/web first, channels later |
| Workflow builder | No (imperative skills) | No | No | **Visual canvas** | No | Visual + code + conversational |
| Model routing | Per-agent | N/A | Built-in | Per-node | Per-agent | **Task-aware routing** |
| Skills/extensibility | **SKILL.md system** | Skills + hooks | Extensions | Custom nodes | Marketplace | Skills + self-authoring |
| Pre-flight planning | No | Hidden thinking | No | No | No | **Visible checklists** |
| Terminal proxy | N/A | **Native** | **Native** | No | No | PTY-based proxy |
| Cost tracking | Basic | Token display | None visible | Per-execution | Basic | Per-request + projections |
| Onboarding modes | Single mode | Permission flags | Guided setup | Templates | Simple | **Dual-track onboarding** |
| Self-debugging | Skill drafting | No | No | No | No | **Full loop** (detect, draft, test, register) |

### Competitive Positioning

**vs OpenClaw:** OpenClaw wins on channel breadth (16+ messaging platforms) and community size. AgentSpace wins on transparency, security (key vault), and workflow tooling. Do not compete on channels -- compete on quality of the desktop/web experience and the "see everything" philosophy.

**vs Claude Code:** Claude Code wins on deep coding integration and Anthropic model optimization. AgentSpace wins on provider flexibility, transparency, and being a platform (not just a coding tool). Claude Code is single-purpose; AgentSpace is general-purpose.

**vs Cursor/Windsurf:** These are IDE-embedded agents, not standalone platforms. Different category. AgentSpace can complement them by serving as the key vault and model router that Cursor/Windsurf connect to.

**vs n8n/Langflow:** n8n wins on workflow maturity and integration count (400+ nodes). AgentSpace wins on agent-native design and context transparency. n8n retrofitted AI onto a workflow platform; AgentSpace is AI-first with workflow capabilities.

**vs AutoGPT:** AutoGPT pioneered autonomous agents but suffered from runaway execution and cost overruns. AgentSpace explicitly rejects full autonomy in favor of human-supervised execution with pre-flight checklists and approval gates.

## Sources

- [5 Best AI Gateways in 2026](https://www.getmaxim.ai/articles/5-best-ai-gateways-in-2026/) -- Gateway feature landscape (MEDIUM confidence)
- [OpenClaw Architecture, Explained](https://ppaolo.substack.com/p/openclaw-system-architecture-overview) -- OpenClaw component architecture (MEDIUM confidence)
- [OpenClaw Skills System - DeepWiki](https://deepwiki.com/openclaw/openclaw/6.3-skills-system) -- Skills framework details (MEDIUM confidence)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw) -- Feature list and channel support (HIGH confidence)
- [LiteLLM Proxy Documentation](https://docs.litellm.ai/docs/proxy/security_encryption_faq) -- Key management and encryption patterns (HIGH confidence)
- [n8n AI Agents](https://n8n.io/ai-agents/) -- Workflow builder features (HIGH confidence)
- [Langflow Documentation](https://docs.langflow.org/) -- Visual builder capabilities (HIGH confidence)
- [interminai GitHub](https://github.com/mstsirkin/interminai) -- Terminal proxy prior art (MEDIUM confidence)
- [Command Proxy MCP Server](https://skywork.ai/skypage/en/command-proxy-mcp-server-ai-engineers/1979084403256893440) -- CLI bridge for AI agents (MEDIUM confidence)
- [AI Model Router Saves 87% on API Costs](https://www.techedubyte.com/ai-model-router-saves-api-costs/) -- Cost optimization data (LOW confidence)
- [OpenClaw API Cost Optimization](https://zenvanriel.nl/ai-engineer-blog/openclaw-api-cost-optimization-guide/) -- Smart routing patterns (MEDIUM confidence)
- [Claude Code Overview](https://code.claude.com/docs/en/overview) -- Claude Code features (HIGH confidence)
- [Windsurf vs Cursor Comparison](https://windsurf.com/compare/windsurf-vs-cursor) -- IDE agent features (MEDIUM confidence)
- [AutoGPT Platform](https://agpt.co/blog/introducing-the-autogpt-platform) -- Autonomous agent features (MEDIUM confidence)
- [Best MCP Gateways 2026](https://www.integrate.io/blog/best-mcp-gateways-and-ai-agent-security-tools/) -- MCP gateway landscape (MEDIUM confidence)

---
*Feature research for: AgentSpace -- self-hosted AI agent gateway platform*
*Researched: 2026-02-15*
