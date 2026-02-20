# Phase 22: Agent First Contact & Dashboard Polish - Research

**Researched:** 2026-02-19
**Domain:** Agent personality bootstrapping, system prompt engineering, desktop app UX, Tauri v2 integration
**Confidence:** HIGH (codebase-driven, patterns well-established)

## Summary

Phase 22 bridges the gap between agent onboarding (Phase 21) and a living first-chat experience. The current codebase already has strong infrastructure: identity files (SOUL.md, IDENTITY.md, STYLE.md, USER.md) flow through `assembleContext()` into the system prompt, and per-message `agentId` is supported in the WS protocol. The missing piece is **system prompt instrumentation for first-contact behavior** -- telling the LLM to greet by name, introduce itself with personality, and proactively gather user information.

The "default" agent concept is woven through 15+ files with `=== "default"` checks in the db layer (`agent-resolver.ts`, `soul-manager.ts`, `identity-manager.ts`), the gateway (`tool-registry.ts`, `handlers.ts`), the desktop (`AgentsPage.tsx`, `files.ts`), and the config schema (`defaultAgentId: "default"`). Removal requires a careful migration path since existing users may have data in `~/.config/tek/memory/` that maps to the "default" agent.

The desktop app has working gateway discovery (health check via `/health` endpoint), WebSocket connection via `@tauri-apps/plugin-websocket`, and basic chat streaming. The main gaps are: chat doesn't send `agentId` in messages, the Layout/Sidebar has no padding on the content area, and the AgentsPage hardcodes a DEFAULT_AGENT card.

**Primary recommendation:** Implement a "first contact" system prompt injection that detects empty/new USER.md and triggers conversational onboarding behavior, remove the DEFAULT_AGENT constant from desktop and the `=== "default"` guard pattern across the codebase, and polish the desktop Layout with proper spacing.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vercel AI SDK (`ai`) | current | LLM streaming, tool calling | Already used for `assembleContext`, `streamChatResponse` |
| `@tauri-apps/plugin-websocket` | 2.x | Desktop WS connections | Already integrated, bypasses webview WS restrictions |
| `@tauri-apps/plugin-shell` | 2.x | Gateway process management | Already used in `process.ts` for start/stop |
| `@tauri-apps/plugin-fs` | 2.x | Config file reading | Already used in `discovery.ts` |
| Tailwind CSS | current | Desktop UI styling | Already configured in desktop app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | current | Schema validation | Already used for WS protocol, config schemas |

### Alternatives Considered
No new libraries needed. This phase is pure logic and UI polish using existing stack.

## Architecture Patterns

### Pattern 1: First-Contact System Prompt Injection
**What:** When the agent's USER.md is empty or minimal (< 50 chars), inject a "first contact" instruction block into the system prompt that tells the LLM to greet the user by name, introduce itself, and ask onboarding questions.
**When to use:** First `chat.send` for any agent with sparse USER.md.
**Confidence:** HIGH -- follows existing pattern in `assembleContext()` which already composes system prompt from identity files.

Current system prompt assembly in `assembleContext()` (line 79-88):
```typescript
const systemParts = [
    userSystemPrompt,
    memoryCtx.soul     ? `\n\n# Your Identity\n${memoryCtx.soul}` : "",
    memoryCtx.identity ? `\n\n# Your Presentation\n${memoryCtx.identity}` : "",
    memoryCtx.style    ? `\n\n# Communication Style\n${memoryCtx.style}` : "",
    memoryCtx.user     ? `\n\n# About the User\n${memoryCtx.user}` : "",
    // ... more sections
].filter(Boolean).join("");
```

The first-contact block would be injected conditionally:
```typescript
// Detect first contact: USER.md is empty or very minimal
const isFirstContact = !memoryCtx.user || memoryCtx.user.trim().length < 50;
const firstContactPrompt = isFirstContact ? buildFirstContactPrompt(agentId) : "";

