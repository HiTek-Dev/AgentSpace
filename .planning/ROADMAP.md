# Roadmap: Tek

## Milestones

- **v0.0 Core Infrastructure** - Phases 1-24 (shipped 2026-02-20)
- **v0.1 Product Polish** - Phases 25-28 (shipped 2026-02-21)

## Phases

<details>
<summary>v0.0 Core Infrastructure (Phases 1-24) - SHIPPED 2026-02-20</summary>

- [x] **Phase 1: Foundation & Security** - Monorepo scaffold, encrypted credential vault, security modes, onboarding
- [x] **Phase 2: Gateway Core** - WebSocket gateway, single-provider streaming, session management, context inspection
- [x] **Phase 3: CLI Interface** - Ink-based terminal UI, Claude Code-style inline display, slash commands, markdown
- [x] **Phase 4: Multi-Provider Intelligence** - Anthropic/OpenAI/Ollama providers, smart routing, cost tracking
- [x] **Phase 5: Memory & Persistence** - Two-tier memory, soul document, vector search, conversation persistence
- [x] **Phase 6: Agent Capabilities** - MCP tools, approval gates, file/shell access, skills, pre-flight checklists
- [x] **Phase 7: Agent Self-Improvement** - Self-debugging, skill authoring, sandbox testing, terminal proxy
- [x] **Phase 8: Workflows & Scheduling** - Workflow engine, heartbeat system, cron scheduling
- [x] **Phase 9: Telegram Channel** - Telegram bot, message routing, inline approvals, pairing auth
- [x] **Phase 10: Claude Code & System Skills** - Claude Code relay, web search, image gen, browser automation, Google Workspace
- [x] **Phase 11: Install & Update System** - CDN distribution, install/update scripts, version tracking
- [x] **Phase 12: Expanded Providers** - Venice AI, Google Gemini, Ollama remote hosts, provider hot-swap
- [x] **Phase 13: Rebrand to tek** - CLI command, package scope, config paths, keychain migration
- [x] **Phase 14: CLI & Setup Polish** - Gateway subcommand, skippable setup, model catalog, uninstall
- [x] **Phase 15: Init & Onboarding Polish** - Model alias flow, Telegram setup, personality Hatch step
- [x] **Phase 16: Agent Personality System** - Multi-file identity, personality evolution, agent isolation
- [x] **Phase 17: Desktop Frontend (Tauri)** - Tauri v2 app with dashboard, chat, agents, settings
- [x] **Phase 18: Onboarding Research** - AI agent personality and onboarding patterns research
- [x] **Phase 19: Desktop & Integration Polish** - Bug fixes, UI polish, Telegram bot, end-to-end verification
- [x] **Phase 20: Agent Identity & Memory Access** - Identity injection, memory tools, provider validation
- [x] **Phase 21: Init & Agent Onboarding Rework** - Separate init/onboard, agent selection, gateway identity
- [x] **Phase 22: Agent First Contact & Dashboard Polish** - First-chat identity, conversational onboarding, desktop fixes
- [x] **Phase 23: Agent Tools & Error Recovery** - Tool workspace paths, error handling, base tool set, Brave Search
- [x] **Phase 24: Tools Actually Working** - Workspace dir creation, session persistence, tool error recovery

</details>

## v0.1 Product Polish (Phases 25-28) - SHIPPED 2026-02-21

**Milestone Goal:** Transform Tek from functional infrastructure into a polished, product-grade experience -- CLI that feels like Claude Code, desktop app that feels like Claudia, with a test harness over critical gateway paths.

- [x] **Phase 25: Foundation & Blockers** - Vault extraction, error boundaries, Vitest workspace, WS auto-reconnect (completed 2026-02-20)
- [x] **Phase 26: CLI Visual Overhaul** - Syntax highlighting, collapsible panels, input history, StatusBar redesign (completed 2026-02-21)
- [x] **Phase 27: Desktop UI Overhaul** - Markdown rendering, tool approval modal, conversation history, design system (completed 2026-02-21)
- [x] **Phase 28: Testing Foundation** - WS protocol tests, config schema tests, router tests, approval gate tests, agent loop tests, context assembly tests (completed 2026-02-21)

## Phase Details

