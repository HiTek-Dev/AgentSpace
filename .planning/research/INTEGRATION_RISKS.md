# Integration Risks: v0.3 Feature Interactions

**Project:** Tek v0.3
**Focus:** How v0.3 features interact and create cascading failure modes
**Researched:** 2026-02-22

---

## Critical Integration Points

### 1. Desktop Config UI ↔ Gateway Process

**How they interact:**
- Desktop UI submits config changes (API keys, model aliases, approval tiers)
- Changes written to `~/.config/tek/config.json`
- Gateway process reads from same file, but keeps in-memory cache
- On restart, gateway reloads; desktop needs to verify reload succeeded

**Failure modes:**
1. **Silent desync**: UI shows "saved" but gateway still using old key
   - User makes API key change in UI
   - File written, but gateway cache not invalidated
   - Next tool call uses old key, fails silently
   - User restart "fixes" it (clears cache)

2. **Partial save**: Config written, restart required, but UI doesn't communicate
   - User doesn't know restart is needed
   - Tries using new config immediately
   - Tool executions fail inconsistently
   - Logs show "using old key" even though file has new key

**Integration rule:**
- **Always invalidate gateway cache before showing UI success**
- Config changes → write file → broadcast "config changed" event → gateway re-reads + re-initializes providers → gateway sends "config applied" ACK → UI shows "saved"
- If no ACK within 3s, show error "Gateway didn't respond, try restarting"

**In which phases:**
- v0.3.1: Implement config invalidation messaging
- v0.3.2: Add gateway ACK requirement
- v0.3.3: Timeout and error handling

---

### 2. Async Tool Handling ↔ Approval Center

**How they interact:**
- User approves tool in approval center
- Async tool handler queues execution
- Multiple handlers (approval + execution + UI update) race to process
- Approval state must reach execution layer before tool runs

**Failure modes:**
1. **Out-of-order execution**: Tool executes before approval reaches handler
   - Approval submitted at T+0
   - Tool execution handler picks up tool at T+1 (before approval broadcast)
   - Tool blocked, user confused: "I just approved it!"

2. **Cache inversion**: Approval cached as "denied", tool blocked
   - User changes approval tier (e.g., "always ask" → "auto-approve")
   - Cache in execution layer still shows "ask" or "deny"
   - New tools blocked despite tier change
   - Only way out: restart app (clears cache)

3. **Approval executed twice**: Tool queued, approval received, tool released, execution starts, restart happens, tool runs again with stale approval
   - Tool checkpoint survives restart
   - Approval cache cleared on restart (approval event lost)
   - Tool executes again without new approval

**Integration rule:**
- **Approval state is versioned, not cached**
- Execution layer queries approval state on each tool execution (no cache)
- Approval state includes version number; state change increments version
- If approval version changes mid-execution, tool pauses, re-evaluates approval
- Approval events broadcast as invalidation, not as data delivery

**In which phases:**
- v0.3.2: Implement approval versioning, query-on-execution
- v0.3.3: Event broadcast for approval changes
- v0.3.4: Integration tests: toggle approval mid-execution, restart during approval

---

### 3. Model Switching ↔ Context Compression

**How they interact:**
- User switches models mid-conversation
- Context needs to be compressed to fit new model's window (or expanded if new model has larger window)
- Compression is lossy; information might be lost
- Agent should notify user if context was truncated

**Failure modes:**
1. **Context loss hidden from user**
   - Switch from GPT-4 (128K window) to Ollama (4K window)
   - Context automatically compressed to 4K (90% lost)
   - Agent continues as if nothing happened
   - User doesn't realize agent has amnesia

2. **Compression artifacts**: Context compressed, agent sees garbled instruction
   - Original instruction: "Always write code in Python"
   - After compression + truncation: "Always write Python" or "write code"
   - Agent behavior changes subtly

