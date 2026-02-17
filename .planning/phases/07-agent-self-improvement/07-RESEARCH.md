# Phase 7: Agent Self-Improvement - Research

**Researched:** 2026-02-16
**Domain:** Agent introspection, skill authoring, PTY terminal proxy
**Confidence:** MEDIUM (architecture confirmed; some API details LOW for novel integration patterns)

---

## Summary

Phase 7 spans three distinct technical domains that must be integrated into the existing AgentSpace monorepo: (1) failure pattern detection within the running agent tool loop, (2) agent-authored skill authoring with sandbox testing and user-approval gates, and (3) a PTY-based terminal proxy mode that lets the CLI pass control to interactive programs like vim, git rebase, and debuggers while optionally letting the agent observe and interact.

The existing codebase is well-positioned for all three. The `runAgentLoop` in `packages/gateway/src/agent/tool-loop.ts` already iterates over `fullStream` events and has per-step visibility — failure detection is an instrumentation concern layered on top of existing step events, not a rewrite. The `discoverSkills` / `LoadedSkill` types in `packages/core` already define the SKILL.md format; skill authoring is new authoring tooling that produces files in that format, plus a sandbox (`child_process` with a temp dir) and an approval gate modeled after the existing `preflight.approval` flow. For terminal proxy, `node-pty` v1.1.0 is the established standard (used by VS Code, Warp, and 29,800+ dependents); the Ink CLI must temporarily surrender raw-mode control and route stdin/stdout through the PTY, then restore itself when the subprocess exits.

**Primary recommendation:** Implement AGNT-06/07/08 in the gateway as new agent-loop instrumentation and a `skill.author` tool; implement CLI-05/06 as a `/proxy` command that spawns node-pty sessions and suspends Ink rendering while the PTY is active.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node-pty` | `^1.1.0` | Spawn PTY processes (vim, git, etc.) | Microsoft-maintained; used by VS Code, Warp, Hyper; 29k+ dependents |
| `ai` (AI SDK) | `^6.0.86` (already installed) | `streamText` with `onStepFinish` for failure detection | Already in codebase; fullStream provides per-step tool results |
| `gray-matter` | `^4.0.3` (already installed) | Parse SKILL.md frontmatter for authored skills | Already in core; existing skill loader uses it |
| `node:fs`, `node:os`, `node:path` | Node built-ins | Temp dir for sandbox, writing new SKILL.md files | No extra deps needed |
| `execa` | `^9.6.1` (already installed) | Run sandbox test shell commands | Already in gateway |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:child_process` (built-in) | Node built-in | Spawn sandboxed skill test in isolated subprocess | Safer than vm2; no trust boundary needed for SKILL.md content |
| `@inkjs/ui` | `^2.0.0` (already installed) | UI components for skill approval prompt | Already used in CLI |
| `tmp` or `node:os.tmpdir()` | Built-in | Temporary directory for skill sandbox tests | `os.tmpdir()` + `crypto.randomUUID()` is sufficient — no extra dep |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node-pty` for PTY | `xterm-headless` + native PTY | xterm-headless adds a DOM emulation layer; node-pty is lower-level and already the standard for Node CLI tools |
| `child_process` for sandbox | `vm2` or `isolated-vm` | vm2 has active CVEs (CVE-2026-22709); skills are markdown text, not executable code — sandbox just needs an isolated FS dir, not a JS VM |
| `node-pty` PTY session in gateway | PTY session entirely in CLI | PTY sessions must live in the CLI process because node-pty requires a real TTY stdin/stdout; gateway doesn't have a terminal |

**Installation (new deps only):**
```bash
# In packages/cli
pnpm add node-pty
pnpm add -D @types/node-pty  # if separate typings needed; node-pty 1.1.0 ships its own typings
```

---

## Architecture Patterns

### Recommended Project Structure (additions to existing)

```
packages/
├── gateway/src/
│   ├── agent/
│   │   ├── tool-loop.ts          # EXISTING — add onStepFinish failure tracking
│   │   ├── failure-detector.ts   # NEW — classifies failure patterns from step history
│   │   ├── skill-author.ts       # NEW — agent tool: draft + test + propose skill
│   │   └── skill-sandbox.ts      # NEW — runs skill test script in temp dir
│   └── tools/
│       └── skill.ts              # NEW — AI SDK tool() wrappers for skill authoring
├── cli/src/
│   ├── commands/
│   │   └── chat.ts               # EXISTING — add --proxy flag or proxy subcommand
│   ├── components/
│   │   ├── SkillApprovalPrompt.tsx  # NEW — render proposed skill for user review
│   │   └── ProxyMode.tsx           # NEW — renders PTY mode indicator; Ink suspends
│   └── lib/
│       └── pty-proxy.ts           # NEW — node-pty spawn/teardown, stdin routing
└── core/src/
    └── skills/
        ├── types.ts               # EXISTING — LoadedSkill, SkillMetadata (no changes needed)
        ├── loader.ts              # EXISTING — discoverSkills (no changes needed)
        └── writer.ts              # NEW — writeSkill(dir, metadata, instructions) → SKILL.md
