# Implementation Notes: v0.3 Features

**Domain:** Tek v0.3 Desktop UX & Configuration
**Researched:** 2026-02-22
**Purpose:** Complexity estimates, dependencies, and technical notes for phase planning

## Feature Complexity & Dependencies

### Table: All v0.3 Features with Complexity, Dependencies, Risk

| Feature | Category | Complexity | Depends On | Blocker? | Risk | Est. Sprint Days |
|---------|----------|------------|-----------|----------|------|------------------|
| First-run detection | Setup | LOW | Config file path | No | LOW | 1 |
| Onboarding flow | Setup | MEDIUM | First-run + security modes | No | LOW | 3 |
| Provider setup UI (form) | Config | MEDIUM | Tauri UI + file I/O | No | MEDIUM | 3 |
| Provider key validation | Config | MEDIUM | Provider APIs (Anthropic, OpenAI, Ollama) | No | MEDIUM | 2 |
| Telegram config UI | Config | MEDIUM | Telegram API, config storage | No | MEDIUM | 2 |
| Telegram allowlist mgmt | Config | MEDIUM | Form + validation | No | MEDIUM | 1 |
| Agent config UI | Config | MEDIUM | File I/O, existing agent system | No | LOW | 2 |
| Async tool monitoring (tree) | Monitoring | HIGH | WebSocket tool events (NEW) | **YES** | MEDIUM | 5 |
| Real-time tool logs | Monitoring | MEDIUM | WebSocket logging stream | **YES** | MEDIUM | 3 |
| Tool approval modal (basic) | Monitoring | MEDIUM | Existing approval system + modal UI | No | LOW | 2 |
| Gateway overview page | Monitoring | LOW | Status endpoint (NEW) | No | LOW | 2 |
| Gateway status endpoint | Monitoring | LOW | Gateway health check logic | No | LOW | 1 |
| Gateway restart button | Monitoring | LOW | Gateway API endpoint | No | LOW | 1 |
| Model selector in chat | Config | LOW | Existing routing | No | LOW | 1 |
| Model context carry-over toggle | Config | MEDIUM | Gateway model switching logic | No | MEDIUM | 2 |
| Sub-provider fallback UI | Config | MEDIUM | Existing routing + form | No | MEDIUM | 2 |
| Real-time approval modal (v0.3.1) | Monitoring | MEDIUM-HIGH | Tool call interception + WebSocket | No | MEDIUM | 3 |
| Database context dumps | Export | MEDIUM | Database query + format conversion | No | LOW | 2 |
| Subprocess monitoring (v0.3.1) | Monitoring | HIGH | Subprocess spawning logging | No | HIGH | 4 |
| Agent personality training (v1.0) | Advanced | HIGH | Document processing + vector indexing | No | HIGH | 8+ |

## Critical Blockers (Must Resolve First)

