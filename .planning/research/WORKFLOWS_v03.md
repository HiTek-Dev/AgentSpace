# Expected User Workflows & UX Patterns: Tek v0.3

**Domain:** AI Agent Desktop Application — Setup, Configuration, Monitoring
**Researched:** 2026-02-22
**Purpose:** Document typical user behaviors and UI interaction patterns for v0.3 features

## Workflow Categories

### Workflow 1: First-Time User Onboarding

**Trigger:** App launched for first time
**Duration:** 2-3 minutes
**Outcome:** App configured, ready to chat

**Step-by-step:**

```
1. User clicks Tek icon → App launches
2. System detects first-run (no ~/.config/tek/config.json or has_run: false)
3. Modal appears: "Welcome to Tek"
   - Explanation: "Tek is a self-hosted AI agent platform. You control every decision."
   - Choice: "Full Control" vs "Limited Control" mode
   - (Icon + 2-paragraph explanation for each)

4. User chooses security mode → Next
5. Form: "Add your first API provider"
   - Dropdown: Anthropic | OpenAI | Ollama | Other
   - If Anthropic: text field "Anthropic API Key"
   - Button: "Verify key" (optional, recommended)
   - Checkbox: "Save to Keychain" (checked by default)
   - Button: "Next"

6. Optional services (slide/step):
   - Checkbox: "Enable Telegram bot integration?"
   - If yes → text field "Telegram bot token"
   - Link: "How to get a token (@BotFather)"

7. Summary slide:
   - Shows configured provider, security mode, Telegram status
   - Button: "Start chatting" or "Go to settings to add more providers"

8. App navigates to Chat view
9. Config written to ~/.config/tek/config.json
10. First-run flag set (has_run: true)
```

