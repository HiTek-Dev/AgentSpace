# Phase 23: Agent Tools & Error Recovery - Research

**Researched:** 2026-02-20
**Domain:** Agent tool execution, workspace path resolution, error recovery, search skills
**Confidence:** HIGH

## Summary

This phase addresses eight critical bugs found during sandbox testing, all related to the agent's tool execution layer. The root causes have been identified through codebase analysis and fall into four categories: (1) missing workspace path resolution in filesystem/shell tools, (2) stale context inspector that doesn't reflect the actual assembler output, (3) no error-to-user feedback when tool execution fails, and (4) missing Brave Search API integration and key management.

The most impactful bugs are the broken workspace paths (agent hallucinates `/home/user/` paths and tools pass them through unresolved) and the stale `inspectContext` function (reports 31 bytes / 0 memory because it still uses Phase-3 stubs instead of the real assembler logic). The error recovery gap stems from AI SDK's design where tool errors flow as `tool-error` stream parts but the current `fullStream` handler lacks a `tool-error` case.

**Primary recommendation:** Fix path resolution first (highest user-facing impact), then error reporting, then context inspector, then Brave Search skill.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ai (AI SDK) | v4+ | Tool definitions via `tool()`, `streamText` with `fullStream` | Already in use; `inputSchema` pattern per [06-01] decision |
| zod | 3.x | Tool input schemas | Already in use for all tool definitions |
| execa | latest | Shell execution via `execaCommand` | Already in use in shell tool |
| node:path | built-in | `resolve()`, `join()` for path normalization | Missing from filesystem tools -- needs to be added |
| node:fs/promises | built-in | File CRUD operations | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:os | built-in | `homedir()`, `platform()` for workspace defaults | Path resolution when no explicit workspace configured |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tavily Search | Brave Search API | Brave has free tier (2000 queries/mo), independent index, simpler auth (single header) |
| Custom fetch wrapper | undici/node:fetch | Native fetch is sufficient for Brave API; no extra dependency needed |

## Architecture Patterns

### Bug-to-Fix Mapping

| Bug # | Root Cause | File(s) | Fix Pattern |
|-------|-----------|---------|-------------|
| 1 | No path resolution -- LLM paths used as-is | `tools/filesystem.ts`, `tools/shell.ts` | Add `resolve(workspaceDir, path)` for relative paths |
| 2 | No `tool-error` handler in fullStream loop | `agent/tool-loop.ts` | Add `case "tool-error"` to relay errors to client |
| 3 | Agent freezes after tool failure | `agent/tool-loop.ts` | Tool errors must produce user-visible messages; add timeout detection |
| 4 | `inspectContext` uses stale stubs | `context/inspector.ts` | Rewrite to use MemoryManager + assembler logic |
| 5 | Memory shows 0 bytes in /context | `context/inspector.ts` | Same fix as #4 -- inspector must load actual memory |
| 6 | Raw function call syntax in output | `agent/tool-loop.ts` or client | Likely client-side rendering bug; verify tool-call/tool-result WS messages are correct |
| 7 | Workspace paths broken | `tools/filesystem.ts` | Same fix as #1 -- path resolution |
| 8 | memory_write works but /context shows 0 | `context/inspector.ts` | Same fix as #4/5 -- inspector stale |

### Pattern 1: Workspace-Aware Path Resolution
**What:** All filesystem and shell tool paths must be resolved relative to workspace before use.
**When to use:** Every file path or directory argument in tool execute functions.
**Example:**
```typescript
// In createFilesystemTools:
import { resolve, isAbsolute } from "node:path";

function resolveToolPath(
  rawPath: string,
  workspaceDir?: string,
): string {
  // If absolute path is provided, use as-is (security check handles restriction)
  if (isAbsolute(rawPath)) return rawPath;
  // Resolve relative paths against workspace
  if (workspaceDir) return resolve(workspaceDir, rawPath);
  // Fallback: resolve against cwd
  return resolve(rawPath);
}

// Usage in read_file execute:
execute: async ({ path: rawPath }) => {
  const path = resolveToolPath(rawPath, workspaceDir);
  checkWorkspace(path, securityMode, workspaceDir);
  const content = await readFile(path, "utf-8");
  // ...
}
```