### Phase 25: Foundation & Blockers
**Goal**: Architecture blockers resolved so CLI, desktop, and test work can proceed safely in parallel
**Depends on**: Phase 24
**Requirements**: FOUND-01, FOUND-02, FOUND-03
**Success Criteria** (what must be TRUE):
  1. `pnpm turbo build` completes in one pass with no circular dependency warnings between @tek/cli and @tek/gateway
  2. Desktop app renders a recovery UI when a page component throws an error instead of white-screening the entire app
  3. CLI and desktop WebSocket clients automatically reconnect after the gateway restarts, resuming the session without user intervention
  4. `pnpm test` from repo root discovers and runs tests across all packages via Vitest workspace config
**Plans**: 4 plans
Plans:
- [x] 25-01-PLAN.md — Vault extraction from @tek/cli to @tek/core
- [x] 25-02-PLAN.md — Error boundaries + Vitest workspace config
- [x] 25-03-PLAN.md — WebSocket auto-reconnect with exponential backoff
- [x] 25-04-PLAN.md — Break gateway-telegram cyclic dependency (gap closure)

### Phase 26: CLI Visual Overhaul
**Goal**: CLI chat experience reaches Claude Code quality -- syntax-highlighted code, collapsible tool panels, input history, and a clean information-dense StatusBar
**Depends on**: Phase 25
**Requirements**: CLIV-01, CLIV-02, CLIV-03, CLIV-04, CLIV-05, CLIV-06, CLIV-07, CLIV-08
**Success Criteria** (what must be TRUE):
  1. Code blocks in assistant responses display syntax-highlighted output with language-appropriate coloring via shiki
  2. Tool call and bash command blocks render collapsed by default (showing tool name and status) and expand on keypress to reveal arguments and output
  3. User can press up/down arrow to cycle through previous messages and Shift+Enter to insert a newline without submitting
  4. Long tool output is truncated at ~20 lines with a "(N more lines)" indicator; empty chat shows a welcome screen with agent name and available commands
  5. StatusBar displays a multi-zone layout with connection status, model/provider, and token count + cost in compact format; messages show dimmed HH:MM timestamps
**Plans**: 4 plans
Plans:
- [x] 26-01-PLAN.md — Shiki syntax highlighting integration
- [x] 26-02-PLAN.md — Custom multiline input with history
- [x] 26-03-PLAN.md — Message timestamps, truncation, and tool panels
- [x] 26-04-PLAN.md — Welcome screen, StatusBar redesign, and Chat wiring

### Phase 27: Desktop UI Overhaul
**Goal**: Desktop app delivers a polished, branded chat experience with rendered markdown, functional tool approvals, conversation history, and cohesive visual design
**Depends on**: Phase 25
**Requirements**: DSKV-01, DSKV-02, DSKV-03, DSKV-04, DSKV-05, DSKV-06, DSKV-07, DSKV-08, DSKV-09, DSKV-10, DSKV-11, DSKV-12
**Success Criteria** (what must be TRUE):
  1. Assistant messages render full markdown (headers, lists, tables, code blocks with syntax highlighting and copy button) instead of plain text
  2. User can approve, deny, or session-approve a tool call from a desktop modal that shows the tool name and argument preview
  3. Conversation history sidebar lists past sessions with preview text and timestamps; user can click to resume a previous session
  4. Chat messages display as polished cards (user right-aligned, assistant with model badge, tool calls expandable) with subtle page transition animations
  5. App has a defined brand color palette, consistent typography scale, collapsible sidebar, loading states for async operations, enriched dashboard, and organized settings page
**Plans:** 6/6 plans complete
Plans:
- [x] 27-01-PLAN.md — Design system foundation (brand tokens, typography, UI primitives)
- [x] 27-02-PLAN.md — Markdown rendering with syntax highlighting and copy button
- [x] 27-03-PLAN.md — Tool approval modal and chat card redesign
- [x] 27-04-PLAN.md — Collapsible sidebar, session history, page transitions
- [x] 27-05-PLAN.md — Dashboard enrichment and tabbed settings
- [x] 27-06-PLAN.md — Gap closure: migrate remaining hardcoded colors to design tokens

