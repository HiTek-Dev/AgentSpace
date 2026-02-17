---
phase: 08-workflows-scheduling
verified: 2026-02-16T12:00:00Z
status: human_needed
score: 5/5 success criteria verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "handleHeartbeatConfigure now calls cronScheduler.scheduleHeartbeat() with real HeartbeatRunner, model, tools, and onAlert callback that sends heartbeat.alert via WebSocket"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Workflow execution end-to-end with approval gate"
    expected: "Trigger a workflow via WebSocket workflow.trigger, receive workflow.approval.request when step requires approval, send workflow.approval message, receive workflow.status showing completion"
    why_human: "Approval gate flow involves async state stored in ConnectionState; the resolve: () => {} stub at lines 890/961 is suspicious but flow may work via workflowEngine.resume()"
  - test: "Active hours filtering in scheduler"
    expected: "A schedule configured with activeHours outside current time window should skip execution and log 'skipped: outside active hours' when the cron fires"
    why_human: "Time-dependent behavior requires running the scheduler and observing skip behavior at controlled times"
  - test: "Heartbeat alert delivery end-to-end"
    expected: "Send heartbeat.configure with a valid heartbeatPath pointing to a HEARTBEAT.md file, wait for interval, receive heartbeat.alert with actionNeeded items if any checklist items require attention"
    why_human: "Requires a running gateway with valid AI model credentials, a real HEARTBEAT.md file, and waiting for the cron interval to fire"
---

# Phase 8: Workflows & Scheduling Verification Report

**Phase Goal:** Users can define automated multi-step workflows with branching logic, schedule recurring tasks, and configure heartbeat monitoring
**Verified:** 2026-02-16
**Status:** human_needed
**Re-verification:** Yes — after gap closure (previous status: gaps_found, score: 4/5)

## Goal Achievement

### Success Criteria from ROADMAP.md

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | User can define multi-step workflows in TypeScript or YAML with sequential and conditional (pass/fail/decision) branching | VERIFIED | `loader.ts` loads both YAML and .workflow.ts; `executor.ts` has `evaluateCondition`, `resolveNextStep` with branches, onSuccess, onFailure; `WorkflowDefinitionSchema` validates |
| 2 | Workflows can invoke tools, call models, and chain results between steps; workflows pause at approval gates before destructive actions | VERIFIED | `executor.ts` dispatches tool/model/noop via switch; `templates.ts` chains via `{{steps.stepId.result}}`; `engine.ts` pauses at approvalRequired steps, calls `onApprovalNeeded`, persists state |
| 3 | User can configure a heartbeat that runs at a set interval, follows a user-defined checklist, and only alerts when action is needed | VERIFIED | `handleHeartbeatConfigure` calls `cronScheduler.scheduleHeartbeat(config, msg.heartbeatPath, tools, model, onAlert)` where `onAlert` sends `heartbeat.alert` via `send(socket, ...)`. `scheduleHeartbeat` instantiates `HeartbeatRunner`, runs checks, and fires `onAlert(actionItems)` only when `actionItems.length > 0`. |
| 4 | User can set active hours for heartbeat to avoid off-hours alerts | VERIFIED | `scheduleHeartbeat` in scheduler.ts checks `isWithinActiveHours(config.activeHours)` and returns early with "skipped: outside active hours" log. `HeartbeatConfigureSchema` accepts `activeHours` field and passes it through `saveSchedule` and `config` to the cron job. |
| 5 | User can schedule one-shot and recurring tasks via cron expressions | VERIFIED | `handleScheduleCreate` saves to DB via `saveSchedule()`, registers with `cronScheduler.scheduleWorkflow()`; `maxRuns=1` achieves one-shot; server.ts switch dispatches schedule.create/update/delete/list |

**Score: 5/5 success criteria verified**

## Gap Closure Verification

### Previously Failing: Criterion 3 — Heartbeat Alert Wiring

**Previous state:** `handleHeartbeatConfigure` called `cronScheduler.schedule()` with a `logger.info()` callback. `HeartbeatRunner` and `scheduleHeartbeat()` were orphaned.

**Current state (lines 1159-1213 of handlers.ts):**

```typescript
// Obtain a model from the registry for AI-powered heartbeat checks
const { getRegistry } = await import("../llm/registry.js");
const registry = getRegistry();
const model = registry.languageModel("anthropic:claude-sonnet-4-5-20250514" as never);

const tools = connState.tools ?? {};

// Schedule heartbeat with real HeartbeatRunner and WebSocket alert callback
cronScheduler.scheduleHeartbeat(
    config,
    msg.heartbeatPath,
    tools,
    model,
    (results) => {
        send(socket, {
            type: "heartbeat.alert",
            checks: results.map((r) => ({
                description: r.description,
                actionNeeded: r.actionNeeded,
                details: r.details,
            })),
            timestamp: new Date().toISOString(),
        });
    },
);
```