```

### Pattern 1: Failure Detection via onStepFinish

**What:** Instrument the AI SDK `streamText` call in `runAgentLoop` with `onStepFinish` to accumulate tool-result history. After each step, classify whether a failure pattern has emerged (repeated identical tool call, same error N times, non-progress).

**When to use:** Invoked automatically within the existing `runAgentLoop`; no new entry points needed.

**Example:**
```typescript
// Source: AI SDK v6 docs (ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
// packages/gateway/src/agent/tool-loop.ts (modified)

import { classifyFailurePattern } from "./failure-detector.js";

const stepHistory: StepRecord[] = [];

const result = streamText({
  model: languageModel,
  messages,
  system,
  tools: tools as any,
  stopWhen: stepCountIs(maxSteps),
  onStepFinish: async ({ stepType, finishReason, toolCalls, toolResults, text }) => {
    stepHistory.push({ stepType, finishReason, toolCalls, toolResults, text });

    const failure = classifyFailurePattern(stepHistory);
    if (failure) {
      // Emit failure.detected server message over WS
      send(socket, {
        type: "failure.detected",
        requestId,
        pattern: failure.pattern,
        description: failure.description,
        suggestedAction: failure.suggestedAction,
      });
    }
  },
});
```

### Pattern 2: Failure Classification

**What:** A pure function that inspects the accumulated step history and returns a structured failure pattern if one is detected. Keeps the loop code clean; all classification logic lives in `failure-detector.ts`.

**Failure classes to detect:**
- `repeated-tool-error`: Same tool called 3+ times with the same error output
- `no-progress`: 3+ steps with `finishReason: "tool-calls"` but no new content in tool results (empty stdout/stderr repeated)
- `max-steps-approaching`: `stepHistory.length >= maxSteps - 1` with task not complete
- `tool-rejection-loop`: Same tool denied approval N times in sequence

**Example:**
```typescript
// Source: AI SDK v6 docs, step history analysis pattern
// packages/gateway/src/agent/failure-detector.ts

export interface FailurePattern {
  pattern: "repeated-tool-error" | "no-progress" | "max-steps-approaching" | "tool-rejection-loop";
  description: string;
  suggestedAction: string;
  affectedTool?: string;
}

export function classifyFailurePattern(steps: StepRecord[]): FailurePattern | null {
  // Check last 3 steps for repeated tool error
  const recent = steps.slice(-3);
  if (recent.length >= 3) {
    const toolNames = recent.flatMap(s => s.toolCalls?.map(tc => tc.toolName) ?? []);
    const toolResults = recent.flatMap(s => s.toolResults ?? []);
    // ... classification logic
  }
  return null;
}
```

### Pattern 3: Skill Authoring Tool (AGNT-07)

**What:** An AI SDK `tool()` that the agent can call to draft a new SKILL.md. The tool takes a name, description, and instructions, writes to a temp directory, runs an optional test script, then emits a `skill.proposed` WS message. The client shows `SkillApprovalPrompt`. On approval, `skill.register` copies from temp to the workspace skills dir.

**Two-tool design:**
- `skill_draft`: Agent calls this to write a SKILL.md to temp dir
- `skill_register`: Agent calls this only after user approval (flagged as requiring approval)

**Example:**
```typescript
// Source: AI SDK v6 tool() pattern, existing shell.ts as reference
// packages/gateway/src/tools/skill.ts