### Pattern 2: Tool Error Relay to Client
**What:** AI SDK emits `tool-error` parts in fullStream when tool execute throws. Must relay to client.
**When to use:** In the fullStream switch statement in `tool-loop.ts`.
**Example:**
```typescript
// In runAgentLoop fullStream handler:
case "tool-error": {
  const toolCallId = part.toolCallId;
  const toolName = String(part.toolName);
  const errorMessage = part.error instanceof Error
    ? part.error.message
    : String(part.error);

  logger.warn(`Tool error in ${toolName}: ${errorMessage}`);

  transport.send({
    type: "tool.error",
    requestId,
    toolCallId,
    toolName,
    error: errorMessage,
  });
  break;
}
```

### Pattern 3: Context Inspector Alignment
**What:** `inspectContext` must mirror `assembleContext` logic instead of using Phase-3 stubs.
**When to use:** The `/context` command handler.
**Example:**
```typescript
// Rewritten inspectContext using the same MemoryManager + ThreadManager:
export function inspectContext(
  sessionMessages: MessageRow[],
  model: string,
  agentId?: string,
): { sections: ContextSection[]; totals: ... } {
  const memoryManager = getMemoryManager();
  const memoryCtx = memoryManager.getMemoryContext(agentId);
  const threadManager = getThreadManager();
  const userSystemPrompt = threadManager.buildSystemPrompt();
  // ... measure each section identically to assembler
}
```

### Pattern 4: Brave Search API Integration
**What:** REST call to `https://api.search.brave.com/res/v1/web/search` with `X-Subscription-Token` header.
**When to use:** When user configures a Brave API key.
**Example:**
```typescript
export function createBraveSearchTool(apiKey: string) {
  return tool({
    description: "Search the web using Brave Search. Returns titles, URLs, and content snippets.",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
      count: z.number().optional().default(5).describe("Number of results (max 20)"),
    }),
    execute: async ({ query, count }) => {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", String(count));

      const response = await fetch(url.toString(), {
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
      });

      if (!response.ok) {
        return { error: `Brave search failed: ${response.status}` };
      }

      const data = await response.json();
      return {
        results: (data.web?.results ?? []).map((r: any) => ({
          title: r.title,
          url: r.url,
          description: r.description,
        })),
      };
    },
  });
}
```

### Anti-Patterns to Avoid
- **Passing LLM paths through unresolved:** The LLM will hallucinate paths like `/home/user/workspace/`. Always resolve relative to actual workspaceDir.
- **Silent tool failures:** Never swallow tool errors. Every failure must produce a user-visible WS message.
- **Duplicate logic in inspector vs assembler:** The inspector must reuse the same memory/context loading as the assembler, not maintain separate stubs.
- **Hardcoding search provider:** Use the same skill registration pattern as Tavily -- key check gates availability.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path traversal security | Custom string checks | `isPathWithinWorkspace` (already exists in `@tek/core`) + `path.resolve` | Symlink detection, cross-platform edge cases |
| Tool error detection | Custom error parsing | AI SDK's `tool-error` stream part type | SDK already wraps `ToolExecutionError` correctly |
| Shell sandboxing | Custom process spawning | `execa` with `reject: false` (already in use) | Handles timeout, exit codes, output capture |
| Failure pattern detection | New retry logic | Existing `failure-detector.ts` (already detects repeated-tool-error) | Already handles 4 failure patterns |

**Key insight:** Most infrastructure exists. The bugs are about wiring gaps, not missing capabilities.

## Common Pitfalls

### Pitfall 1: LLM Path Hallucination
**What goes wrong:** LLM generates paths like `/home/user/workspace/` (Linux default) on macOS where actual path is `/Users/username/...`.
**Why it happens:** Model training data biases toward Linux paths. System prompt doesn't include actual workspace path.
**How to avoid:** (a) Resolve all relative paths against `workspaceDir`. (b) Inject workspace path into system prompt so the LLM knows the real path. (c) In tool descriptions, tell the LLM "paths are relative to your workspace".
**Warning signs:** ENOENT errors with `/home/` prefix on macOS.

### Pitfall 2: Tool Error Swallowed by Stream
**What goes wrong:** Tool throws an error, AI SDK wraps it as `tool-error` stream part, but the `fullStream` handler has no case for it. Error disappears, agent continues with no result, goes silent.
**Why it happens:** The `fullStream` switch has cases for `text-delta`, `tool-call`, `tool-result`, `tool-approval-request`, `finish-step`, `finish`, `error` -- but NOT `tool-error`.
**How to avoid:** Add explicit `case "tool-error"` handler. Also consider adding a `default` case that logs unexpected part types.
**Warning signs:** Agent goes silent after tool call; no error in gateway logs.