**Wiring chain confirmed:**
- `HeartbeatConfigureSchema.heartbeatPath` field exists in protocol.ts (line 161)
- `cronScheduler.scheduleHeartbeat(config, heartbeatPath, tools, model, onAlert)` signature matches (scheduler.ts lines 131-136)
- `scheduleHeartbeat` instantiates `HeartbeatRunner(heartbeatPath)` and calls `runner.run(tools, model)` (lines 138, 168)
- `onAlert` fires only when `actionItems.length > 0` (scheduler.ts line 171)
- `send(socket, { type: "heartbeat.alert", ... })` matches `HeartbeatAlertSchema` in protocol.ts

**Status: GAP CLOSED**

## Required Artifacts — Regression Check

### Plan 08-01: DB Schemas & Zod Types

| Artifact | Status |
|---|---|
| `packages/db/src/schema/workflows.ts` | VERIFIED (exists, unchanged) |
| `packages/db/src/schema/schedules.ts` | VERIFIED (exists, unchanged) |
| `packages/db/src/schema/index.ts` | VERIFIED (barrel exports intact) |
| `packages/gateway/src/workflow/types.ts` | VERIFIED (exists, unchanged) |
| `packages/gateway/src/scheduler/types.ts` | VERIFIED (exists, unchanged) |

### Plan 08-02: Workflow Engine

| Artifact | Status |
|---|---|
| `packages/gateway/src/workflow/loader.ts` | VERIFIED (exists, unchanged) |
| `packages/gateway/src/workflow/templates.ts` | VERIFIED (exists, unchanged) |
| `packages/gateway/src/workflow/state.ts` | VERIFIED (exists, unchanged) |
| `packages/gateway/src/workflow/executor.ts` | VERIFIED (exists, unchanged) |
| `packages/gateway/src/workflow/engine.ts` | VERIFIED (exists, unchanged) |
| `packages/gateway/src/workflow/index.ts` | VERIFIED (barrel exports intact) |

### Plan 08-03: Cron Scheduler & Heartbeat

| Artifact | Status |
|---|---|
| `packages/gateway/src/scheduler/store.ts` | VERIFIED (exists, unchanged) |
| `packages/gateway/src/scheduler/heartbeat.ts` | VERIFIED (exists; now called from handlers.ts via scheduleHeartbeat) |
| `packages/gateway/src/scheduler/scheduler.ts` | VERIFIED (exists; scheduleHeartbeat now wired from protocol path) |
| `packages/gateway/src/scheduler/index.ts` | VERIFIED (barrel exports intact) |

### Plan 08-04: WebSocket Protocol

| Artifact | Status |
|---|---|
| `packages/gateway/src/ws/protocol.ts` | VERIFIED (9 client + 9 server schemas; HeartbeatConfigureSchema includes heartbeatPath field) |
| `packages/gateway/src/ws/handlers.ts` | VERIFIED (20 exported handlers; handleHeartbeatConfigure now substantive — calls scheduleHeartbeat, sends heartbeat.alert) |
| `packages/gateway/src/ws/server.ts` | VERIFIED (9 switch cases for Phase 8 messages confirmed; all dispatch to correct handlers) |
| `packages/gateway/src/ws/connection.ts` | VERIFIED (pendingWorkflowApprovals Map in ConnectionState, unchanged) |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `db/schema/index.ts` | `db/schema/workflows.ts` | barrel export | VERIFIED | Unchanged from initial verification |
| `db/schema/index.ts` | `db/schema/schedules.ts` | barrel export | VERIFIED | Unchanged from initial verification |
| `workflow/engine.ts` | `workflow/executor.ts` | executeStep call | VERIFIED | Unchanged |
| `workflow/engine.ts` | `workflow/state.ts` | saveExecution after step | VERIFIED | Unchanged |
| `workflow/executor.ts` | `workflow/templates.ts` | resolveTemplates | VERIFIED | Unchanged |
| `scheduler/scheduler.ts` | `scheduler/store.ts` | loadSchedules on reload | VERIFIED | Unchanged |
| `scheduler/scheduler.ts` | `workflow/engine.ts` | workflowEngine.execute on cron | VERIFIED | Unchanged |
| `ws/handlers.ts` | `workflow/engine.ts` | workflowEngine in handleWorkflowTrigger | VERIFIED | Unchanged |
| `ws/handlers.ts` | `scheduler/scheduler.ts` | cronScheduler in handleScheduleCreate | VERIFIED | Unchanged |
| `ws/server.ts` | `ws/handlers.ts` | handler dispatch in switch | VERIFIED | 9 switch cases confirmed |
| `ws/handlers.ts` | `scheduler/heartbeat.ts` (via scheduleHeartbeat) | heartbeat alert flow | WIRED | `handleHeartbeatConfigure` calls `cronScheduler.scheduleHeartbeat()` which instantiates `HeartbeatRunner`; `onAlert` sends `heartbeat.alert` via `send(socket, ...)` |