import { tool } from "ai";
import { z } from "zod";

export function createSkillDraftTool(tempDir: string) {
  return tool({
    description: "Draft a new skill as a SKILL.md file in a sandbox directory for user review.",
    inputSchema: z.object({
      name: z.string().describe("Machine-readable skill name (slug format)"),
      description: z.string().describe("One-sentence description of what this skill does"),
      tier: z.enum(["workspace", "managed"]).default("workspace"),
      instructions: z.string().describe("Full markdown instructions for the skill"),
    }),
    execute: async ({ name, description, tier, instructions }) => {
      const skillPath = await writeSkillToSandbox(tempDir, { name, description, tier }, instructions);
      return { skillPath, name, status: "drafted" };
    },
  });
}
```

### Pattern 4: PTY Proxy Mode (CLI-05/CLI-06)

**What:** The CLI's Ink rendering is suspended while a PTY subprocess (vim, git rebase, etc.) has control of the terminal. The PTY is spawned with `node-pty`, which inherits stdin/stdout directly. Ink is re-rendered after the process exits.

**Key insight:** Ink cannot share a TTY with a raw PTY process simultaneously. The pattern is: `process.stdout.write('\x1b[?25h')` to show cursor → `exit()` the Ink app (or unmount and re-render) → spawn PTY → wait for PTY exit → re-render Ink. The cleanest approach is: Ink CLI invokes a separate helper that runs the PTY, waits for it, then restarts the Ink session.

**Alternatively (simpler):** The `/proxy <command>` slash command writes the TTY dimensions to the gateway, which responds with a `terminal.proxy.start` message, then the CLI exits Ink, spawns the PTY locally, and reconnects Ink after PTY exit.

**Example:**
```typescript
// Source: node-pty README, microsoft/node-pty GitHub
// packages/cli/src/lib/pty-proxy.ts

import * as pty from "node-pty";
import * as os from "node:os";

export interface PtyProxyOptions {
  command: string;
  args?: string[];
  cwd?: string;
  cols?: number;
  rows?: number;
}