### Blocker 1: WebSocket Tool Event Stream
**What:** Gateway must emit tool execution events (started, ended, error) to desktop UI in real-time
**Why blocking:** Required for async tool monitoring tree view, approval gates, and log streaming
**Current status:** Not implemented (v0.2 gateway doesn't stream tool events)
**Solution:** Extend gateway WebSocket API with new message type:

```json
{
  "type": "tool.event",
  "timestamp": "2026-02-22T14:23:15Z",
  "task_id": "task-123",
  "parent_task_id": "parent-456",
  "event": "started|ended|error",
  "tool_name": "BraveSearch",
  "tool_params": {...},
  "duration_ms": 1234,
  "result": {...},
  "error": null
}
```

**Effort:** 2-3 sprint days (gateway modification, testing, desktop listener)
**Risk:** Must not break existing WebSocket connections, needs backward compatibility
**Must complete before:** Async monitoring, approval gates

### Blocker 2: First-Run Detection Flag
**What:** Config file with `has_run: true` flag to detect first launch
**Why blocking:** Prevents onboarding flow from showing on every launch
**Current status:** Not implemented
**Solution:** Check `~/.config/tek/config.json` for `first_run` flag at app startup

```json
{
  "first_run": false,
  "has_onboarded": true,
  "created_at": "2026-02-15T12:00:00Z"
}
```

**Effort:** 1 sprint day
**Risk:** None
**Must complete before:** Any UI that references onboarding state

## Dependency Graph (Critical Path)

```
WebSocket Tool Events (BLOCKER)
    ├──→ Async Tool Monitoring Tree View
    │    └──→ Real-time Approval Modal (v0.3.1)
    └──→ Real-Time Tool Logs

First-Run Flag (BLOCKER)
    └──→ Onboarding Flow
         └──→ Provider Setup UI
              ├──→ Model Selector in Chat
              └──→ Model Switching + Context

Gateway Status Endpoint (BLOCKER for monitoring)
    └──→ Gateway Overview Page

Agent Config UI
    ├──→ Agent Soul/Prompt Editing
    └──→ Per-Agent Model Selection

Fallback Routing (existing)
    └──→ Sub-Provider Fallback UI

(Independent: No blockers)
├──→ Telegram Config UI
├──→ Model Context Carry-over Toggle
└──→ Database Context Dumps
```

## Phase-by-Phase Breakdown

### Phase 1: Implement Blockers (v0.3.0 Start)
**Duration:** 1-2 weeks
**Goal:** Unblock all downstream features

**Tasks:**
1. Add WebSocket tool event stream to gateway
   - Emit `tool.event` on every tool execution
   - Stream to connected desktop clients
   - Handle client disconnect gracefully
   - Backward compatibility (don't break existing clients)

2. Add gateway status endpoint
   - `/api/gateway/status` returns uptime, version, connections
   - Include database, WebSocket, Telegram bot status
   - No auth required (localhost only)

3. Implement first-run detection
   - Check `has_run` flag in config.json
   - Set flag to true after onboarding
   - Fallback: if config missing, treat as first-run

**Testing:** Unit tests for each. Integration test for WebSocket streaming.
**Risk:** MEDIUM (gateway modifications touch core infrastructure)

### Phase 2: Core UI Features (v0.3.0 Main)
**Duration:** 2-3 weeks
**Goal:** Complete v0.3.0 MVP

**Tasks (prioritized):**

1. **High priority (start first):**
   - Onboarding flow modal (security mode + provider setup)
   - Provider setup UI form + validation
   - Async tool monitoring tree view (uses WebSocket from Phase 1)
   - Gateway overview page + restart button

2. **Medium priority (parallel):**
   - Telegram config UI + allowlist
   - Agent config UI (soul, model selection)
   - Model selector in chat header
   - Model context carry-over toggle

3. **Lower priority (can defer to v0.3.1):**
   - Sub-provider fallback UI
   - Database context dumps (v0.3.1)
   - Real-time approval modal (v0.3.1)

**Testing:** Component tests for each UI. E2E tests for onboarding + setup flow.
**Risk:** LOW-MEDIUM (mostly UI, reuses existing backend logic)

### Phase 3: Polish & Advanced (v0.3.1)
**Duration:** 1-2 weeks
**Goal:** Add sophisticated features post-launch validation

**Tasks:**
1. Real-time approval modal (modal + param editing)
2. Sub-provider fallback UI
3. Database context dumps + export
4. Error handling improvements
5. Subprocess monitoring (if time permits)

**Testing:** User testing on real workflows.
**Risk:** MEDIUM (approval modal requires careful UX validation)

## Backend Infrastructure Changes Required

### Change 1: WebSocket Tool Event Stream (Gateway)

**File:** `packages/gateway/src/routes/websocket.ts` (or similar)

**What to add:**
- New message type: `tool.event`
- Emit on tool start, end, error
- Include task ID, parent ID for tree hierarchy
- Stream to all connected desktop clients

**Code pattern:**
```typescript
// On tool execution
gateway.broadcast({
  type: 'tool.event',
  event: 'started',
  task_id: generateId(),
  parent_task_id: currentTaskId,
  tool_name: toolName,
  timestamp: new Date().toISOString(),
});

// On tool completion
gateway.broadcast({
  type: 'tool.event',
  event: 'ended',
  task_id: taskId,
  result: toolResult,
  duration_ms: elapsed,
});
```

**Testing:**
- Unit: Broadcast called with correct structure
- Integration: Desktop client receives events
- Load: 1000+ events per minute doesn't lose messages

### Change 2: Gateway Status Endpoint

**File:** `packages/gateway/src/routes/status.ts` (new)

**What to add:**
- GET `/api/gateway/status`
- Returns uptime, version, connection counts
- Checks database connection status
- Checks Telegram bot connection status

**Response shape:**
```json
{
  "status": "healthy",
  "version": "0.3.0",
  "uptime_seconds": 123456,
  "connections": {
    "websocket": 5,
    "database": "connected",
    "telegram_bot": "connected"
  },
  "memory_usage_mb": 245,
  "last_error": null,
  "timestamp": "2026-02-22T14:23:15Z"
}
```

**Testing:**
- Returns 200 when healthy
- Returns degraded status if database down
- Endpoint performance < 50ms

### Change 3: Telegram Config Persistence

**File:** `packages/gateway/src/config/telegram.ts` (or existing telegram module)

**What to add:**
- Store Telegram bot token in ~/.config/tek/config.json
- Store allowlist/denylist
- Validate token format on save
- Support config reload without restart

**Config shape:**
```json
{
  "telegram": {
    "bot_token": "encrypted:...",
    "whitelist_user_ids": [123456, 789012],
    "blacklist_user_ids": [],
    "enabled": true
  }
}
```

**Testing:**
- Token saved to disk
- Token loaded on startup
- Config reload doesn't restart gateway
- Invalid token rejected at save time

### Change 4: Agent Configuration per-Agent

**File:** `packages/db/src/schema/agents.ts` or `packages/gateway/src/agents/config.ts`

**What to add:**
- Store per-agent model selection
- Store per-agent system prompt
- Store per-agent knowledge base files
- Support file I/O (Tauri → desktop can read/write SOUL.md)

**Storage:**
```
~/.config/tek/agents/
  ├─ default/
  │  ├─ config.json (model, enabled status)
  │  ├─ SOUL.md (personality)
  │  ├─ MEMORY.md (existing)
  │  └─ knowledge/
  │     ├─ file1.pdf
  │     └─ file2.md
  ├─ researcher/
  │  └─ ... (same structure)
```

**Testing:**
- Config persists across restarts
- File changes reflected immediately
- Tauri file access validated

## Desktop App Changes Required

### Component 1: Onboarding Modal

**File:** `apps/desktop/src/components/OnboardingModal.tsx` (new)

**Purpose:** First-time setup flow
**Key props:** `onComplete: () => void`

**States:**
1. Welcome screen
2. Security mode selection (Full Control / Limited Control)
3. Provider selection
4. API key entry + validation
5. Optional Telegram setup
6. Summary + start chatting

**Testing:** Component tests for each state. E2E: onboarding → chat.

### Component 2: Provider Setup Form

**File:** `apps/desktop/src/components/ProviderSetupForm.tsx` (new)

**Purpose:** Add/edit providers
**Key props:** `provider?: Provider`, `onSave: (provider: Provider) => void`

**Features:**
- Provider type selector (Anthropic, OpenAI, Ollama, etc.)
- API key input (password field)
- Model selection from provider
- Model alias creation
- Validation + save

**Testing:** Form validation, provider API calls, state management.

### Component 3: Async Monitoring Panel (Right Sidebar)

**File:** `apps/desktop/src/components/AsyncMonitoringPanel.tsx` (new)

**Purpose:** Real-time task tree
**Key props:** `tasks: Task[]`, `onTaskClick: (id: string) => void`

**Features:**
- Hierarchical tree (task → subtasks → tool calls)
- Live updates from WebSocket
- Clickable tasks show logs
- Status icons (running, done, error)
- Time elapsed
- Auto-scroll to latest

**Testing:** Tree rendering, WebSocket updates, performance (100+ tasks).

### Component 4: Gateway Overview Page

**File:** `apps/desktop/src/pages/GatewayPage.tsx` (new)

**Purpose:** Gateway health + logs
**Features:**
- Status summary (green/red)
- Uptime, version, connections
- Live log stream (WebSocket)
- Restart button
- Error log recent items

**Testing:** Status display accuracy, restart functionality, log streaming.

### Component 5: Agent Config Panel

**File:** `apps/desktop/src/components/AgentConfigPanel.tsx` (new)

**Purpose:** Per-agent settings
**Features:**
- Model selector dropdown
- Soul/prompt text area (with preview)
- File browser for knowledge base
- Save button

**Testing:** Form state, file I/O (Tauri), model selection.

## Testing Strategy

### Unit Tests (by feature)
- First-run detection logic
- Config file parsing
- Provider validation
- Model routing logic

### Component Tests (Vitest + React Testing Library)
- Onboarding modal flow
- Provider form validation
- Agent config UI
- Model selector

### Integration Tests
- Onboarding → provider setup → first chat
- WebSocket events → monitoring panel updates
- Provider key saved → available in model selector
- Agent config change → gateway uses new model

### E2E Tests (Tauri + Playwright)
- Install app → launch → onboarding → chat
- Add provider → switch model → chat
- View async monitoring → approve tool call
- Restart gateway → logs continue

### Load Tests
- Async monitoring: 1000+ tasks in tree
- WebSocket: 100+ events per second
- Logs: 10K+ lines streaming smoothly

## Risk Mitigation

### Risk 1: WebSocket Stability (HIGH)
**Issue:** Constant event streaming could crash desktop app or overwhelm network
**Mitigation:**
- Event debouncing (batch events every 100ms)
- Max tree depth (limit to 10 levels)
- Log truncation (keep only last 1000 lines per task)
- Client-side filtering (only subscribe to monitored tasks)

### Risk 2: Config File Corruption (MEDIUM)
**Issue:** Malformed JSON could break app startup
**Mitigation:**
- Validate JSON schema on read
- Keep backup of previous valid config
- Fallback to defaults if parse fails
- Log all config changes

### Risk 3: Telegram Token Exposure (MEDIUM)
**Issue:** Token could be logged or exposed in plaintext
**Mitigation:**
- Encrypt token in config (use Keychain)
- Never log full token (only last 4 chars)
- Validate token on every startup
- Offer token rotation UI

### Risk 4: Performance (MEDIUM)
**Issue:** Complex tree rendering + WebSocket updates could lag
**Mitigation:**
- Virtual scrolling for large trees
- React memo on tree nodes
- Throttle WebSocket updates
- Async log loading (don't load all logs at once)

### Risk 5: First-Time User Confusion (LOW)
**Issue:** Onboarding flow could overwhelm or confuse
**Mitigation:**
- User testing with 5-10 people
- Keep onboarding short (max 5 steps)
- Provide help links at each step
- Allow skip for advanced users

## Success Criteria

### For v0.3.0 MVP:
- [ ] First-time user onboarded in < 3 minutes
- [ ] Can add provider and start chatting immediately
- [ ] Async tasks visible in real-time (< 500ms latency)
- [ ] Approval gates work reliably (100% decision recorded)
- [ ] No crashes during normal use (100-task workflow)
- [ ] Model switching preserves history
- [ ] Telegram config persists after restart

### For v0.3.1 Polish:
- [ ] Real-time approval modal UX validated
- [ ] Sub-provider fallback UI intuitive
- [ ] Context dumps export accurately
- [ ] Error messages clear and actionable

---

**Document purpose:** Guide technical implementation planning
**Audience:** Backend & desktop engineers
**Last updated:** 2026-02-22