const systemParts = [
    userSystemPrompt,
    memoryCtx.soul     ? `\n\n# Your Identity\n${memoryCtx.soul}` : "",
    memoryCtx.identity ? `\n\n# Your Presentation\n${memoryCtx.identity}` : "",
    memoryCtx.style    ? `\n\n# Communication Style\n${memoryCtx.style}` : "",
    memoryCtx.user     ? `\n\n# About the User\n${memoryCtx.user}` : "",
    firstContactPrompt ? `\n\n# First Contact Instructions\n${firstContactPrompt}` : "",
    // ... more sections
].filter(Boolean).join("");
```

### Pattern 2: First-Contact Prompt Template
**What:** A markdown template that instructs the agent on first-contact behavior, loaded from `memory-files/FIRST_CONTACT.md`.
**Confidence:** HIGH -- follows existing template pattern in `packages/db/memory-files/`.

```markdown
# First Contact Protocol

This is your FIRST conversation with this user. Make it count.

## Your Mission
1. Greet the user warmly by name (if known from USER.md) or ask their name
2. Introduce yourself -- share your name, personality, and what you're good at
3. Ask 2-3 questions to understand the user better:
   - What they primarily need help with
   - How they prefer to communicate (concise vs detailed, formal vs casual)
   - Any specific tools or workflows they use
4. After gathering answers, use the memory_write tool to save what you learned to USER.md

## Rules
- Be conversational, not clinical -- this should feel like meeting a colleague
- Don't ask all questions at once; weave them naturally into conversation
- Use your personality from SOUL.md -- don't be generic
- After the first few exchanges, transition naturally to helping with their actual request
- This instruction disappears once USER.md has meaningful content
```

### Pattern 3: Default Agent Removal Migration
**What:** Replace all `=== "default"` checks with `undefined` (no agent) fallback to global memory directory. Config schema changes `defaultAgentId` from `"default"` to the first real agent's ID.
**Confidence:** HIGH -- clear refactor path.

Files requiring changes (exhaustive list from grep):
- `packages/db/src/memory/agent-resolver.ts` (lines 29, 51) -- `"default"` checks in cascade
- `packages/db/src/memory/soul-manager.ts` (line 27) -- `"default"` check in loadSoul
- `packages/db/src/memory/identity-manager.ts` (lines 26, 43) -- `"default"` checks in loadIdentity/loadStyle
- `packages/db/src/schema/sessions.ts` (line 6) -- SQL default `"default"`
- `packages/db/src/connection.ts` (line 52) -- SQL DDL default
- `packages/gateway/src/ws/handlers.ts` (lines 247, 298) -- fallback to `"default"`
- `packages/gateway/src/agent/tool-registry.ts` (line 278) -- `"default"` check
- `packages/gateway/src/session/manager.ts` (line 23) -- default param `"default"`
- `packages/core/src/config/schema.ts` (line 58) -- `defaultAgentId` defaults to `"default"`
- `packages/cli/src/commands/onboard.ts` (lines 128, 135) -- init check for `"default"`
- `apps/desktop/src/pages/AgentsPage.tsx` (lines 13-18, 75, 107, 137) -- DEFAULT_AGENT constant
- `apps/desktop/src/lib/files.ts` (line 24) -- `"default"` check
- `apps/desktop/src/hooks/useIdentityFiles.ts` (line 15) -- `"default"` fallback

**Migration strategy:**
1. Change `defaultAgentId` schema default from `"default"` to `""` (empty = no default)
2. Replace all `agentId === "default"` with `!agentId` (falsy check)
3. When `agentId` is undefined/empty, use global memory dir (backward compat)
4. Remove DEFAULT_AGENT constant from AgentsPage; show "No agents yet" empty state
5. In `handlers.ts`, if no agents configured and no agentId, use `undefined` (global fallback)
6. SQL defaults stay as `"default"` for existing rows (don't migrate data)

### Pattern 4: Desktop agentId in Chat Messages
**What:** Desktop chat needs to send `agentId` in `chat.send` messages. Currently `createChatSendMessage()` doesn't include it.
**Confidence:** HIGH -- straightforward protocol addition.

Current in `gateway-client.ts`:
```typescript
export function createChatSendMessage(
    content: string,
    opts?: { sessionId?: string; model?: string },
): ClientMessage {
    return { type: "chat.send", id: crypto.randomUUID(), content, ...opts };
}
```

Needs `agentId` added to opts:
```typescript
opts?: { sessionId?: string; model?: string; agentId?: string }
```

### Pattern 5: Dashboard UI Spacing
**What:** Add consistent padding to the Layout content area and Sidebar.
**Confidence:** HIGH -- pure CSS/Tailwind.

Current Layout (no content padding):
```tsx
<main className="flex-1 overflow-y-auto">
    {children}