3. **Tool results from Model A applied to Model B**
   - Model A executes tools, gets results
   - User switches to Model B mid-execution
   - Tool results (from A) applied to Model B context
   - Model B's format doesn't match results format

**Integration rule:**
- **Never silently compress context**
- On model switch, show UI dialog: "Switching to [model]. Current context is 60K tokens, model supports 8K. After compression, context will be ~1K. Continue?"
- Force user to choose: carry over (truncated) or start fresh
- Create checkpoint before switch; if user regrets, allow "undo model switch"
- Ensure all outstanding tool results from previous model are confirmed before switch

**In which phases:**
- v0.3.3: Model switch UI dialog, context pre-calculation
- v0.3.4: Context checkpoint, model switch undo
- v0.3.5: Tool result flushing before switch

---

### 4. Subprocess Monitoring ↔ Gateway Restart

**How they interact:**
- Desktop UI monitors subprocesses (CLI, agent, background jobs)
- Subprocess logs stream via WebSocket from gateway
- Gateway restart kills all WebSocket connections
- Subprocess monitoring in UI stops, shows "disconnected"

**Failure modes:**
1. **Subprocess appears to die when it's actually alive**
   - Gateway restarts (e.g., user triggered manual restart)
   - WebSocket connection drops
   - Subprocess still running on CLI
   - Desktop UI shows "process stopped" (actually just lost connection)
   - User panics, force-kills subprocess
   - CLI loses background job

2. **Log stream stops mid-execution**
   - Subprocess running, logs streaming
   - Gateway restarts without graceful shutdown
   - WebSocket closed mid-stream
   - No final "process exited" message
   - UI shows "process running" but no new logs
   - User can't tell if process is stuck or just connection lost

3. **Log gaps after restart**
   - Subprocess ran during gateway downtime
   - Logs written to file but not sent to desktop (gateway was down)
   - Gateway restarts, UI reconnects
   - Log viewer starts from current position, misses logs from downtime window

**Integration rule:**
- **Graceful shutdown: 30s warning before gateway restart**
- Desktop UI shows "Gateway restarting in 30s, active operations will pause"
- Gateway sends "shutdown imminent" event to all connected clients
- Clients save state, freeze new operations
- On shutdown, gateway flushes all active subprocess logs to persistent store
- On restart, subprocess monitor syncs logs from persistent store, backfills UI
- Subprocess heartbeat separate from WebSocket; subprocess confirms "still alive" via file or pipe

**In which phases:**
- v0.3.3: Graceful shutdown notification, persistent log store
- v0.3.4: Log backfill on reconnect, subprocess heartbeat
- v0.3.5: E2E test: gateway restart, verify logs and process status recovered

---

### 5. Provider Configuration ↔ Rate Limiting

**How they interact:**
- User configures multiple providers (Claude, GPT-4, Ollama)
- Agent executes tools with provider
- Provider rate-limits (429 responses)
- Configuration UI should show provider health

**Failure modes:**
1. **Rate limit cascade**: All tools fail when primary provider rate-limited
   - User has 1 API key for OpenAI
   - Key rate-limited
   - All tool calls fail with generic error
   - No fallback to secondary provider
   - No rate limit warning in UI

2. **Silent retry loop**: Circuit breaker not implemented
   - Tool fails with 429
   - System retries immediately
   - Rate limit worsens
   - Multiple tool calls in flight all fail
   - Token spend goes up

3. **Stale provider health info**
   - Provider healthy at config time
   - Later: rate-limited
   - Configuration UI still shows "healthy" (cached)
   - User doesn't know to switch provider

**Integration rule:**
- **Implement circuit breaker per provider**
- 429 response → increment provider error count
- After 3 consecutive 429s → open circuit for provider (fail-fast for 60s)
- When circuit open, automatic failover to secondary provider
- Configuration UI shows provider status: healthy / rate-limited (timestamp) / error (retry at X)
- Rate limit info extracted from 429 response headers (Retry-After)
- Desktop app broadcasts rate limit alerts when provider status changes