### Phase 28: Testing Foundation
**Goal**: Critical gateway paths have automated test coverage so future changes catch regressions before they ship
**Depends on**: Phase 25
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06
**Success Criteria** (what must be TRUE):
  1. WebSocket protocol tests validate that all ClientMessage and ServerMessage types round-trip through Zod parse without data loss
  2. Agent loop unit tests with mock Transport and mock streamText verify the full tool execution flow (send message, receive tool call, approve, get result)
  3. LLM router tests verify classifyComplexity returns correct tiers for keyword, length, and default cases; model selection picks the right provider model
  4. Config schema tests validate Zod round-trips for current format and migration from older config shapes
  5. Approval gate tests verify auto/session/always tier logic; context assembly tests verify system prompt includes soul, memory, and identity content
**Plans**: 3 plans
Plans:
- [x] 28-01-PLAN.md — Zod schema round-trip tests (WS protocol + AppConfig)
- [x] 28-02-PLAN.md — Pure function tests (LLM router + approval gate)
- [x] 28-03-PLAN.md — Mock-based tests (agent loop + context assembly)

## Progress

**Execution Order:**
Phase 25 first, then Phases 26, 27, and 28 can run in parallel.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 25. Foundation & Blockers | 4/4 | Complete    | 2026-02-20 | - |
| 26. CLI Visual Overhaul | 4/4 | Complete    | 2026-02-21 | - |
| 27. Desktop UI Overhaul | 6/6 | Complete   | 2026-02-21 | - |
| 28. Testing Foundation | 3/3 | Complete    | 2026-02-21 | - |

### Phase 29: Sandbox Bug Fixes & Desktop Rebuild

**Goal:** Fix all blocking sandbox bugs (agent identity, tool permissions, preflight errors, gateway start) and rebuild the desktop app from scratch with proper layout, full gateway stream forwarding, and a polished chat experience

**Depends on:** Phase 28

**Scope:**

**Bug fixes (gateway + tools):**
- Agent personality preset not applied during onboarding (dist.sh missing presets/, TEMPLATE_DIR wrong path)
- Agent workspaceDir not passed to tool registry (handlers.ts uses global config instead of agent-specific)
- Folder deletion fails (delete_file uses unlink, needs rmdir for directories)
- Preflight generation crashes with Venice AI ("Bad Request" — structured output not supported)
- Desktop gateway start fails (Tauri shell allowlist missing "node" command)
- Gateway drops tool-input, reasoning, step-boundary stream events (never forwarded to WS clients)

**Desktop app rebuild:**
- Strip all existing pages/components, start fresh with proper CSS layout
- Dashboard: gateway status card with start/stop, connection indicator
- Chat: full-width chat interface with streaming text, tool call display with expand/collapse, reasoning blocks, model badge, thinking indicator
- Forward all gateway stream events to client (tool-input streaming, reasoning, step boundaries, sources)
- Proper spacing, margins, padding on every element — no more raw Tailwind class soup
- Keep React 19 + Vite + Tailwind 4 + Tauri 2 stack (proven solid)

**Plans:** 0/TBD (run /gsd:plan-phase 29 to break down)

Plans: TBD

### Phase 30: Ollama Auto-Discovery and Remote Setup

**Goal:** Ollama provider detects locally available models automatically (no API key needed), lists them during setup like other providers, and supports manual IP:port + model entry for remote Ollama instances on the network
**Depends on:** Phase 29
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 30 to break down)

### Phase 31: Desktop Chat App Rebuild

**Goal:** Rebuild the Tauri desktop app as a polished chat session system modeled on [opcode](https://github.com/winfunc/opcode) — landing page shows gateway connection status and stats, chat selects from available agents (or auto-selects if only one), clean message cards with real-time streaming display
**Depends on:** Phase 29, Phase 32
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 31 to break down)

### Phase 32: Structured Streaming and Chat Formatting

**Goal:** Gateway streams structured JSON data to clients (CLI + desktop) enabling real-time stylized rendering — markdown formatting, code highlighting, reasoning blocks, tool call displays — with base system prompt instructing agents on response format for clean presentation
**Depends on:** Phase 29
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 32 to break down)

### Phase 33: Todo System Display in CLI and Desktop

**Goal:** Display the existing todo system in the CLI bottom status area and desktop chat interface — showing active tasks, progress, and status updates as agents work, similar to Claude Code's task tracking display
**Depends on:** Phase 31, Phase 34
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 33 to break down)

### Phase 34: CLI Chat UX Overhaul

**Goal:** CLI chat mimics Claude Code / Kimicode UX — fixed bottom input area that expands as user types, status section pinned below input, streaming responses scroll above, clean separation between user entry zone and conversation history
**Depends on:** Phase 29
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 34 to break down)