## Anti-Patterns Found

| File | Location | Pattern | Severity | Impact |
|---|---|---|---|---|
| `packages/gateway/src/ws/handlers.ts` | Lines 890, 961 | `resolve: () => {}` in pendingWorkflowApprovals | WARNING | The stored `resolve` function is a no-op; approval flow works via `workflowEngine.resume()` not promise resolution. Misleading but not a functional blocker. |

No new anti-patterns introduced by the gap closure. The previous BLOCKER anti-pattern (stub heartbeat handler) has been resolved.

## Human Verification Required

### 1. Workflow Approval Gate Round-Trip

**Test:** Send `workflow.trigger` for a workflow where step 1 has `approvalRequired: true`. Observe `workflow.approval.request` from server. Send `workflow.approval` with `approved: true`. Verify `workflow.status` shows `completed`.
**Expected:** The workflow pauses, sends approval request, resumes after approval message, and completes.
**Why human:** The `resolve: () => {}` stub at lines 890/961 in `pendingWorkflowApprovals` is suspicious. Approval state flows through `workflowEngine.resume()` not promise resolution, but the end-to-end round-trip across two WebSocket messages needs runtime confirmation.

### 2. Active Hours Guard Behavior

**Test:** Create a schedule (or heartbeat) with `activeHours` set to a window excluding the current time. Trigger or wait for the cron to fire.
**Expected:** Scheduler logs "skipped: outside active hours" and no workflow execution or heartbeat alert is sent.
**Why human:** Time-dependent behavior cannot be verified statically.

### 3. Heartbeat Alert Delivery End-to-End

**Test:** Send `heartbeat.configure` with a valid `heartbeatPath` pointing to a HEARTBEAT.md file containing checklist items. Wait for the configured interval. Verify a `heartbeat.alert` message is received when action-needed items exist.
**Expected:** The AI evaluates each checklist item in HEARTBEAT.md, and `heartbeat.alert` arrives with `checks` array containing only `actionNeeded: true` items.
**Why human:** Requires a running gateway with valid AI model credentials, a real HEARTBEAT.md file, and waiting for the cron interval to fire.

## Requirements Coverage

| Requirement Group | Status | Notes |
|---|---|---|
| WKFL-01/02: Multi-step workflow with branching | SATISFIED | Engine executes sequential/branching steps; tool/model/noop actions |
| WKFL-03/04: Approval gates and step result chaining | SATISFIED | approvalRequired pause/resume flow; `{{steps.X.result}}` template chaining |
| WKFL-05/06: Heartbeat monitoring with alerts | SATISFIED | HeartbeatRunner now wired via scheduleHeartbeat; heartbeat.alert fires when actionNeeded items exist |
| WKFL-07: Active hours filtering | SATISFIED | isWithinActiveHours guard in scheduleHeartbeat; activeHours field in HeartbeatConfigureSchema |
| WKFL-08: Cron scheduling | SATISFIED | schedule.create/update/delete/list fully wired; Croner jobs with maxRuns for one-shot |

## Re-verification Summary

All 5 success criteria are now verified. The single gap from the initial verification — the heartbeat handler stub — has been fully resolved:

- `handleHeartbeatConfigure` calls `cronScheduler.scheduleHeartbeat()` (not `cronScheduler.schedule()`)
- `HeartbeatRunner` is instantiated with `msg.heartbeatPath`
- The `onAlert` callback sends `heartbeat.alert` to the WebSocket client
- Active hours guard is active via `isWithinActiveHours()` inside `scheduleHeartbeat`
- No regressions detected in any previously-verified artifact

Three items require human runtime verification: the approval gate round-trip (suspicious no-op resolve pattern), active hours time-dependent behavior, and heartbeat alert delivery requiring a live AI model and HEARTBEAT.md file.

---

_Verified: 2026-02-16_
_Verifier: Claude (gsd-verifier)_
