---
phase: 24-tools-actually-working
verified: 2026-02-20T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 24: Tools Actually Working — Verification Report

**Phase Goal:** Fix the 3 root causes preventing agent tools from working in production: (1) workspace directory never created so file writes fail with ENOENT, (2) agent tool loop doesn't save assistant responses to session history so agent re-introduces itself every turn, (3) tool failures can cause the agent to go silent with no response to the user
**Verified:** 2026-02-20T00:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Agent can write files to workspace on first use (directory auto-created) | VERIFIED | `buildToolRegistry` calls `await mkdir(workspaceDir, { recursive: true })` at lines 71–73 of `tool-registry.ts` before any tools are instantiated |
| 2 | Agent remembers conversation history across tool-using turns (no re-introduction) | VERIFIED | `handleChatSend` captures `const agentResponse = await runAgentLoop(...)` at line 431 and calls `sessionManager.addMessage(sessionId, "assistant", agentResponse)` at line 468 of `handlers.ts` |
| 3 | When tools fail, agent responds with error explanation instead of going silent | VERIFIED | `tool-loop.ts` lines 232–241: after fullStream loop, if `!fullText || fullText.trim().length === 0`, a fallback delta is sent via `transport.send` and `fullText` is set to the fallback string before returning |
| 4 | write_file to nested paths (e.g. "subdir/file.txt") creates parent directories | VERIFIED | `filesystem.ts` line 76: `await mkdir(dirname(path), { recursive: true })` executed after `checkWorkspace` and before `writeFile` in the `write_file` tool |
| 5 | Agent tool loop saves assistant response to session after tool execution completes | VERIFIED | Both `handleChatSend` (line 467–469) and `handlePreflightApproval` (lines 885–887) in `handlers.ts` persist `agentResponse` via `sessionManager.addMessage(sessionId, "assistant", agentResponse)` after `runAgentLoop` returns |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Provided | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|----------------------|----------------|--------|
| `packages/gateway/src/tools/filesystem.ts` | write_file with mkdir(dirname(path)) before writeFile | Yes | Yes — line 76: `await mkdir(dirname(path), { recursive: true })` present; `mkdir` and `dirname` imported at lines 3–4 | Yes — called from `buildToolRegistry` via `createFilesystemTools(securityMode, workspaceDir)` | VERIFIED |
| `packages/gateway/src/agent/tool-registry.ts` | Workspace directory auto-creation at buildToolRegistry start | Yes | Yes — lines 70–73: `if (workspaceDir) { await mkdir(workspaceDir, { recursive: true }); }` present; `mkdir` imported at line 3 | Yes — `buildToolRegistry` is called by the ws handler on every agent request; mkdir fires before `createFilesystemTools` | VERIFIED |
| `packages/gateway/src/agent/tool-loop.ts` | Text accumulation with `fullText`; fallback when empty; `Promise<string>` return type | Yes | Yes — `let fullText = ""` at line 62; `fullText += part.text` at line 108; fallback block at lines 232–241; `return fullText` at line 243; function signature: `Promise<string>` at line 42 | Yes — return value captured as `agentResponse` in both handler call sites | VERIFIED |
| `packages/gateway/src/ws/handlers.ts` | Session persistence of assistant response after agent loop (`sessionManager.addMessage`) | Yes | Yes — `const agentResponse = await runAgentLoop(...)` at lines 431 and 849; `sessionManager.addMessage(sessionId, "assistant", agentResponse)` at lines 467–469 and 885–887 | Yes — `sessionManager` imported and active; calls mirror the existing `streamToClient` pattern at lines 200–204 | VERIFIED |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `tool-registry.ts` | `filesystem.ts` | `workspaceDir` passed to `createFilesystemTools(securityMode, workspaceDir)` at line 78 | WIRED | Line 78: `const fsTools = createFilesystemTools(securityMode, workspaceDir);` — workspace dir threading confirmed |
| `tool-loop.ts` | `handlers.ts` | `runAgentLoop` returns `Promise<string>`; captured as `agentResponse` | WIRED | Function signature line 42: `export async function runAgentLoop(options: AgentLoopOptions): Promise<string>`. Captured at `handlers.ts` lines 431 and 849 |
| `handlers.ts` | `sessionManager` | `addMessage` called after agent loop completes with `"assistant"` role | WIRED | Lines 467–469: `if (agentResponse) { sessionManager.addMessage(sessionId, "assistant", agentResponse); }`. Lines 885–887: identical call in preflight handler |

