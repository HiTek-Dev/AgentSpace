# AgentSpace v1.0 — One Sheet (Updated 2026-02-17)

## What It Is

Self-hosted AI agent gateway. You own every API call, see every token, approve every action. Works from terminal (CLI) or phone (Telegram).

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────┐
│  CLI (Ink)   │────▶│        Gateway (Fastify)          │
└─────────────┘     │                                    │
                    │  WebSocket (:3271/gateway)          │
┌─────────────┐     │                                    │
│  Telegram    │────▶│  ┌─────────┐  ┌────────────────┐  │
│  (grammY)    │     │  │Sessions │  │ Tool Registry  │  │
└─────────────┘     │  │Manager  │  │ (MCP+Built-in) │  │
                    │  └─────────┘  └────────────────┘  │
                    │  ┌─────────┐  ┌────────────────┐  │
                    │  │ Memory  │  │  LLM Routing   │  │
                    │  │ System  │  │ (Multi-Provider)│  │
                    │  └─────────┘  └────────────────┘  │
                    └──────────┬───────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        Anthropic          OpenAI           Ollama
```

## 5 Packages

| Package | What It Does |
|---------|-------------|
| `@agentspace/core` | Config schema, logger, crypto, skills types. Shared by all. |
| `@agentspace/db` | Drizzle + SQLite + sqlite-vec. Sessions, messages, threads, memories, workflows, schedules, Telegram users. |
| `@agentspace/cli` | Ink-based terminal UI. Chat, onboarding wizard, vault (keychain), slash commands, tool approval prompts. Entry: `agentspace` |
| `@agentspace/gateway` | Fastify + WebSocket server. LLM streaming, routing, context assembly, agent tool loop, MCP, workflows, Claude Code, system skills. |
| `@agentspace/telegram` | grammY bot. Pairing auth, message routing, inline tool approval buttons, streaming accumulator. |

## 11 Phases — What Each Built

| # | Name | What You Got |
|---|------|-------------|
| 1 | Foundation & Security | Monorepo scaffold, encrypted vault (OS keychain), security modes (full/limited control), onboarding wizard |
| 2 | Gateway Core | WebSocket server, Anthropic streaming, session management, context inspector (see what's sent to the model) |
| 3 | CLI Interface | Terminal chat UI (Claude Code style), markdown rendering, slash commands, streaming display |
| 4 | Multi-Provider | OpenAI + Ollama support, complexity-based routing (planning→big model, Q&A→budget), user can override |
| 5 | Memory & Persistence | Daily memory logs, long-term MEMORY.md, SOUL.md personality, vector search (sqlite-vec), thread management |
| 6 | Agent Capabilities | MCP tool integration, filesystem/shell tools, approval gates (auto/session/always), pre-flight checklists, skills directory |
| 7 | Self-Improvement | Failure pattern detection, skill authoring + sandbox testing, terminal proxy (run vim/git through agent), agent PTY observation |
| 8 | Workflows & Scheduling | YAML/TS workflow engine with branching, cron scheduler, heartbeat monitoring with active hours |
| 9 | Telegram | Bot with pairing-code auth, message routing through gateway, inline tool approval buttons, streaming accumulator |
| 10 | Claude Code & System Skills | Claude Code session manager (Agent SDK), approval proxying, web search (Tavily), image gen (OpenAI/Stability), browser (Playwright MCP), Google Workspace (Gmail/Drive/Calendar/Docs) |
| 11 | Install & Update System | Memory files relocated to `~/.config/agentspace/memory/`, install/update shell scripts, fresh-start reset script |

## Config & Data Locations

| What | Where |
|------|-------|
| Config file | `~/.config/agentspace/config.json` |
| SQLite database | `~/.config/agentspace/agentspace.db` |
| Runtime info (PID/port) | `~/.config/agentspace/runtime.json` (exists only while gateway runs) |
| API keys | macOS Keychain (service: `agentspace`, account: `api-key:<provider>`) |
| Auth token | macOS Keychain (service: `agentspace`, account: `api-endpoint-token`) |
| Memory files | `~/.config/agentspace/memory/` (SOUL.md, MEMORY.md, daily/) |
| Soul document | `~/.config/agentspace/memory/SOUL.md` |
| Skills directory | Configurable via `config.json` `skillsDir` field |

## Logging

All logs go to **stderr** (not files). Format:
```
2026-02-17T08:00:00.000Z [INFO] [gateway-ws] WebSocket client connected
```

**To see logs when running:**
```bash
# Gateway logs appear in the terminal where you start it
# To capture to file:
node packages/gateway/dist/index.js 2>gateway.log