### Pitfall 3: Inspector/Assembler Drift
**What goes wrong:** `/context` output shows wrong byte counts because `inspectContext` was never updated past Phase 3 stubs.
**Why it happens:** Inspector was a stub ("memory", "", ...) that was never updated when the assembler gained memory, soul, identity support.
**How to avoid:** Either (a) have inspector call assembler directly, or (b) share the memory loading logic via a common function.
**Warning signs:** System prompt shows ~31 bytes (just "You are a helpful AI assistant."), memory shows 0.

### Pitfall 4: Tavily Key Not Passed to Tool Registry
**What goes wrong:** Even if user has a Tavily key, it's not passed in `handlers.ts` line 360-369 `buildToolRegistry()` call. The `tavilyApiKey` field is not populated.
**Why it happens:** When tool registry was wired up, only `openaiApiKey` and `veniceApiKey` were included via `getKey()`.
**How to avoid:** Add `tavilyApiKey: getKey("tavily") ?? undefined` and/or `braveApiKey: getKey("brave") ?? undefined` to the buildToolRegistry call.
**Warning signs:** `web_search` tool never appears in tool list.

### Pitfall 5: Provider List Missing Brave/Tavily
**What goes wrong:** `tek keys add brave` fails because "brave" is not in the PROVIDERS array.
**Why it happens:** `providers.ts` only lists: anthropic, openai, ollama, venice, google, telegram.
**How to avoid:** Add "brave" (and optionally "tavily") to the PROVIDERS array.
**Warning signs:** VaultError: Unknown provider "brave".

## Code Examples

### Fix 1: Workspace Path Resolution in Filesystem Tools
```typescript
// Source: analysis of packages/gateway/src/tools/filesystem.ts
import { resolve, isAbsolute } from "node:path";

// Add to createFilesystemTools, called before checkWorkspace:
function resolveAgentPath(rawPath: string, workspaceDir?: string): string {
  if (isAbsolute(rawPath)) return rawPath;
  return workspaceDir ? resolve(workspaceDir, rawPath) : resolve(rawPath);
}

// In read_file execute:
execute: async ({ path: rawPath }) => {
  const path = resolveAgentPath(rawPath, workspaceDir);
  checkWorkspace(path, securityMode, workspaceDir);
  // ... rest unchanged
}
```

### Fix 2: Tool Error Handler in fullStream
```typescript
// Source: analysis of packages/gateway/src/agent/tool-loop.ts
// Add this case to the fullStream switch:
case "tool-error": {
  const toolCallId = part.toolCallId;
  const toolName = String(part.toolName);
  const error = part.error instanceof Error
    ? part.error.message
    : String(part.error);

  logger.warn(`Tool execution error [${toolName}]: ${error}`);

  transport.send({
    type: "tool.error",
    requestId,
    toolCallId,
    toolName,
    error,
  });
  break;
}
```

### Fix 3: Rewrite inspectContext
```typescript
// Source: analysis of packages/gateway/src/context/inspector.ts
// Must load the same memory context as assembler.ts does:
import { MemoryManager } from "../memory/memory-manager.js";
import { ThreadManager } from "../memory/thread-manager.js";

export function inspectContext(
  sessionMessages: MessageRow[],
  model: string,
  agentId?: string,
): { sections: ContextSection[]; totals: ... } {
  const pricing = getModelPricing(model);
  const sections: ContextSection[] = [];

  const threadManager = new ThreadManager();
  const userSystemPrompt = threadManager.buildSystemPrompt() || "You are a helpful AI assistant.";
  sections.push(measureSection("system_prompt", userSystemPrompt, pricing.inputPerMTok));

  const memoryManager = new MemoryManager();
  const memoryCtx = memoryManager.getMemoryContext(agentId);
  sections.push(measureSection("soul", memoryCtx.soul, pricing.inputPerMTok));
  sections.push(measureSection("identity", memoryCtx.identity, pricing.inputPerMTok));
  sections.push(measureSection("style", memoryCtx.style, pricing.inputPerMTok));
  sections.push(measureSection("user_context", memoryCtx.user, pricing.inputPerMTok));
  sections.push(measureSection("long_term_memory", memoryCtx.longTermMemory, pricing.inputPerMTok));
  sections.push(measureSection("recent_activity", memoryCtx.recentLogs, pricing.inputPerMTok));

  // history, skills, tools as before ...
}
```