---

### Requirements Coverage

Phase 24 plans declare `SC-1` through `SC-5` as requirement IDs. These are phase-local success criteria IDs drawn directly from the ROADMAP.md success criteria array — they are **not entries in REQUIREMENTS.md**. No Phase 24 entries appear in the REQUIREMENTS.md traceability table (the table maps to earlier roadmap phases for features like AGNT-09 "file read/write"). This is consistent: phase 24 is a bug-fix phase correcting implementation defects in previously delivered features, not a new capability delivery. No REQUIREMENTS.md IDs are orphaned or unaccounted for.

| SC ID | Description | Status | Evidence |
|-------|-------------|--------|----------|
| SC-1 | Agent can write files to workspace on first use (directory auto-created) | SATISFIED | `mkdir(workspaceDir, { recursive: true })` in `buildToolRegistry` before fs tools instantiated |
| SC-2 | Agent remembers conversation history across tool-using turns (no re-introduction) | SATISFIED | `sessionManager.addMessage` called with `agentResponse` after every `runAgentLoop` invocation |
| SC-3 | When tools fail, agent responds with error explanation instead of going silent | SATISFIED | Fallback text block in `tool-loop.ts` guarantees non-empty response when `fullText` is empty post-loop |
| SC-4 | write_file to nested paths creates parent directories | SATISFIED | `mkdir(dirname(path), { recursive: true })` called before `writeFile` inside `write_file.execute` |
| SC-5 | Agent tool loop saves assistant response to session after tool execution completes | SATISFIED | `runAgentLoop` returns `Promise<string>`; both call sites in handlers capture and persist |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/gateway/src/ws/handlers.ts` | 951 | `resolve: () => {}` with comment "placeholder; actual resolve set below" | Info | Pre-existing code in workflow approval handler, unrelated to phase 24 changes. Not a stub — the actual resolve is overwritten immediately after in the same block |

No anti-patterns were introduced by phase 24.

---

### Human Verification Required

#### 1. First-use workspace creation end-to-end

**Test:** Configure an agent with `securityMode: "limited-control"` and a `workspaceDir` pointing to a directory that does not yet exist. Send a message asking the agent to write a file. Check that the workspace directory was created and the file exists.
**Expected:** No ENOENT error; directory created; file written.
**Why human:** Requires a live gateway process with configured workspace path.

#### 2. Conversation continuity after tool-using turn

**Test:** In an active CLI or Telegram session, ask the agent to use a tool (e.g. "write hello to hello.txt"). In the immediately following message, ask "what is my name?" without re-introducing yourself.
**Expected:** Agent responds with correct name from session history — does not re-introduce itself or ask for context again.
**Why human:** Session memory depends on the full request/response cycle at runtime; cannot be verified from static grep.

#### 3. Silent-failure fallback rendered to user

**Test:** Configure an agent with a tool that is guaranteed to fail (e.g. filesystem tool with an invalid workspace path but without the new mkdir fix, or use a test tool that always throws). Trigger the agent to call that tool.
**Expected:** Agent sends a visible fallback message explaining the failure rather than producing an empty response.
**Why human:** Requires a controlled failure scenario in a running agent session.

---

### Gaps Summary

No gaps. All 5 success criteria verified against the actual codebase. TypeScript compiles without errors (`npx tsc --noEmit -p packages/gateway/tsconfig.json` exits clean). All key links wired. No stubs or placeholder implementations introduced by this phase.

---

## Summary

Phase 24 goal is achieved. All 3 root causes have substantive fixes:

- **Root Cause 1 (ENOENT on workspace):** Fixed in `tool-registry.ts` with `mkdir(workspaceDir, { recursive: true })` at registry build time, and in `filesystem.ts` `write_file` with `mkdir(dirname(path), { recursive: true })` before every write.
- **Root Cause 2 (re-introduction per turn):** Fixed by changing `runAgentLoop` return type to `Promise<string>`, accumulating text in `fullText`, and having both `handleChatSend` and `handlePreflightApproval` call `sessionManager.addMessage` after the loop.
- **Root Cause 3 (silent failure):** Fixed by the fallback text block after the `fullStream` loop in `tool-loop.ts` that sends a `chat.stream.delta` when `fullText` is empty.

---

_Verified: 2026-02-20T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