export async function runPtyProxy(opts: PtyProxyOptions): Promise<number> {
  return new Promise((resolve) => {
    const ptyProcess = pty.spawn(opts.command, opts.args ?? [], {
      name: "xterm-color",
      cols: opts.cols ?? process.stdout.columns ?? 80,
      rows: opts.rows ?? process.stdout.rows ?? 24,
      cwd: opts.cwd ?? process.cwd(),
      env: process.env as Record<string, string>,
    });

    // Forward PTY output to stdout
    ptyProcess.onData((data) => process.stdout.write(data));

    // Forward stdin to PTY
    process.stdin.setRawMode(true);
    process.stdin.on("data", (data) => ptyProcess.write(data.toString()));

    // Handle resize
    process.stdout.on("resize", () => {
      ptyProcess.resize(process.stdout.columns, process.stdout.rows);
    });

    ptyProcess.onExit(({ exitCode }) => {
      process.stdin.setRawMode(false);
      resolve(exitCode ?? 0);
    });
  });
}
```

### Pattern 5: Agent Observes PTY Session (CLI-06)

**What:** When the agent is given control of a PTY session, it receives terminal snapshots (the raw PTY output buffer) over WebSocket as `terminal.snapshot` messages, and can send `terminal.input` messages to inject keystrokes. This is modeled after the Warp / Pilotty pattern.

**Design:** The CLI holds the PTY process. The agent (gateway) doesn't hold the PTY. Instead:
1. CLI emits `terminal.snapshot` events over WS whenever the PTY produces output.
2. Agent sends `terminal.input` messages with keystrokes to type.
3. CLI forwards those keystrokes to `ptyProcess.write(data)`.
4. User can reclaim control with `Ctrl+\` (SIGQUIT), which stops forwarding agent input.

### Anti-Patterns to Avoid

- **Running PTY in the gateway process:** The gateway is headless; node-pty requires a real TTY. PTY must live in the CLI.
- **Using vm2 for skill sandbox:** vm2 has a critical 2026 CVE and sandbox escapes. Skills are markdown, not JS — use a temp directory + subprocess execution for any validation scripts.
- **Detecting failure from text content alone:** Don't parse the streamed text for error keywords. Use `finishReason` and `toolResults` from `onStepFinish` — they're structured.
- **Blocking the entire Ink render loop during PTY:** Ink and PTY cannot share stdin simultaneously. Must unmount/re-render Ink, not just pause.
- **Writing authored skills directly to managed tier:** Agent-authored skills always go to workspace tier (`.agentspace/skills/`) first; never the global managed tier.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spawning PTY processes | Custom fork/exec wrapper | `node-pty` v1.1.0 | Handles ConPTY (Windows), signal routing, resize events, flow control |
| Terminal screen capture for agent observation | ANSI parser from scratch | Buffer the raw `onData` strings (VT100 passthrough is sufficient for LLM observation) | The agent can reason over raw ANSI; a full VT100 parser is unnecessary complexity |
| Sandboxed skill execution | vm2, isolated-vm, Worker threads | `child_process.execFile` in a temp dir | Skills are markdown instructions, not arbitrary code; the sandbox just needs filesystem isolation |
| Failure classification ML | Embedding similarity search | Simple rule-based heuristics on structured `StepRecord[]` | Tool results are already structured JSON; pattern matching over 3-5 steps is fast and reliable |

**Key insight:** The skill sandbox does not need JavaScript isolation. A skill is a SKILL.md file with instructions. If the agent wants to "test" the skill, it means: write the SKILL.md, then run the agent loop with it injected as context on a test prompt. This is just another `runAgentLoop` call in a temporary session.

---

## Common Pitfalls

### Pitfall 1: Ink Raw Mode Conflict with node-pty

**What goes wrong:** When node-pty spawns a subprocess that takes over the TTY, Ink still has `setRawMode(true)` on stdin. Both Ink and the PTY try to own raw mode, causing garbled input, double keystrokes, or deadlocks.

**Why it happens:** Ink enables raw mode for the entire life of the `render()` call. node-pty also needs exclusive raw-mode access.

**How to avoid:** Unmount the Ink app (`unmount()`) before spawning the PTY subprocess. After PTY exit, re-call `render(<Chat .../>)` to restart Ink. The `useApp().exit()` hook calls `unmount()` and clears raw mode. Do NOT use `process.stdin.setRawMode(false)` manually before calling exit — let Ink clean up via its reference counting.

**Warning signs:** Keystrokes appear twice, terminal does not restore after PTY exits, Ink crashes with "Raw mode is not supported".

### Pitfall 2: node-pty Requires Native Compilation

**What goes wrong:** `npm install node-pty` fails on CI, Docker, or machines without Xcode/build-essential. This blocks the CLI build entirely.

**Why it happens:** node-pty is a native Node.js addon compiled with node-gyp (C++ via POSIX forkpty).

**How to avoid:** Add to CI: `xcode-select --install` (macOS) or `apt-get install -y build-essential python3` (Linux). On macOS developers should have Xcode command line tools already (required for most Node.js native modules). Document as a prerequisite. Do not attempt to use pre-built binaries — they are version-locked.

**Warning signs:** `node-gyp` errors during install, `MODULE_NOT_FOUND` for `node_modules/node-pty/build/Release/pty.node`.

### Pitfall 3: AI SDK onStepFinish is Called Asynchronously Mid-Stream

**What goes wrong:** If `onStepFinish` sends a WS message (`failure.detected`) while `runAgentLoop` is still running, the client receives the failure notification but the agent loop continues. The loop doesn't stop automatically on failure detection.

**Why it happens:** `onStepFinish` is informational — it does not stop the stream. `stopWhen` controls stopping.

**How to avoid:** Use a shared mutable flag (`let failureDetected = false`) between `onStepFinish` and a custom `stopWhen` condition. Alternatively, emit the `failure.detected` message but let the agent loop continue — the agent reads the failure in its context and can self-correct. The WS message is a notification, not an interrupt.

**Warning signs:** Agent keeps calling the same failing tool after `failure.detected` is emitted.

### Pitfall 4: Skill Approval Gate Must Block skill_register Tool

**What goes wrong:** The agent calls `skill_draft` then immediately calls `skill_register` in the same loop iteration, bypassing user review.

**Why it happens:** Both tools are registered with the same approval policy. If `skill_draft` has `tier: "auto"` and `skill_register` has `tier: "always"`, the agent needs approval for register but can draft freely.

**How to avoid:** `skill_register` must have `ApprovalTier = "always"` in the per-tool config. The approval flow is already implemented in the gateway — just add `"skill_register": "always"` to the `perTool` map. The user will see the `ToolApprovalPrompt` before the skill is written to the workspace skills directory.

**Warning signs:** Skills appear in the skills directory without user ever seeing the approval prompt.

### Pitfall 5: vm2 / Node.js vm Module Security for Skill Sandbox

**What goes wrong:** Using `vm2` or Node.js `vm.runInContext` to execute skill "test scripts" that the agent drafts. Critical sandbox escapes exist in vm2 (CVE-2026-22709, CVSS 9.8).

**Why it happens:** Temptation to run agent-generated scripts in-process for speed.

**How to avoid:** Skills are SKILL.md markdown, not executable scripts. The "sandbox test" for a skill means: create a temp Drizzle session, inject the skill instructions into system context, run a short `generateText` call with that skill injected. No arbitrary code execution needed.

**Warning signs:** Planning tasks that mention vm2, `vm.runInContext`, or `eval` for skill testing.

### Pitfall 6: PTY Sessions in Gateway vs CLI

**What goes wrong:** Attempting to spawn the PTY in the gateway (Fastify) process because the agent lives there.

**Why it happens:** It seems natural — agent wants terminal access, gateway has the agent.

**How to avoid:** PTY requires a real TTY; the gateway is a headless server. PTY must live in the CLI process. The gateway can send `terminal.proxy.start` events telling the CLI what command to run, and receive `terminal.snapshot` events back. Agent-controlled input goes: gateway → WS → CLI → `ptyProcess.write()`.

---

## Code Examples

Verified patterns from official sources:

### node-pty: Spawn and Route stdin/stdout

```typescript
// Source: microsoft/node-pty README + deepwiki.com/microsoft/node-pty/1.1-installation
import * as pty from "node-pty";
import * as os from "node:os";