### Fix 4: Brave Search Skill
```typescript
// Source: Brave Search API docs (https://brave.com/search/api/)
// Endpoint: GET https://api.search.brave.com/res/v1/web/search
// Auth: X-Subscription-Token header
// Free tier: 2000 queries/month

export function createBraveSearchTool(apiKey: string) {
  return tool({
    description: "Search the web using Brave Search for current information. Returns titles, URLs, and descriptions.",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
      count: z.number().optional().default(5).describe("Number of results to return (1-20)"),
    }),
    execute: async ({ query, count }) => {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", String(Math.min(count, 20)));

      const response = await fetch(url.toString(), {
        headers: {
          "Accept": "application/json",
          "X-Subscription-Token": apiKey,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        return { error: `Brave search failed: ${response.status} ${text}` };
      }

      const data = await response.json() as { web?: { results: Array<{ title: string; url: string; description: string }> } };
      return {
        results: (data.web?.results ?? []).slice(0, count).map((r) => ({
          title: r.title,
          url: r.url,
          description: r.description,
        })),
      };
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `maxSteps` parameter | `stopWhen: stepCountIs(N)` | AI SDK v4 | Already using correct pattern |
| `parameters` in tool() | `inputSchema` in tool() | AI SDK v4/v6 | Already using correct pattern per [06-01] |
| No tool-error handling | `tool-error` stream part | AI SDK v4+ | MISSING -- must add handler |

**Deprecated/outdated:**
- `inspectContext` in `context/inspector.ts` -- uses Phase 3 stubs, completely out of date with assembler

## Open Questions

1. **Raw function call syntax in output (bug 6)**
   - What we know: User sees `<function(write_file)(...)></function>` in chat output
   - What's unclear: This may be a client/desktop rendering issue rather than a gateway issue. The gateway sends proper `tool.call` and `tool.result` WS messages.
   - Recommendation: Verify the desktop app's WS message handler renders tool calls correctly. May need a client-side fix.

2. **Full-control mode guardrails**
   - What we know: User wants "limited mode: restrict to workspace. Full mode: broader OS access with guardrails"
   - What's unclear: What specific guardrails for full mode? Block system directories? Require confirmation for paths outside workspace?
   - Recommendation: For full-control mode, add an informational warning in tool description but don't restrict. The approval gate already handles dangerous operations via session approval.

3. **`tek skills setup` command**
   - What we know: User wants a command to configure individual skills (API keys for Brave, Tavily, etc.)
   - What's unclear: Exact UX -- interactive wizard? Or `tek skills setup brave` with prompts?
   - Recommendation: Simple `tek skills setup [skill-name]` that prompts for the API key and stores via vault. List available skills with `tek skills list`.

## Sources

### Primary (HIGH confidence)
- Codebase analysis of `packages/gateway/src/tools/filesystem.ts` -- confirmed no path.resolve usage
- Codebase analysis of `packages/gateway/src/agent/tool-loop.ts` -- confirmed missing `tool-error` case
- Codebase analysis of `packages/gateway/src/context/inspector.ts` -- confirmed stale Phase 3 stubs
- Codebase analysis of `packages/gateway/src/ws/handlers.ts:360-369` -- confirmed tavilyApiKey not passed
- Codebase analysis of `packages/cli/src/vault/providers.ts` -- confirmed PROVIDERS missing brave/tavily

### Secondary (MEDIUM confidence)
- [Brave Search API docs](https://brave.com/search/api/) -- endpoint, auth, response format
- [AI SDK error handling](https://ai-sdk.dev/docs/ai-sdk-core/error-handling) -- tool-error stream part type
- [AI SDK tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) -- multi-step self-correction, tool-error content parts

### Tertiary (LOW confidence)
- AI SDK v4 `tool-error` exact part shape -- verified via docs but not tested against current codebase version

## Metadata

**Confidence breakdown:**
- Bug root causes: HIGH -- confirmed via direct codebase analysis
- Fix patterns: HIGH -- straightforward wiring fixes using existing infrastructure
- Brave Search API: MEDIUM -- endpoint/auth verified via official site, response shape from docs
- Client-side rendering bug (#6): LOW -- may be gateway or client issue, needs investigation

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable domain, bugs are implementation-specific)
