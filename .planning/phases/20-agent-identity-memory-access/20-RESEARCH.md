# Phase 20: Agent Identity & Memory Access - Research

**Researched:** 2026-02-19
**Domain:** Agent identity injection, memory read/write, desktop provider resolution, agents page polish
**Confidence:** HIGH (all findings based on direct codebase analysis of existing architecture)

## Summary

Phase 20 bridges the gap between identity data written during `tek init` and its actual use at runtime. The core problem is straightforward: the init command already writes `agentName` into SOUL.md and `userDisplayName` into USER.md (added in Phase 19), the assembler already injects all identity files into the system prompt (SOUL.md, IDENTITY.md, STYLE.md, USER.md), and the cascade resolution system already supports per-agent identity files. What remains is ensuring this pipeline works end-to-end in both CLI and desktop contexts, adding write-back capability so the agent can update its own memory files, fixing any residual provider resolution errors in desktop chat, and polishing the desktop agents page.

The memory architecture is already well-structured. The gateway's `assembleContext()` (in `packages/gateway/src/context/assembler.ts`) composes a system prompt from seven sources: base prompt, soul, identity, style, user context, agents config, long-term memory, and recent daily logs. The `MemoryManager` (in `packages/gateway/src/memory/memory-manager.ts`) loads all of these via `@tek/db` functions that support agent-specific cascade resolution. The agent's ability to write memory is partially implemented (daily logs via `appendDailyLog`, long-term memory via `addMemoryEntry`, soul evolution via `evolveSoul`), but the agent does not have explicit tools to read/write its own identity and memory files during a chat session.

**Primary recommendation:** Wire up memory read/write tools in the agent's tool registry, verify the identity injection pipeline end-to-end from init through chat, fix any provider fallback issues for desktop chat, and ensure the desktop agents page is functional with list/create/detail views (which already exist from Phase 19).

## Standard Stack

### Core (already in project -- no new dependencies)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| ai (Vercel AI SDK) | existing | LLM streaming, tool definitions | `tool()` function for defining agent tools |
| zod | existing | Schema validation | Tool input schemas, config validation |
| @tek/db | existing | Memory file operations | All identity/memory CRUD functions |
| @tek/core | existing | Config loading, path constants | `CONFIG_DIR`, `loadConfig()`, `getDefaultModel()` |
| React | ^19 | Desktop UI | Agents page components |
| Tauri plugins | v2 | Desktop file/shell access | `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-shell` |

### No New Dependencies Needed
All six phase requirements can be met with existing code and patterns. The identity system, memory system, provider registry, and desktop agents page are already built -- this phase is about wiring, verification, and completing the last-mile integration.

## Architecture Patterns

### Pattern 1: Identity Injection Pipeline (existing, verify end-to-end)
**What:** Init writes identity data to markdown files, gateway loads them into system prompt every chat session
**Data flow:**
```
tek init → writes SOUL.md, USER.md (agentName, userDisplayName injected)
         → writes config.json (agentName, userDisplayName, defaultModel fields)
           ↓
tek chat / Desktop Chat
         → gateway handleChatSend()
         → agentId = loadConfig()?.agents?.defaultAgentId ?? "default"
         → assembleContext(messages, userMessage, model, ..., agentId)
         → MemoryManager.getMemoryContext(agentId)
           → loadSoul(agentId)      → cascade: agent-specific > shared > global
           → loadIdentity(agentId)  → cascade: agent-specific > shared > global
           → loadStyle(agentId)     → cascade: agent-specific > shared > global
           → loadUser()             → always global (shared across agents)
           → loadAgentsConfig()     → only when multiple agents configured
           → loadLongTermMemory()   → global MEMORY.md
           → loadRecentLogs()       → today's + yesterday's daily logs
         → system prompt assembled with all sections
```
**Key files:**
- `packages/cli/src/commands/init.ts` lines 99-131: writes identity files
- `packages/gateway/src/ws/handlers.ts` line 245: extracts agentId from config
- `packages/gateway/src/context/assembler.ts` lines 76-88: builds system prompt
- `packages/gateway/src/memory/memory-manager.ts` lines 26-49: loads all memory context
- `packages/db/src/memory/agent-resolver.ts`: cascade resolution