**In which phases:**
- v0.3.3: Circuit breaker implementation
- v0.3.4: Provider health display in config UI
- v0.3.5: Automatic failover logic

---

### 6. First-Run Onboarding ↔ Config Persistence

**How they interact:**
- First launch: onboarding flow collects API keys, provider setup, agent personality
- Onboarding data written to config file
- On app restart, first-run marker prevents re-running onboarding
- If config corrupted, onboarding should restart

**Failure modes:**
1. **Partial onboarding persisted**
   - User completes API key step
   - App crashes before writing config
   - On restart: first-run marker exists but config empty
   - Next launch: first-run marker present, onboarding skipped
   - App starts with empty/invalid config

2. **Migration missed after upgrade**
   - v0.3.0 onboarding collects config in JSON format
   - v0.3.1 adds new "Telegram whitelist" config
   - User hasn't upgraded yet (on v0.3.0)
   - Upgrade happens (to v0.3.1)
   - First-run marker still says "complete" from v0.3.0
   - New Telegram setup never runs
   - User upgrades, new feature isn't configured

3. **Rollback scenario**: User downgrade from v0.3.1 to v0.3.0
   - Config has Telegram whitelist field (new in v0.3.1)
   - v0.3.0 app doesn't know about Telegram field
   - Config parses but skips Telegram data
   - User upgrades back to v0.3.1
   - Telegram data gone (silent data loss)

**Integration rule:**
- **Atomic onboarding: all or nothing**
- Onboarding writes checkpoint after each step (key-value file, one file per step)
- On crash, restart detects partial checkpoints, offers resume or reset
- Config version in file: `config_version: 3` (matches app release version)
- On startup, check config version vs app version; if mismatch, run migration or re-onboarding
- Backup: before reading config, copy to `config.backup-[timestamp]`
- Validation: after reading config, validate all required fields present; if not, show "config corrupted, run setup again?"

**In which phases:**
- v0.3.1: Checkpoint system, config versioning, atomic writes
- v0.3.2: Migration detection, backup on startup
- v0.3.3: Upgrade testing (v0.2 → v0.3)

---

## Cascading Failure Scenarios

### Scenario: User adds new provider mid-conversation

**Sequence:**
1. User in conversation with Claude
2. Decides to add GPT-4 as fallback
3. Desktop UI → Configuration → Providers → Add GPT-4
4. Enters API key, hits Save
5. Switch to Chat and try GPT-4

**Failure cascade if no integration safety:**

```
T+0:   User saves GPT-4 key in config UI
T+1:   File written, UI shows "saved" (before gateway sync)
T+2:   User switches to Chat, changes model to GPT-4
T+3:   Agent tries tool with GPT-4 key
T+4:   Key not loaded in gateway (cache stale), uses old key
T+5:   Tool fails with "wrong API key" error
T+6:   User frustrated, restarts app
T+7:   App restarts, gateway reloads config, key now present
T+8:   User retries tool, works
```