# To watch live:
node packages/gateway/dist/index.js 2>&1 | tee gateway.log
```

**Logger names to look for:**
- `vault` — keychain operations
- `gateway-ws` — WebSocket connections, message dispatch
- `llm` — LLM provider calls, streaming
- `session` — session create/destroy
- `usage` — token/cost tracking
- `context` — context assembly
- `routing` — model routing decisions
- `memory` — memory read/write/search
- `tools` — tool execution, approval
- `mcp` — MCP server connections
- `workflow` — workflow execution
- `scheduler` — cron job runs
- `heartbeat` — heartbeat checks
- `claude-code` — Claude Code sessions
- `telegram` — Telegram bot events

## UAT Testing Guide

### Tier 1: Foundation (test first)
- [ ] **Onboarding**: Run `agentspace init` — walks through security mode + API keys
- [ ] **Key management**: `agentspace keys list`, `agentspace keys add anthropic`
- [ ] **Config**: `agentspace config show`
- [ ] **Audit log**: `agentspace audit`

### Tier 2: Core Chat
- [ ] **Start gateway + chat**: Run gateway, then `agentspace chat`
- [ ] **Streaming**: Send a message, verify streaming response appears token-by-token
- [ ] **Markdown**: Ask for code — should render with syntax highlighting
- [ ] **Sessions**: Multiple chats should get separate sessions

### Tier 3: Multi-Provider & Routing
- [ ] **Model switch**: Use `/model openai:gpt-4o` mid-conversation
- [ ] **Auto-routing**: Ask a simple question (should route to budget model), then ask for complex planning (should route to thinking model)
- [ ] **Ollama**: If local Ollama running, test `ollama:llama3`

### Tier 4: Context & Memory
- [ ] **Context inspector**: Send `context.inspect` message — see full assembled context with token counts
- [ ] **Memory**: Have a conversation, check that daily memory log is created
- [ ] **Threads**: Create multiple conversation threads
- [ ] **Vector search**: Search past conversations semantically

### Tier 5: Tools & Agent
- [ ] **File tools**: Ask agent to read/write a file — should see approval prompt
- [ ] **Shell tools**: Ask agent to run a shell command — approval gate appears
- [ ] **MCP**: Configure an MCP server in config, verify tools appear
- [ ] **Pre-flight**: Ask for a complex multi-step task — checklist should appear
- [ ] **Auto-approve**: Set tool tier to "auto" and verify it skips approval

### Tier 6: Advanced
- [ ] **Workflows**: Define a simple YAML workflow, trigger it
- [ ] **Heartbeat**: Configure a heartbeat, verify it runs on schedule
- [ ] **Terminal proxy**: Use `/proxy` to launch an interactive app
- [ ] **Claude Code**: Send `claude-code.start` to spawn a session (needs Agent SDK)
- [ ] **Telegram**: Configure bot token, pair via `/pair`, send messages

### Tier 7: System Skills (need API keys)
- [ ] **Web search**: Needs `TAVILY_API_KEY` — agent can search the web
- [ ] **Image gen**: Needs `OPENAI_API_KEY` — agent can generate images
- [ ] **Stability AI**: Needs `STABILITY_API_KEY` — alternative image gen
- [ ] **Browser**: Needs `npx @playwright/mcp@latest` — browser automation
- [ ] **Google Workspace**: Needs OAuth credentials — Gmail/Drive/Calendar/Docs

## Install & Update

See **INSTALL.md** for the full procedure. Quick reference:

```bash
# First-time install (builds from source, deploys to ~/agentspace)
scripts/install.sh ~/agentspace

# Update (stops gateway, rebuilds, syncs code — user data untouched)
scripts/update.sh ~/agentspace

# Fresh start (wipes all user data, requires typing RESET)
scripts/reset.sh
```

### Dev Mode (run from source)

```bash
pnpm install
# Build in dependency order (turbo can't handle cli↔gateway cycle)
for pkg in core db cli gateway telegram; do
  (cd packages/$pkg && npx tsc -p tsconfig.json)
done
node packages/cli/dist/index.js init    # onboarding
node packages/gateway/dist/index.js     # start gateway
node packages/cli/dist/index.js chat    # start chatting
```

## Known Issues / Notes

- **Circular dependency**: `cli` ↔ `gateway` — vault functions (getKey) live in cli but are used by gateway. Turborepo can't auto-build; use manual build order above.
- **No test suite**: Infrastructure exists (vitest configured) but no test files written yet.
- **Logs to stderr only**: No persistent log files; pipe to file if needed.
- **sqlite-vec**: Requires native binary; should auto-install via npm but may need platform-specific troubleshooting.
- **Claude Code**: Requires `@anthropic-ai/claude-agent-sdk` — spawns actual Claude Code CLI sessions, so needs Anthropic API key or Claude.ai subscription.