### Pattern 2: Agent Memory Tools (to be implemented)
**What:** Add tools to the agent's tool registry that let it read and write its own identity/memory files during chat
**Design:** Use the existing `tool()` function from Vercel AI SDK. Tools should:
1. Read identity files (SOUL.md, IDENTITY.md, STYLE.md, USER.md, MEMORY.md)
2. Write/append to MEMORY.md (long-term memory)
3. Write daily log entries
4. Update identity file sections (via `updateIdentityFileSection()`)
**Security:** Even in `limited-control` workspace mode, these tools should be allowed because they operate on the agent's own `~/.config/tek/memory/` directory, not the user's workspace. The `checkWorkspace()` guard in `filesystem.ts` would block access to `~/.config/tek/` if the workspace is elsewhere, so these must be separate tools with their own access logic.
**Existing functions to wrap:**
- `loadSoul()`, `loadIdentity()`, `loadStyle()`, `loadUser()`, `loadLongTermMemory()` (read)
- `addMemoryEntry()` (write to MEMORY.md sections)
- `appendDailyLog()` (write daily logs)
- `updateIdentityFileSection()` (update identity file sections)

### Pattern 3: Provider Registry Resolution (existing, verify for desktop)
**What:** The `buildRegistry()` in `packages/gateway/src/llm/registry.ts` conditionally registers providers based on API key availability. The `resolveModelId()` function adds a provider prefix if missing.
**How it works:**
```typescript
// registry.ts line 101
export function resolveModelId(model: string): string {
  if (model.includes(":")) return model;  // already qualified
  const available = getAvailableProviders();
  const provider = available[0] ?? "ollama";
  return `${provider}:${model}`;
}
```
**Provider error scenario:** If config has `defaultModel: "claude-sonnet-4-5-20250929"` (no provider prefix), and the anthropic key is not in vault, `getAvailableProviders()` returns `["ollama"]`, so the model becomes `ollama:claude-sonnet-4-5-20250929` which fails. If the model IS prefixed as `anthropic:claude-sonnet-4-5-20250929`, the registry tries to use the anthropic provider which was never registered (no key), causing a "No such provider: anthropic" error.
**Fix approach:** The error message "No such provider: anthropic" comes from `createProviderRegistry()` when the provider isn't registered. The gateway should validate that the resolved provider is actually registered before attempting to stream, and return a clear error if not.
**Key files:**
- `packages/gateway/src/llm/registry.ts` lines 24-93: provider registration
- `packages/gateway/src/ws/handlers.ts` line 303: `model = resolveModelId(model)`

### Pattern 4: Desktop Agents Page (existing from Phase 19)
**What:** Three-view architecture (list, create, detail) already implemented
**Current state:**
- List view: shows "Default Agent" card + user-created agents from `config.agents.list`
- Create view: form with name, description, access mode fields; creates agent directory, seeds identity files, adds to config
- Detail view: tab-based identity file editor (SOUL, Identity, User, Style) with per-agent loading
**What may need polish:**
- Verify the create flow actually works end-to-end
- Ensure agents are persisted correctly in config
- Test editing identity files for both default and custom agents
- Visual consistency with rest of desktop app