const shell = os.platform() === "win32" ? "powershell.exe" : "bash";

const ptyProcess = pty.spawn(shell, [], {
  name: "xterm-color",
  cols: process.stdout.columns ?? 80,
  rows: process.stdout.rows ?? 24,
  cwd: process.env.HOME ?? process.cwd(),
  env: process.env as Record<string, string>,
});

// Forward PTY output to user's terminal
ptyProcess.onData((data: string) => {
  process.stdout.write(data);
});

// Forward user input to PTY
process.stdin.setRawMode(true);
process.stdin.on("data", (data: Buffer) => {
  ptyProcess.write(data.toString());
});

// Handle terminal resize
process.stdout.on("resize", () => {
  ptyProcess.resize(process.stdout.columns, process.stdout.rows);
});

ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
  process.stdin.setRawMode(false);
  console.log(`Process exited with code ${exitCode}`);
});
```

### node-pty TypeScript Interface (IPty)

```typescript
// Source: deepwiki.com/microsoft/node-pty/1.1-installation (HIGH confidence)
interface IPty {
  readonly pid: number;
  readonly cols: number;
  readonly rows: number;
  readonly process: string;
  handleFlowControl: boolean;
  readonly onData: IEvent<string>;    // IEvent<T> is an event emitter abstraction
  readonly onExit: IEvent<{ exitCode: number; signal?: number }>;