</main>
```

Fix: Content pages already have their own padding (`p-6`), but the ChatPage uses `flex flex-col h-full` and handles its own padding. The main issue is:
1. Sidebar nav items need more vertical spacing
2. Content area needs a consistent left margin from sidebar border
3. Dashboard quick action cards could use more breathing room

### Anti-Patterns to Avoid
- **Form-based personality setup in chat:** Phase 18 decision explicitly says "no form-based setup." Personality comes from conversational first contact, not a settings page.
- **Database-backed personality:** Phase 18 anti-pattern. Identity lives in markdown files, not DB columns.
- **Auto-writing to USER.md without the LLM deciding to:** The agent should use the `memory_write` tool naturally, not have a hardcoded "write after 3 messages" trigger.
- **Removing global memory fallback entirely:** Existing users may have data in `~/.config/tek/memory/` that would become orphaned. Keep the cascade but remove the "default" sentinel value.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| First-contact detection | Complex state machine tracking "has this agent chatted before" | Check USER.md length (< 50 chars = first contact) | Simple, stateless, works across sessions |
| Agent greeting content | Hardcoded greeting strings per personality | System prompt instruction + SOUL.md personality | LLM generates natural greetings from personality definition |
| Gateway process liveness | Custom IPC or file watchers | Existing `/health` HTTP endpoint + `runtime.json` | Already implemented and working in both CLI and desktop |
| WebSocket in Tauri webview | Native browser WebSocket API | `@tauri-apps/plugin-websocket` | Already integrated; native WS fails in Tauri due to CSP/mixed-content issues |

**Key insight:** The LLM is the personality engine. Don't try to script first-contact behavior -- give the LLM good instructions via the system prompt and let it be conversational naturally.

## Common Pitfalls

### Pitfall 1: Breaking Existing Users When Removing "default" Agent
**What goes wrong:** Users with data in `~/.config/tek/memory/` lose their identity files after migration.
**Why it happens:** The "default" agent concept maps to the global memory directory. Removing it breaks the fallback.
**How to avoid:** Keep the cascade resolution (`agent-specific > shared > global`). Only remove the `"default"` string sentinel -- don't remove the global memory directory fallback for `undefined` agentId.
**Warning signs:** Identity files return empty after migration; SOUL.md content disappears.

### Pitfall 2: First-Contact Prompt Eating Token Budget
**What goes wrong:** The first-contact instruction block is ~200-300 tokens. Combined with existing identity files, this pushes the system prompt past the 3000 token budget warning.
**Why it happens:** New agents with personality presets already have 200+ token SOUL.md files.
**How to avoid:** Keep the first-contact prompt concise (under 200 tokens). Remove it once USER.md has content (it's self-disabling).
**Warning signs:** Token budget warning in assembler logs on first chat.

### Pitfall 3: Agent Writes to Wrong USER.md
**What goes wrong:** The `memory_write` tool writes to the global USER.md instead of the agent-specific one.
**Why it happens:** `createMemoryWriteTool()` currently doesn't take an `agentId` parameter. `loadUser()` in `identity-manager.ts` always loads from global path.
**How to avoid:** Make `memory_write` agent-aware for USER.md writes. The `agentId` is already passed to `createMemoryReadTool()` but not to the write tool.
**Warning signs:** Agent A's first-contact notes appear when chatting with Agent B.

### Pitfall 4: Desktop Chat Missing agentId
**What goes wrong:** Desktop chat sends messages without `agentId`, so gateway falls back to `defaultAgentId` config value (currently `"default"`).
**Why it happens:** `createChatSendMessage()` in `gateway-client.ts` doesn't include `agentId`. Desktop `ChatPage` doesn't know which agent is selected.
**How to avoid:** Thread agent selection through the desktop app store to the chat page, include in WS messages.
**Warning signs:** Desktop chat always uses the default agent regardless of which agent the user selected.

### Pitfall 5: Tauri WebSocket CSP Blocking
**What goes wrong:** WebSocket connections fail silently in production builds.
**Why it happens:** The CSP in `tauri.conf.json` is `connect-src 'self' ws://127.0.0.1:*` which should work, but port changes or `localhost` vs `127.0.0.1` mismatches can cause failures.
**How to avoid:** Always use `127.0.0.1` (not `localhost`) in WS URLs. The Tauri WS plugin bypasses browser CSP, but only when used through the plugin API.
**Warning signs:** `useWebSocket` hook shows `error` state, console shows mixed-content or CSP violations.