### Anti-Patterns to Avoid
- **Using filesystem tools for agent memory access:** The existing `read_file`/`write_file` tools enforce workspace boundaries. Don't try to "fix" them to also allow `~/.config/tek/memory/`. Instead, create dedicated memory tools.
- **Hardcoding provider names:** Always use `resolveModelId()` and `getAvailableProviders()`. Never assume anthropic is available.
- **Writing to config.json for runtime state:** Identity data belongs in the markdown files (`~/.config/tek/memory/*.md`), not in config.json fields. Config stores structural data (agent definitions, model preferences), memory files store content.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Identity file reading | Custom file readers | `loadSoul()`, `loadIdentity()`, `loadStyle()`, `loadUser()` from `@tek/db` | Already handle cascade resolution, template seeding, migration |
| Memory section updates | Custom markdown parsing | `addMemoryEntry()`, `updateIdentityFileSection()` from `@tek/db` | Handle section finding, insertion, footer updates |
| Daily log writing | Custom log file management | `appendDailyLog()` from `@tek/db` | Handles directory creation, date formatting, timestamping |
| Tool definitions | Raw function objects | `tool()` from `ai` (Vercel AI SDK) | Consistent with existing tool registry, typed schemas |
| Provider availability check | Manual key checking | `getAvailableProviders()` from registry | Already checks all configured providers |

## Common Pitfalls

### Pitfall 1: Workspace Isolation Blocks Memory Access
**What goes wrong:** In `limited-control` security mode with a workspace directory, the `checkWorkspace()` function in `filesystem.ts` blocks all paths outside the workspace. If the user asks the agent to "update your memory" and the agent tries to use `write_file` to write to `~/.config/tek/memory/MEMORY.md`, it gets blocked.
**Why it happens:** The filesystem tools are designed to protect the user's system from unauthorized file access. They correctly block paths outside the workspace.
**How to avoid:** Create dedicated memory tools (`memory_read`, `memory_write`, `memory_append_daily`) that bypass workspace restrictions but ONLY for files in the `~/.config/tek/memory/` directory and agent-specific directories. These tools should have their own path validation that only allows the agent's own memory paths.
**Warning signs:** Agent responds with "I don't have permission to access that file" when trying to read/write its own memory.

### Pitfall 2: Provider Not Registered But Model Requires It
**What goes wrong:** Desktop chat sends a message, gateway resolves model to `anthropic:claude-sonnet-4-5-20250929`, but anthropic provider is not registered in the registry (no API key), causing "No such provider" error.
**Why it happens:** The `defaultModel` in config.json may include a provider prefix for a provider whose key is not in the vault. Or the model is unprefixed and gets auto-prefixed with the first available provider, which may not support that model.
**How to avoid:** Before streaming, validate that the resolved model's provider is actually registered. If not, return a clear error to the client indicating which provider is missing and how to configure it.
**Warning signs:** Desktop chat shows "No such provider: anthropic" error after sending first message.

### Pitfall 3: Init-Written Identity Files Not Loading
**What goes wrong:** User runs `tek init`, sets agent name and user display name, but chat greets them generically without personality or name awareness.
**Why it happens:** Several possible causes: (1) Init wrote to wrong path, (2) Gateway caches config and doesn't pick up changes, (3) Template content overwrites init-written content, (4) agentId resolution returns "default" but files are in a different location.
**How to avoid:** Verify the complete chain: init writes to `~/.config/tek/memory/SOUL.md` and `~/.config/tek/memory/USER.md`, gateway loads config and gets `agentId = "default"`, loadSoul("default") falls through to global path, reads SOUL.md from `~/.config/tek/memory/`. Test with actual file contents after init.
**Warning signs:** Context inspection shows empty soul/identity/user sections despite files existing on disk.

### Pitfall 4: Stale Registry Cache
**What goes wrong:** Provider registry is cached as a singleton (`cachedRegistry`). If a user adds an API key after the gateway starts, the registry doesn't pick up the new key.
**Why it happens:** `getRegistry()` in registry.ts lazily initializes once and caches forever.
**How to avoid:** This is a known limitation. For Phase 20, document it but don't fix it -- gateway restart is the workaround. A future phase could add registry invalidation.
**Warning signs:** User adds API key via `tek keys add`, but gateway still can't use that provider until restart.