**Prevention (integrated approach):**
- Desktop config UI waits for gateway ACK before showing "saved" ✓ (pitfall #1)
- Model switch paused during provider initialization ✓ (pitfall #3)
- Error message specific: "Provider not ready, trying fallback" ✓ (pitfall #10)
- Retry with fallback provider if primary fails ✓ (pitfall #10)

---

### Scenario: Gateway restart during active approval

**Sequence:**
1. Tool execution halted, waiting for approval
2. User sees "Tool requires approval" in Approval Center
3. Admin starts gateway restart from Settings
4. Gateway sends "restart in 30s" notification
5. Approval center clears (WebSocket disconnects mid-restart)
6. User never approves tool

**Failure cascade if no integration safety:**

```
T+0:   Tool execution blocked, approval queued in gateway memory
T+5:   Admin clicks "Restart Gateway"
T+10:  Gateway gracefully shutting down
T+15:  WebSocket closes, all clients disconnect
T+20:  Gateway process exits, approval in memory lost
T+25:  Gateway restarts, loads config
T+30:  Client reconnects
T+31:  User tries to find tool approval, it's gone
T+32:  User re-runs tool, it blocks waiting for approval again
```

**Prevention (integrated approach):**
- Approval persisted to database before restart ✓ (pitfall #7)
- Desktop UI notifies user of restart, gives 30s warning ✓ (pitfall #7)
- Client persists approval state locally, syncs on reconnect ✓ (pitfall #2)
- Session recovery: on reconnect, gateway shows same tool waiting for approval ✓ (pitfall #7)

---

### Scenario: High-load tool execution with model switch

**Sequence:**
1. Agent executing 10 tools in parallel with Claude (async batch)
2. User switches model to Ollama mid-execution
3. Tool results arriving out of order
4. Context is large (50K tokens); Ollama only supports 4K

**Failure cascade if no integration safety:**

```
T+0:   Tools 1-10 submitted, executing with Claude
T+1:   Tool 1 completes
T+2:   Tool 3 completes (arrived before Tool 2)
T+3:   User switches model to Ollama
T+4:   Tool 2 completes
T+5:   Context compressed to 4K (90% lost)
T+6:   Tools 4-10 still executing, results arriving out of order
T+7:   Tool 5 result applied to Ollama context (wrong format)
T+8:   Agent confused: results don't match expectations
T+9:   Tool 8 blocked: "dependency not satisfied"
```

**Prevention (integrated approach):**
- Model switch pauses execution, waits for outstanding tools ✓ (pitfall #6)
- Execution queue ensures FIFO tool completion ordering ✓ (pitfall #2)
- Context checkpoint before switch, user confirms compression ✓ (pitfall #6)
- Tool results flushed before new model executes ✓ (pitfall #6)

---

## Phase Delivery Order (Suggested)

Based on integration risk:

1. **v0.3.1: Desktop Config Core**
   - Config sync (pitfall #1)
   - First-run atomicity (pitfall #4)
   - Config versioning (pitfall #9)

2. **v0.3.2: Async Tool Execution**
   - Execution queue, idempotency (pitfall #2)
   - Approval versioning (pitfall #3)
   - Rate limit detection (pitfall #10)

3. **v0.3.3: Subprocess + Restart Safety**
   - Subprocess monitoring core (pitfall #5)
   - Graceful gateway restart (pitfall #7)
   - Approval-async integration tests

4. **v0.3.4: Model Switching + Context**
   - Model switch UI and checkpoints (pitfall #6)
   - Context carry-over safety
   - Config ↔ Gateway integration testing

5. **v0.3.5: Polish + E2E Testing**
   - Tray status indicators (pitfall #8)
   - Circuit breaker + provider health (pitfall #10)
   - Chaos testing (all pitfalls)

---

## Testing Strategy

### Unit Tests (Per Pitfall)
- Config sync: write config, verify gateway sees it
- Async tool: submit 100 tools, verify FIFO execution
- Approval: toggle approval, verify tool respects new state
- Subprocess: kill subprocess mid-logging, verify UI detects
- Model switch: switch models, verify context integrity

### Integration Tests (Per Phase)
- Config ↔ Gateway: restart during config write
- Async ↔ Approval: toggle approval mid-execution
- Model switch ↔ Context: compress context, switch back
- Subprocess ↔ Restart: start log stream, restart gateway, verify resume

### Chaos Tests (Before Release)
- Simultaneous: config change + tool execution + model switch
- Network: kill WebSocket connection, verify reconnect + state restore
- Process: kill gateway -9, restart, verify all sessions recover
- Concurrency: 100 tool approvals + 3 model switches + config change

---

## Sources

All pitfalls derived from research documented in `/Users/drew-mini/Documents/GitHub/tek/.planning/research/PITFALLS_v03.md`

---

*Last updated: 2026-02-22 during v0.3 integration planning*