## Code Examples

### First-Contact Prompt Builder
```typescript
// Source: New function in packages/gateway/src/context/assembler.ts
function buildFirstContactPrompt(agentId?: string): string {
    const config = loadConfig();
    const agent = config?.agents?.list.find(a => a.id === agentId);
    const agentName = agent?.name ?? "Assistant";
    const userName = config?.userDisplayName ?? "";

    return `# First Contact Protocol

This is your FIRST conversation with ${userName ? `**${userName}**` : "this user"}.

You are **${agentName}**. Introduce yourself naturally using your personality from the identity section above.

${userName ? `Address the user as "${userName}".` : "Ask the user what they'd like you to call them."}

After your greeting, ask 2-3 natural questions to learn about:
- What they primarily need help with
- Their communication preferences
- Any specific tools/workflows they use

Use the memory_write tool (target: "identity", file: "USER.md") to save what you learn.

Keep it conversational -- this should feel like meeting a smart colleague, not filling out a form.`;
}
```

### Agent-Aware Memory Write Tool
```typescript
// Source: Modified packages/gateway/src/tools/memory.ts
export function createMemoryWriteTool(agentId?: string) {
    return tool({
        // ... existing schema ...
        execute: async ({ target, content, section, file }) => {
            switch (target) {
                case "identity": {
                    const identityFile = (file || "SOUL.md") as ...;
                    // Use agent-specific directory for writes
                    if (agentId && identityFile === "USER.md") {
                        writeAgentIdentityFile(agentId, identityFile, section, content);
                        return `Updated section '${section}' in ${identityFile} for agent ${agentId}`;
                    }
                    // ... existing global write logic
                }
            }
        },
    });
}
```

### Desktop agentId Flow
```typescript
// Source: Modified apps/desktop/src/lib/gateway-client.ts
export function createChatSendMessage(
    content: string,
    opts?: { sessionId?: string; model?: string; agentId?: string },
): ClientMessage {
    return {
        type: "chat.send",
        id: crypto.randomUUID(),
        content,
        ...opts,
    };
}
```