### Pitfall 5: Agent Memory Tools Leaking Filesystem Access
**What goes wrong:** Memory tools intended for `~/.config/tek/memory/` could be abused to read/write arbitrary files if path validation is insufficient.
**Why it happens:** Path traversal attacks (e.g., `../../etc/passwd`) if the tool accepts arbitrary subpaths.
**How to avoid:** Memory tools should use `join()` with strict path validation: resolve the full path, then verify it starts with `CONFIG_DIR/memory/` or the agent's directory. Use `isPathWithinWorkspace()` pattern from `@tek/core` but scoped to the memory directory.
**Warning signs:** Agent can read files outside `~/.config/tek/` via memory tools.

## Code Examples

### Example 1: Memory Read Tool
```typescript
// packages/gateway/src/tools/memory.ts
import { tool } from "ai";
import { z } from "zod";
import {
  loadSoul, loadIdentity, loadStyle, loadUser,
  loadLongTermMemory, loadRecentLogs,
} from "@tek/db";

export function createMemoryReadTool(agentId?: string) {
  return tool({
    description: "Read one of your identity or memory files. Available files: SOUL.md, IDENTITY.md, STYLE.md, USER.md, MEMORY.md, DAILY_LOGS",
    inputSchema: z.object({
      file: z.enum(["SOUL.md", "IDENTITY.md", "STYLE.md", "USER.md", "MEMORY.md", "DAILY_LOGS"])
        .describe("Which identity or memory file to read"),
    }),
    execute: async ({ file }) => {
      switch (file) {
        case "SOUL.md": return loadSoul(agentId) || "(empty)";
        case "IDENTITY.md": return loadIdentity(agentId) || "(empty)";
        case "STYLE.md": return loadStyle(agentId) || "(empty)";
        case "USER.md": return loadUser() || "(empty)";
        case "MEMORY.md": return loadLongTermMemory() || "(empty)";
        case "DAILY_LOGS": return loadRecentLogs() || "(no recent logs)";
      }
    },
  });
}
```

### Example 2: Memory Write Tool
```typescript
// packages/gateway/src/tools/memory.ts (continued)
import { addMemoryEntry, appendDailyLog, updateIdentityFileSection } from "@tek/db";
import type { MemorySection } from "@tek/db";

export function createMemoryWriteTool() {
  return tool({
    description: "Write to your memory or identity files. Use 'memory' target to add facts to MEMORY.md, 'daily' to append to today's daily log, or 'identity' to update a section in an identity file.",
    inputSchema: z.object({
      target: z.enum(["memory", "daily", "identity"])
        .describe("Where to write: memory (MEMORY.md), daily (today's log), identity (an identity file section)"),
      content: z.string().describe("The content to write"),
      section: z.string().optional()
        .describe("For 'memory': User Facts | Project Context | Preferences | Important Decisions. For 'identity': the ## section header name."),
      file: z.string().optional()
        .describe("For 'identity' target: SOUL.md, IDENTITY.md, STYLE.md, or USER.md"),
    }),
    execute: async ({ target, content, section, file }) => {
      switch (target) {
        case "memory": {
          const validSections: MemorySection[] = ["User Facts", "Project Context", "Preferences", "Important Decisions"];
          const memSection = (section ?? "User Facts") as MemorySection;
          if (!validSections.includes(memSection)) {
            return `Invalid section. Use one of: ${validSections.join(", ")}`;
          }
          addMemoryEntry(memSection, content);
          return `Added to MEMORY.md section "${memSection}"`;
        }
        case "daily": {
          appendDailyLog(content);
          return "Appended to today's daily log";
        }
        case "identity": {
          const validFiles = ["SOUL.md", "IDENTITY.md", "STYLE.md", "USER.md"];
          const targetFile = file ?? "SOUL.md";
          if (!validFiles.includes(targetFile)) {
            return `Invalid file. Use one of: ${validFiles.join(", ")}`;
          }
          const sectionName = section ?? "Learned Preferences";
          updateIdentityFileSection(targetFile, sectionName, content);
          return `Updated ${targetFile} section "${sectionName}"`;
        }
      }
    },
  });
}
```