  write(data: string): void;
  resize(columns: number, rows: number): void;
  clear(): void;
  kill(signal?: string): void;
  pause(): void;
  resume(): void;
}
```

### AI SDK streamText with onStepFinish

```typescript
// Source: ai-sdk.dev/docs/reference/ai-sdk-core/stream-text (HIGH confidence)
const result = streamText({
  model: languageModel,
  messages,
  system,
  tools: tools as any,
  stopWhen: stepCountIs(maxSteps),
  onStepFinish: async ({
    stepType,        // "initial" | "continue" | "tool-result"
    finishReason,    // "stop" | "tool-calls" | "error" | "length" | etc.
    toolCalls,       // Array of tool calls in this step
    toolResults,     // Array of tool results in this step
    text,            // Generated text for this step
    usage,           // Token counts
  }) => {
    // Accumulate step history for failure detection
    stepHistory.push({ stepType, finishReason, toolCalls, toolResults, text });
  },
});
```

### Writing a SKILL.md file

```typescript
// Source: packages/core/src/skills/loader.ts (existing) + gray-matter docs
// packages/core/src/skills/writer.ts (new)
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type { SkillMetadata } from "./types.js";

export function writeSkill(
  skillsDir: string,
  metadata: SkillMetadata,
  instructions: string,
): string {
  const skillDir = join(skillsDir, metadata.name);
  mkdirSync(skillDir, { recursive: true });

  const content = matter.stringify(instructions, {
    name: metadata.name,
    description: metadata.description,
    tier: metadata.tier ?? "workspace",
    version: metadata.version ?? "1.0.0",
    tools: metadata.tools ?? [],
    triggers: metadata.triggers ?? [],
  });

  const skillPath = join(skillDir, "SKILL.md");
  writeFileSync(skillPath, content, "utf-8");
  return skillPath;
}
```

### Ink app teardown before PTY spawn

```typescript
// Source: Ink docs (vadimdemedes/ink) - useApp().exit() pattern
// packages/cli/src/lib/pty-proxy.ts

import { render } from "ink";

// Inside a slash command handler or component:
// 1. Exit Ink (clears raw mode via ref counting)
exit(); // from useApp()