### Layout Spacing Fix
```tsx
// Source: Modified apps/desktop/src/components/Layout.tsx
export function Layout({ currentPage, onNavigate, children }: LayoutProps) {
    return (
        <div className="flex h-full">
            <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
            <main className="flex-1 overflow-y-auto bg-gray-900">
                {children}
            </main>
        </div>
    );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded personality strings | File-based identity (SOUL.md etc.) | Phase 18 | Already implemented |
| Single global agent | Per-agent identity directories | Phase 16/19 | Already implemented |
| Static system prompts | Dynamic context assembly with memory | Phase 16 | Already implemented |
| Config-level defaultAgentId | Per-message agentId in WS protocol | Phase 21 | Already implemented |
| Form-based personality setup | Conversational onboarding (BOOTSTRAP.md) | Phase 18 | Template exists, not yet wired |

**OpenClaw patterns (for inspiration):**
- Uses workspace-level files (AGENTS.md, SOUL.md, TOOLS.md) injected into prompts -- similar to Tek's approach
- Wizard-driven CLI onboarding for initial setup
- Per-agent sessions with isolated workspaces
- Personality emerges from context files, not hardcoded strings

## Open Questions

1. **Should first-contact behavior be per-session or per-agent?**
   - What we know: USER.md content is the detection mechanism (empty = first contact). Once populated, first-contact prompt disappears.
   - What's unclear: If user deletes USER.md, should the agent re-introduce itself?
   - Recommendation: Per-agent (based on USER.md state). Deletion = fresh start. This is the simplest and most predictable.

2. **Should the memory_write tool for USER.md be agent-scoped or shared?**
   - What we know: Phase 18 decided USER.md is "shared across all agents" (`loadUser()` loads from global). But per-agent first-contact means each agent might learn different things about the user.
   - What's unclear: Should Agent A's notes about the user be visible to Agent B?
   - Recommendation: Keep USER.md in shared directory but allow agent-specific overrides via cascade resolution. First contact writes to agent-specific USER.md; shared USER.md contains common info like name.

3. **Desktop agent selection for chat -- where does it live?**
   - What we know: CLI has interactive agent picker (`resolveAgentId` in `chat.ts`). Desktop has no equivalent.
   - What's unclear: Should agent selection be in the sidebar, a dropdown in the chat header, or the agents page?
   - Recommendation: Agent selector dropdown in chat header bar (next to connection status dot). Stored in app-store. Simple, visible, doesn't require page navigation.

4. **How to handle `tek chat` with zero agents after removing "default"?**
   - What we know: Currently `resolveAgentId` returns `undefined` for zero agents (legacy mode). Handlers fall back to `"default"` string.
   - What's unclear: Should `tek chat` with zero agents prompt to run `tek onboard` first, or work in legacy mode?
   - Recommendation: Prompt to run `tek onboard`. This matches Phase 21 decision that init prompts onboard. No agents = no chat.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/gateway/src/context/assembler.ts` -- system prompt assembly
- Codebase analysis: `packages/db/src/memory/agent-resolver.ts` -- cascade resolution
- Codebase analysis: `packages/gateway/src/ws/handlers.ts` -- agentId flow
- Codebase analysis: `packages/cli/src/commands/onboard.ts` -- agent creation flow
- Codebase analysis: `packages/gateway/src/tools/memory.ts` -- memory read/write tools
- Codebase analysis: `apps/desktop/src/` -- all desktop components and hooks
- Codebase analysis: `packages/db/memory-files/BOOTSTRAP.md` -- existing first-contact template
- Codebase analysis: All files matching `"default"` pattern (15+ locations)

### Secondary (MEDIUM confidence)
- OpenClaw GitHub README (https://github.com/openclaw/openclaw) -- workspace file architecture, onboarding patterns
- Tauri v2 WebSocket plugin docs (https://v2.tauri.app/plugin/websocket/) -- WS connection patterns
- Tauri v2 plugin issues (https://github.com/tauri-apps/plugins-workspace/issues/1507) -- WS reload handling

### Tertiary (LOW confidence)
- UX pattern articles for AI agent onboarding -- general principles, not Tek-specific
- OpenClaw personality customization -- inferred from limited public documentation

## Metadata

**Confidence breakdown:**
- First-contact system prompt: HIGH -- clear pattern from existing assembler + BOOTSTRAP.md template
- Default agent removal: HIGH -- exhaustive grep of all 15+ locations, clear migration path
- Desktop gateway/chat: HIGH -- existing implementation reviewed, gaps identified
- Dashboard UI polish: HIGH -- straightforward Tailwind changes
- OpenClaw patterns: MEDIUM -- limited public documentation, inferred from README

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable domain, no rapidly evolving dependencies)