### Example 3: Register Memory Tools in Tool Registry
```typescript
// In packages/gateway/src/agent/tool-registry.ts buildToolRegistry()
// After existing tool registration (step 6):

// 7. Add memory tools (always available, bypasses workspace restrictions)
const agentId = loadConfig()?.agents?.defaultAgentId ?? "default";
const memoryRead = createMemoryReadTool(agentId === "default" ? undefined : agentId);
const memoryWrite = createMemoryWriteTool();

tools.memory_read = approvalPolicy
  ? wrapToolWithApproval("memory_read", memoryRead as unknown as Record<string, unknown>, approvalPolicy)
  : memoryRead;
tools.memory_write = approvalPolicy
  ? wrapToolWithApproval("memory_write", memoryWrite as unknown as Record<string, unknown>, approvalPolicy)
  : memoryWrite;

// Memory read is safe (auto tier), memory write needs session approval
if (approvalPolicy) {
  approvalPolicy.perTool.memory_read = "auto";
  approvalPolicy.perTool.memory_write = "session";
}
```

### Example 4: Provider Validation Before Streaming
```typescript
// In packages/gateway/src/ws/handlers.ts handleChatSend()
// After model resolution (line 303):

model = resolveModelId(model);

// Validate that the resolved provider is actually registered
const providerName = model.split(":")[0];
const available = getAvailableProviders();
if (!available.includes(providerName)) {
  transport.send({
    type: "error",
    requestId: msg.id,
    code: "PROVIDER_NOT_CONFIGURED",
    message: `Provider "${providerName}" is not configured. Available providers: ${available.join(", ")}. Run: tek keys add ${providerName}`,
  });
  return;
}
```

## Current State Assessment

### What Already Works (from Phase 16 + 19)
1. Multi-file identity architecture (SOUL.md, IDENTITY.md, USER.md, STYLE.md, AGENTS.md)
2. Cascade resolution (agent-specific > shared > global)
3. System prompt assembly with all identity files
4. Init writes agentName to SOUL.md and userDisplayName to USER.md
5. Desktop agents page with list/create/detail views
6. Per-agent identity file editing in desktop
7. Provider registry with conditional registration
8. Daily log writing and reading
9. Long-term memory (MEMORY.md) read and write
10. Soul evolution with user approval

### What Needs Implementation (Phase 20 gaps)
1. **Memory tools for agent self-access:** Agent cannot read/write its own memory files during chat (no tools registered)
2. **Provider validation:** No pre-stream check that resolved provider is actually registered (causes cryptic errors)
3. **End-to-end verification:** The pipeline from init to chat needs testing -- identity files may not load correctly in all scenarios
4. **Desktop agents page polish:** The page exists but may need visual/functional polish to meet success criteria
5. **Limited workspace memory exemption:** In limited mode, agent needs memory directory access even though it's outside the workspace

### Files to Modify
| File | Change |
|------|--------|
| `packages/gateway/src/tools/memory.ts` | **NEW** - Memory read/write tools |
| `packages/gateway/src/agent/tool-registry.ts` | Register memory tools |
| `packages/gateway/src/ws/handlers.ts` | Add provider validation before streaming |
| `packages/gateway/src/llm/registry.ts` | Add `isProviderAvailable()` helper |
| `apps/desktop/src/pages/AgentsPage.tsx` | Polish if needed |
| `apps/desktop/src/pages/ChatPage.tsx` | Verify provider error display |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single SOUL.md for everything | Multi-file (SOUL, IDENTITY, STYLE, USER) | Phase 16 | Separation of concerns for identity |
| agentName only in config.json | agentName injected into SOUL.md by init | Phase 19 | Identity persists into chat context |
| No per-agent directories | Cascade resolution with `~/.config/tek/agents/{id}/` | Phase 16 | Multi-agent identity support |
| No memory tools for agent | Agent must ask user to update files manually | Current | Agent cannot self-maintain its memory |
| Hardcoded anthropic provider | Dynamic provider registry with fallback | Phase 4 | Multi-provider support |