// 2. After Ink has unmounted (next tick), spawn PTY
process.nextTick(async () => {
  const exitCode = await runPtyProxy({ command: cmd, args });

  // 3. Ink will need to be re-rendered by the CLI bootstrap
  //    (re-call render() from the chat command entrypoint)
  process.exit(exitCode);
  // OR: re-render Ink with a fresh render() call
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual terminal mux (tmux attach) for agent control | PTY proxy with agent snapshot/input API (Warp, Pilotty) | 2024-2025 | Agents can observe and interact with interactive CLI apps without screen scraping |
| vm2 for JS sandboxing | child_process + temp dir, or isolated-vm for JS isolation | 2023-2026 (vm2 CVEs) | vm2 abandoned; don't use it for anything |
| Separate reflection LLM call for failure analysis | In-loop `onStepFinish` hook with `finishReason` + `toolResults` | AI SDK v4+ | Structured step data replaces need for unstructured text parsing |
| Skill files hand-authored by humans only | Agent-drafted skills via structured tool call, then user approval | 2024-2025 (Anthropic Claude Code, Cursor) | Skills become self-extending; approval gate is the human-in-the-loop safety mechanism |

**Deprecated/outdated:**
- `generateObject` standalone call: deprecated in AI SDK v6 in favor of `generateText` with `output` property. BUT the existing `preflight.ts` uses `generateObject` which still works — for Phase 7, new uses should use `generateText` with `output: "object"` instead if drafting new LLM calls.
- `xterm-headless` for terminal state: last published 2+ years ago; not needed for this use case.

---

## Open Questions

1. **PTY session handoff: should the CLI re-render Ink after PTY exit, or exit the CLI process?**
   - What we know: `exit()` from `useApp()` unmounts Ink; node-pty `.onExit` fires when the subprocess ends.
   - What's unclear: Whether calling `render()` again after PTY exit is reliable in the same Node.js process. Claude Code (which uses Ink) appears to restart its Ink session.
   - Recommendation: For CLI-05, the simplest path is to `process.exit(0)` after PTY exits, printing a message "Type `agentspace chat` to resume." For CLI-06 (agent controls PTY), the PTY session stays open and the agent sends input over WS — no Ink restart needed since Ink isn't involved.

2. **How much terminal output to snapshot for agent observation?**
   - What we know: PTY `onData` fires with raw ANSI escape codes. The agent needs readable text.
   - What's unclear: Whether to strip ANSI codes before sending as `terminal.snapshot` over WS, or send raw.
   - Recommendation: Strip ANSI escape codes (use a simple regex or the `strip-ansi` package) before sending to the agent. The agent doesn't need color codes to read terminal output.

3. **Failure detection threshold: how many repeated steps before flagging?**
   - What we know: Warp's "ask on first write" pattern; AI SDK has no built-in failure counter.
   - What's unclear: 2 vs 3 vs 5 repeated errors — what's the right threshold for the AgentSpace use case?
   - Recommendation: Start with 3 as the threshold for `repeated-tool-error`; expose as a config option. This matches the Partnership on AI guidance: "failure detection should not trigger just because the agent tries a path that does not work out immediately."

4. **Skill sandbox: what does "testing" a skill mean?**
   - What we know: Skills are markdown instructions injected into the system prompt, not executable code.
   - What's unclear: The requirement says "test it in a sandbox environment" — this likely means running a minimal agent loop with the skill injected and a test prompt to verify the skill produces the expected behavior.
   - Recommendation: Implement skill sandbox as: create an ephemeral in-memory session, inject the skill's instructions as a system prompt extension, send a test message (either agent-authored or user-provided), capture the response. No filesystem sandbox needed — it's a prompt injection test.

---

## Sources

### Primary (HIGH confidence)

- `packages/gateway/src/agent/tool-loop.ts` — existing `runAgentLoop` with `fullStream` iteration
- `packages/gateway/src/agent/approval-gate.ts` — existing approval tier system
- `packages/gateway/src/ws/protocol.ts` — existing WS message schema
- `packages/core/src/skills/loader.ts` + `types.ts` — existing SKILL.md discovery/parse
- AI SDK v6 `streamText` docs (ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) — `onStepFinish`, `stopWhen`, `finishReason`, `toolResults`
- node-pty DeepWiki (deepwiki.com/microsoft/node-pty/1.1-installation) — `IPty` interface, `spawn()` options, installation steps

### Secondary (MEDIUM confidence)

- microsoft/node-pty GitHub README — API overview, platform requirements, version 1.1.0 confirmed
- Warp full terminal use docs (docs.warp.dev) — PTY observation/control bidirectional model, approval patterns
- GitHub/msmps/pilotty — daemon PTY architecture, snapshot/input pattern
- Partnership on AI failure detection paper — threshold guidance for agent failure detection

### Tertiary (LOW confidence)

- WebSearch: "agent observes terminal session" — general patterns not specific to this stack
- WebSearch: "AI agent self-improvement failure detection pattern" — conceptual guidance only

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — node-pty is firmly established; AI SDK already in use; existing skills system unchanged
- Architecture (AGNT-06/07/08): MEDIUM — `onStepFinish` hook confirmed; skill tool design is sound but untested integration
- Architecture (CLI-05/06 PTY proxy): MEDIUM — node-pty API confirmed; Ink teardown/restart is the main unknown
- Pitfalls: HIGH — raw mode conflict, native compilation issues, and vm2 CVEs are all documented real problems

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days; node-pty is stable; AI SDK v6 is stable)