**UX patterns observed in 2026:**
- Goal-first: Don't ask about "workflows" or "agents" — just get to chatting
- Escalating disclosure: One setting per screen, not a dense form
- Security mode as first choice: Sets expectations early (Tek's differentiator)
- Optional services deferred: Telegram not required to chat

**Related features:**
- ✓ First-run detection
- ✓ Onboarding flow
- ✓ Provider setup
- ✓ Telegram config

---

### Workflow 2: Adding a New Provider (Post-Onboarding)

**Trigger:** User clicks Settings → Providers → "+ Add Provider"
**Duration:** 1 minute
**Outcome:** New model available in model selector

**Step-by-step:**

```
1. User navigates: Sidebar "Settings" → Tab "Providers"
2. Existing providers shown in list:
   | Provider | Status | Models | Actions |
   |----------|--------|--------|---------|
   | Anthropic | ✓ Active | claude-3.5-sonnet, claude-3-opus | Edit | Delete |
   | Ollama | ✓ Running | neural-chat, mistral, llama2 | Edit | Delete |

3. User clicks "+ Add Provider" button
4. Modal appears: "Add Provider"
   - Dropdown: "Select provider type"
     - Anthropic
     - OpenAI
     - Ollama
     - Other (generic API)
   - User selects "OpenAI"

5. Form populated:
   - Label: "OpenAI API Key"
   - Text field (password input, shows •••)
   - Button: "Show key" (reveals last 4 chars only)
   - Checkbox: "Save to Keychain"
   - Button: "Verify key" (calls OpenAI /models endpoint)
   - Checkbox: "Create model alias?"
   - If checked:
     - Field: "Alias name" (e.g., "gpt4-main")
     - Dropdown: "Map to model" (gpt-4, gpt-4-turbo, etc.)
   - Button: "Save" (writes to config, reloads models)

6. Success toast: "OpenAI provider added. 3 models available."
7. Model list updated in Chat header dropdown

```

**UX patterns observed:**
- Password masking: Never show full API key
- Verification: Offer key validation against provider API
- Aliases: Let users rename models (e.g., "gpt4-main" instead of "gpt-4")
- Immediate feedback: Toast on success, form error on invalid key

**2026 best practices (research confirms):**
- Store keys only in secure enclave (Keychain on macOS)
- Never log full key
- Offer different dev/prod key slots
- Allow per-key usage restrictions (optional, advanced)

**Related features:**
- ✓ Provider setup UI
- ✓ Model aliases
- ✓ Secure key storage

---

### Workflow 3: Async Tool Execution with Monitoring

**Trigger:** User sends message requiring tools (search, MCP call, etc.)
**Duration:** 5-60 seconds (depends on tool)
**Outcome:** Result displayed, tools shown in right sidebar

**Step-by-step:**

```
1. User types in chat: "Search for latest Claude announcements"
2. User hits Send
3. Message appears in chat (user side)
4. Gateway receives message, routes to agent
5. Agent starts streaming thinking/planning

6. **Right sidebar activates (was empty before):**

   BACKGROUND TASKS (from WebSocket stream)
   ├─ Task #1: Agent Planning (⏳ running)
   │  └─ Duration: 2.3s
   │
   ├─ Task #2: Web Search (⏳ running)
   │  │  Tool: Brave Search
   │  │  Query: "Claude latest announcement 2026"
   │  │  Duration: 1.1s
   │  └─ Logs: (click to expand)
   │     - Starting Brave search...
   │     - Found 5 results
   │     - Processing result 1/5
   │
   └─ (waiting for next task)

7. **User experience during async work:**
   - Each task shown as it starts (live update via WebSocket)
   - Task status: ⏳ running | ✓ done | ✗ error
   - User can click any task to see:
     - Full task details (type, params, result)
     - Live logs (streaming as task runs)
     - Execution time

8. **If task requires approval** (e.g., MCP tool call):

   Modal appears over chat:
   ┌─────────────────────────────────┐
   │ APPROVAL REQUIRED               │
   ├─────────────────────────────────┤
   │ Tool: Send Email (Gmail)         │
   │                                  │
   │ Parameters:                      │
   │ • to: user@example.com           │
   │ • subject: "Test"                │
   │ • body: "Long body text..."      │
   │                                  │
   │ [Edit] [Skip] [Deny] [Approve]   │
   └─────────────────────────────────┘

   User clicks "Edit" → param form
   User clicks "Approve" → task continues
   User clicks "Skip" → tool not called
   User clicks "Deny" → stop execution

9. When all tools complete:
   - Final agent response streams in
   - Right sidebar shows all tasks completed
   - User can collapse sidebar or keep it open for reference

10. User can click "Export logs" to get task tree as JSON/markdown

```

**UX patterns observed in 2026:**
- Real-time tree view: Tasks nested hierarchically (main → step → subtask)
- Lazy log loading: Show summaries, expand on click
- Live updates: WebSocket events trigger UI updates (no polling)
- Approval gates: Modal interrupt, param inspection, decision trail
- Reference access: Logs stay visible for debugging/learning

**Complexity notes:**
- HIGH complexity: Tree rendering, WebSocket state management, log buffering
- Risk: Memory leaks if logs not cleaned up (truncate after N lines per task)
- Pattern: Virtual scrolling for deep task trees (>100 tasks)

**Related features:**
- ✓ Async tool monitoring
- ✓ Real-time approval modal
- ✓ Sub-process monitoring

---

### Workflow 4: Model Switching with Context Preservation

**Trigger:** User clicks model selector during chat
**Duration:** < 1 second (instant)
**Outcome:** Subsequent messages use new model

**Step-by-step:**

```
1. Chat is active, messages visible
   Header shows: [model selector: "claude-3.5-sonnet"]

2. User clicks model selector
3. Dropdown appears:

   Available Models:
   ✓ claude-3.5-sonnet (Anthropic) — CURRENT
   ○ claude-3-opus (Anthropic)
   ○ gpt-4-turbo (OpenAI)
   ○ mistral (Ollama)

   Or fallback chain:
   ○ [Fallback 1: Search cost-optimized]
     (primary: claude-3.5-sonnet → fallback: gpt-4 → local: mistral)

4. User selects "gpt-4-turbo"
5. Two-choice dialog appears:

   ┌──────────────────────────────┐
   │ CONTEXT CARRY-OVER?          │
   ├──────────────────────────────┤
   │ Switch to gpt-4-turbo         │
   │                              │
   │ Include chat history?         │
   │ ○ Yes - send full context    │
   │ ○ No - start fresh           │
   │ ○ Compress history first     │
   │   (dump to JSON before send) │
   │                              │
   │ [Cancel] [Switch]            │
   └──────────────────────────────┘

6. User chooses "Yes - send full context"
7. Model switches (UI shows new model name)
8. Next message from user sends to gpt-4-turbo with full history

```

**UX patterns observed:**
- Explicit choice: Don't silently drop context
- One-click switching: Dropdown + confirmation, not buried in settings
- Compression option: Let users inspect what will be sent before switching
- Fallback chains: Show as "strategies" (cost-optimized, speed-optimized, etc.)

**2026 trends:**
- Context as first-class: Preserving context across model switches is now expected
- Model Context Protocol (MCP): Standardizes how context flows (from research)
- User control: Never auto-drop context — always ask

**Related features:**
- ✓ Model switching
- ✓ Context carry-over toggle
- ✓ Database context dumps

---

### Workflow 5: Configuring Agent Personality & Model

**Trigger:** User navigates Sidebar → Agents → [Agent Name] → Settings
**Duration:** 5-10 minutes
**Outcome:** Agent model and personality updated

**Step-by-step:**

```
1. User sees agent list in sidebar:

   Agents
   ├─ Default Agent (default)
   ├─ Researcher (custom)
   ├─ Code Helper (custom)

   (+ button to create new agent)

2. User clicks "Researcher" → opens chat with that agent
3. Click "Settings" (or gear icon in header)
4. Settings panel for this agent appears:

   ┌────────────────────────────┐
   │ RESEARCHER - Agent Config  │
   ├────────────────────────────┤
   │                            │
   │ Model Settings             │
   │ ─────────────────────      │
   │ Primary Model:             │
   │ [claude-3.5-sonnet ▼]      │
   │                            │
   │ Model for Training:        │
   │ [Same as primary]          │
   │ (controls which model to   │
   │  use for agent self-debug) │
   │                            │
   │ Personality & Prompt       │
   │ ─────────────────────      │
   │ [Text Area - 500 char]     │
   │ "You are a research expert │
   │ focused on accuracy..."    │
   │                            │
   │ Or: [Load from file]       │
   │ (~/config/tek/agents/     │
   │  researcher/SOUL.md)       │
   │                            │
   │ [Editor] [Preview]         │
   │                            │
   │ Knowledge Base             │
   │ ─────────────────────      │
   │ [Drag files here]          │
   │ or [Browse] documents      │
   │                            │
   │ Files: 3 items             │
   │ • paper-1.pdf (2MB)        │
   │ • notes.md (50KB)          │
   │ • data.csv (150KB)         │
   │                            │
   │ Status: Indexed (3 files)  │
   │ Last updated: 2026-02-20   │
   │                            │
   │ [Save] [Cancel]            │
   └────────────────────────────┘

5. User updates personality text
6. User clicks [Save]
7. Agent configuration written to ~/.config/tek/agents/researcher/config.json
8. Toast: "Agent configuration saved"
9. Next message uses updated config

```

**UX patterns observed:**
- Per-agent settings: Separate model, personality, knowledge base per agent
- File-based or form-based: Let users edit SOUL.md directly or use form UI
- Knowledge base upload: Drag-drop or file picker for personalization
- Quick save: Don't require complex forms, allow editing soul file directly

**2026 trends:**
- Personality as data: Separate from execution logic
- RAG-ready: Knowledge base indexing expected from day 1
- Fast iteration: Users want to experiment (quick save, no rebuild)

**Related features:**
- ✓ Agent config UI
- ✓ Agent personality training (v0.3.1+)
- ✓ Model selection per-agent

---

### Workflow 6: Telegram Integration Setup

**Trigger:** User in Settings → Shared Services → Telegram
**Duration:** 2-3 minutes
**Outcome:** Telegram bot paired and allowlisted

**Step-by-step:**

```
1. User navigates: Sidebar → Settings → "Shared Services"
2. Tab shows:

   Telegram
   ────────
   Status: [Not configured] [Configure]

   OpenAI Image Gen
   Status: [Configured] [Settings]

   Brave Search
   Status: [Configured] [Settings]

3. User clicks "Configure" under Telegram
4. Modal: "Set up Telegram Bot"

   ┌──────────────────────────────┐
   │ Telegram Bot Setup           │
   ├──────────────────────────────┤
   │                              │
   │ Step 1: Get bot token        │
   │ 1. Open Telegram             │
   │ 2. Message @BotFather        │
   │ 3. Use /newbot command       │
   │ 4. Copy the token            │
   │ [How to get token (link)]    │
   │                              │
   │ Step 2: Enter token          │
   │ Bot Token:                   │
   │ [_____________________]      │
   │                              │
   │ [Verify] (tests with TG API) │
   │                              │
   │ Step 3: Allowlist            │
   │ Your Telegram User ID:       │
   │ [Search by @username...]    │
   │ or [Paste numeric ID]       │
   │                              │
   │ Allowlist:                   │
   │ + user-1 (123456789)         │
   │ + user-2 (987654321)         │
   │ + @username (lookup ID)      │
   │                              │
   │ [+ Add more users]           │
   │                              │
   │ [Save] [Cancel]              │
   └──────────────────────────────┘

5. User pastes bot token
6. Clicks [Verify] → checks with Telegram API, shows bot name
7. Adds current user to allowlist (auto-detect Telegram ID from desktop app settings if available)
8. Optionally adds more Telegram users
9. Clicks [Save]
10. Gateway reloads Telegram config
11. Toast: "Telegram bot configured. Ready to receive commands."
12. Chat now available in Telegram

```

**UX patterns observed:**
- Step-by-step guidance: Don't assume users know Telegram bot setup
- Token verification: Validate format and API access before saving
- Allowlist management: Let users add/remove Telegram IDs without re-entering token
- Status indication: Show if configured, when last verified, any errors

**2026 patterns (research confirms):**
- Security by default: Allowlist model (deny-by-default) not approve-by-default
- Guidance links: Docs should link to step-by-step instructions
- Async verification: Token verification shouldn't block form submission

**Related features:**
- ✓ Telegram config UI
- ✓ Allowlist/deny list management
- ✓ Gateway reload on config change

---

### Workflow 7: Approval Gate Interaction (Real-Time)

**Trigger:** Tool call requires approval (Full Control mode, or sensitive operation)
**Duration:** 5-30 seconds
**Outcome:** Tool executed with user approval

**Step-by-step:**

```
1. User sends: "Send me a summary email"
2. Agent decides to run Gmail tool: SendEmail
3. Approval gate triggered (Full Control mode)
4. Modal appears (interrupts chat):

   ┌────────────────────────────────┐
   │ APPROVAL REQUIRED              │
   ├────────────────────────────────┤
   │                                │
   │ Tool: Send Email (Gmail)       │
   │ Confidence: HIGH (agent made   │
   │             calculated choice) │
   │                                │
   │ Parameters:                    │
   │ • to: drew@example.com         │
   │ • subject: "Weekly Summary"    │
   │ • body: "Here's your summary   │
   │   of work items..."            │
   │   [... 500 more chars ...]     │
   │ • cc: (none)                   │
   │ • attachments: 0               │
   │                                │
   │ [Expand full body]             │
   │ [Edit params]                  │
   │ [Skip tool] [Approve] [Deny]   │
   └────────────────────────────────┘

5. User clicks [Edit params]
6. Form appears:
   - to: drew@example.com [text field]
   - subject: "Weekly Summary" [text field]
   - body: [large text area, 95% of modal]
   - Button: [Save and return] or [Cancel edit]

7. User modifies subject to "Weekly Summary - Feb 22"
8. Clicks [Save and return] → modal updates with new params
9. User clicks [Approve]
10. Tool executes with approved params
11. Result streams back ("Email sent successfully")
12. Modal closes
13. Execution shown in right sidebar:
    ├─ SendEmail (✓ approved and executed)
    │  └─ Result: "Email sent to drew@example.com"

```

**UX patterns observed:**
- Approval interruption: Modal breaks chat flow (intentional — high-value decision point)
- Confidence score: Show why agent thinks this is right (HIGH/MEDIUM/LOW)
- Param editing: Let users modify before execution, not just approve/deny
- Decision trail: Log which params were changed, who approved, when
- Non-destructive: [Skip] aborts tool without stopping agent (agent handles recovery)

**2026 trends:**
- Human-in-the-loop: Real-time approval is now industry standard (Microsoft AG-UI, workflow platforms)
- Param inspection: Users expect to see exactly what will be sent before API call
- Minimal modal: Don't show full reasoning, just params + confidence

**Related features:**
- ✓ Real-time approval modal (v0.3.1)
- ✓ Param editing
- ✓ Tool call interception (exists from v0.0)

---

### Workflow 8: Database Context Dump Before Compression

**Trigger:** User in Settings → Advanced → [Export context]
**Duration:** 10-30 seconds
**Outcome:** JSON/markdown file with conversation dumped locally

**Step-by-step:**

```
1. User navigates: Sidebar → Settings → Advanced
2. Section: "Context Management"

   Current conversation size: 42.5 KB (487 tokens)
   Memory files size: 156 KB
   Total context sent to model: 198.5 KB

   [View context breakdown] (shows what goes where)
   [Export conversation]
   [Compress & archive]

3. User clicks [Export conversation]
4. Dialog: "Export conversation"

   ┌────────────────────────────────┐
   │ Export Format:                 │
   │ ○ JSON (raw format)            │
   │ ○ Markdown (readable)          │
   │ ○ CSV (for analysis)           │
   │                                │
   │ Include:                       │
   │ ☑ Chat messages               │
   │ ☑ Tool calls & results        │
   │ ☑ Approval decisions          │
   │ ☑ Agent thinking (if logged)  │
   │                               │
   │ Compression:                  │
   │ ○ None (full dump)            │
   │ ○ Compress before export      │
   │                               │
   │ [Preview] [Export & Save]     │
   └────────────────────────────────┘

5. User clicks [Preview]
6. Side panel shows JSON/markdown preview:

   {
     "conversation": [...],
     "metadata": {...},
     "tools": [...],
     "approvals": [...]
   }

7. User clicks [Export & Save]
8. File picker: Save as "conversation-2026-02-22.json"
9. Toast: "Conversation exported to Downloads. 245 KB."
10. User can share file, analyze locally, or re-import later

```

**UX patterns observed:**
- Format choice: JSON for machines, markdown for humans, CSV for spreadsheets
- Granular inclusion: Let users decide what to export (may include sensitive data)
- Preview before save: Don't surprise users with file size or content
- Compression option: For long conversations, offer compression before export
- Local-first: Always save to user's machine, don't upload

**2026 trends:**
- Data portability: Users expect to export their data
- Transparency: Show exactly what will be exported
- Choice of format: Different use cases need different formats
- No cloud: Keep data local by default

**Related features:**
- ✓ Database context dumps (v0.3.1)
- ✓ Export format selection
- ✓ File system access (Tauri)

---

### Workflow 9: Gateway Overview & Restart

**Trigger:** User navigates Sidebar → Gateway (or status notification)
**Duration:** 1-2 minutes
**Outcome:** Gateway health visible, can restart if needed

**Step-by-step:**

```
1. User clicks Sidebar → "Gateway"
2. Overview page appears:

   ┌─────────────────────────────────┐
   │ GATEWAY STATUS                  │
   ├─────────────────────────────────┤
   │ Status: ✓ Running               │
   │ Uptime: 2 days, 4 hours         │
   │ Version: 0.3.0                  │
   │ Port: 18789                     │
   │ WebSocket: ✓ Connected          │
   │ Database: ✓ Connected           │
   │                                 │
   │ Last 5 Errors:                  │
   │ (none in past 24 hours)         │
   │                                 │
   │ [Restart gateway]               │
   │ [View logs] [Refresh]           │
   │                                 │
   │ ──────────────────────────────  │
   │ LIVE GATEWAY LOG (last 100)     │
   │ ──────────────────────────────  │
   │                                 │
   │ 2026-02-22 14:23:11 | INFO      │
   │ Session created: agent:default  │
   │                                 │
   │ 2026-02-22 14:23:12 | INFO      │
   │ WebSocket connected: client-1   │
   │                                 │
   │ 2026-02-22 14:23:15 | INFO      │
   │ Tool call: BraveSearch          │
   │ (query: "latest news")          │
   │                                 │
   │ [Scroll up for older logs]      │
   │ [Pause stream] [Resume stream]  │
   │                                 │
   └─────────────────────────────────┘

3. User can:
   - Click [Restart gateway] → confirmation → gateway restarts
   - Scroll logs or [Pause stream] to read
   - [View logs] → opens full log viewer
   - Refresh page → updates status

```

**UX patterns observed:**
- Status at a glance: Green/red indicator + key metrics
- Error log: Show recent errors (or "none" if healthy)
- Live log stream: New logs append to bottom, user can pause/resume
- Simple actions: Just two buttons (restart, view logs)
- Confidence indicator: Show what's connected (WebSocket, Database)

**2026 observability trends:**
- Health dashboards: Expected in all production software
- Live log access: Users need to see what's happening
- One-click restart: No CLI commands required
- Non-blocking: Logs don't freeze UI on large streams

**Related features:**
- ✓ Gateway overview page (v0.3.0)
- ✓ Status endpoint (new)
- ✓ Log streaming (new)
- ✓ Manual restart (new)

---

## UX Pattern Summary

| Pattern | Use Case | 2026 Trend | Tek Implementation |
|---------|----------|-----------|-------------------|
| **Goal-first onboarding** | First-time users | Industry standard | Security mode choice, then API key, then chat |
| **Escalating autonomy** | Different user types | Expected feature | Full Control vs Limited Control modes (from v0.0) |
| **Real-time visibility** | Async operations | Demanded by 2026 users | WebSocket tree view in right sidebar |
| **Explicit approval gates** | Security-sensitive ops | Rare, Tek differentiator | Modal with param inspection + editing |
| **Context preservation** | Model switching | Standard (MCP) | Toggle to carry over or drop history |
| **Multi-provider resilience** | Production reliability | Industry standard | Fallback chains, model aliases |
| **Live observability** | Transparency | Expected | Gateway logs, subprocess monitoring |
| **Secure key storage** | Security | Mandatory | Keychain (macOS), never plaintext |
| **Export & portability** | Data ownership | Growing expectation | JSON/markdown export, local files only |

---

**Document purpose:** Inform UI/UX design and interaction flow for v0.3
**Confidence level:** MEDIUM-HIGH (patterns confirmed by 2026 research + existing Tek philosophy)
**Last updated:** 2026-02-22