## Open Questions

1. **Memory write approval tier**
   - What we know: Memory writes are low-risk (agent writing to its own config directory)
   - What's unclear: Should memory writes be auto-approved, session-approved, or always-approved?
   - Recommendation: Use "session" tier for memory writes (user approves once per session). Memory reads should be "auto" (always allowed). This matches the existing soul evolution pattern which requires user approval.

2. **Agent-specific memory paths for non-default agents**
   - What we know: `resolveAgentDir()` creates `~/.config/tek/agents/{agentId}/` and identity files cascade resolve. But daily logs and MEMORY.md are always global.
   - What's unclear: Should each agent have its own MEMORY.md and daily logs, or share global ones?
   - Recommendation: For Phase 20, keep memory (MEMORY.md) and daily logs global. Per-agent memory is a future enhancement. Identity files (SOUL, IDENTITY, STYLE) are already per-agent via cascade.

3. **Desktop agents page "working agent management"**
   - What we know: The page already has list/create/detail views (implemented in Phase 19). Create flow seeds identity files and adds to config.
   - What's unclear: What specific "working" means beyond what exists -- is it about agent deletion? Agent switching for chat? Per-agent model selection?
   - Recommendation: Verify existing functionality works end-to-end. Add agent deletion capability if missing. Defer chat-time agent switching to a future phase.

## Sources

### Primary (HIGH confidence)
- `packages/cli/src/commands/init.ts` - Init command identity file writing (lines 99-131)
- `packages/gateway/src/context/assembler.ts` - Context assembly with identity sections
- `packages/gateway/src/memory/memory-manager.ts` - Memory context loading
- `packages/gateway/src/ws/handlers.ts` - Chat handler, agentId extraction, provider resolution
- `packages/gateway/src/llm/registry.ts` - Provider registry, model resolution, available providers
- `packages/gateway/src/agent/tool-registry.ts` - Tool registration patterns
- `packages/gateway/src/tools/filesystem.ts` - Workspace security pattern, `checkWorkspace()`
- `packages/db/src/memory/` - All memory modules (identity-manager, soul-manager, agent-resolver, memory-curator, daily-logger, ensure-memory)
- `packages/core/src/config/schema.ts` - Config schema with AgentDefinition, AppConfig
- `packages/core/src/config/security.ts` - `isPathWithinWorkspace()` pattern
- `apps/desktop/src/pages/AgentsPage.tsx` - Agents page (list/create/detail views)
- `apps/desktop/src/pages/ChatPage.tsx` - Chat page, WebSocket connection
- `apps/desktop/src/hooks/useChat.ts` - Chat message handling
- `apps/desktop/src/lib/files.ts` - Desktop identity file operations
- `apps/desktop/src/lib/config.ts` - Desktop config loading with normalization
- `apps/desktop/src/lib/process.ts` - Gateway start/stop via Tauri shell
- `apps/desktop/src/lib/discovery.ts` - Gateway discovery via runtime.json + health check
- `apps/desktop/src-tauri/capabilities/default.json` - Tauri FS scope permissions
- `.planning/phases/19-desktop-integration-polish/19-RESEARCH.md` - Phase 19 context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing code patterns
- Architecture: HIGH - complete chain traced through source files
- Memory tools design: HIGH - follows existing tool() pattern, uses existing @tek/db functions
- Provider validation: HIGH - error scenario identified with clear fix path
- Desktop agents page: HIGH - existing implementation reviewed, scope is verification + polish
- Pitfalls: HIGH - all derived from actual code behavior

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable codebase, no external dependencies changing)
