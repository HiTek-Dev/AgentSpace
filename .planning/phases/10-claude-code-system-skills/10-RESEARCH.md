# Phase 10: Claude Code & System Skills - Research

**Researched:** 2026-02-16
**Domain:** Claude Code CLI orchestration, system skill integration (web search, image generation, browser automation, Google Workspace)
**Confidence:** HIGH

## Summary

Phase 10 has two distinct halves: (1) orchestrating Claude Code as a managed subprocess with bidirectional streaming and interactive prompt proxying, and (2) providing built-in system skills for web search, image generation, browser automation, and Google Workspace. The Claude Code Agent SDK (`@anthropic-ai/claude-agent-sdk`) is the correct integration surface -- it provides a TypeScript `query()` function that spawns Claude Code and returns an async generator of typed `SDKMessage` events with full streaming, tool approval callbacks, and session management. For the system skills, Playwright MCP (`@playwright/mcp`) is the standard for browser automation, `openai` npm for image generation (gpt-image-1.5 replacing deprecated DALL-E 3), `googleapis` for Google Workspace, and the existing AI SDK web search tool or a dedicated search API for web search.

**Primary recommendation:** Use `@anthropic-ai/claude-agent-sdk` for Claude Code integration with the `canUseTool` callback for proxied approval, and implement system skills as AI SDK `tool()` definitions registered in the existing tool registry.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/claude-agent-sdk` | ~0.2.x | Spawn and manage Claude Code sessions programmatically | Official Anthropic SDK; provides `query()` async generator, typed events, streaming, tool approval callbacks, session resume |
| `@playwright/mcp` | latest | Browser automation via MCP protocol | Official Microsoft Playwright MCP server; 25+ browser tools; accessibility-tree based (no vision needed) |
| `openai` | ^4.x | Image generation via OpenAI API | Official OpenAI SDK; supports gpt-image-1.5 (current), gpt-image-1, DALL-E 3 (deprecated May 2026) |
| `googleapis` | ^144.x | Google Workspace integration (Gmail, Drive, Calendar, Docs) | Official Google client; TypeScript types built-in; OAuth 2.0 + service account auth |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@stability-ai/api` or REST fetch | latest | Stability AI image generation (Stable Image Core/Ultra) | Alternative/additional image generation provider |
| `execa` | existing | Process spawning (already in project) | Fallback if Agent SDK has issues |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Agent SDK `query()` | CLI `claude -p --output-format stream-json` via child_process | Lower-level, must parse NDJSON manually, no typed events, but avoids SDK dependency |
| `@playwright/mcp` | `@executeautomation/playwright-mcp-server` | Community alternative, but official Microsoft package is better maintained |
| `googleapis` monolith | Individual `@googleapis/gmail`, `@googleapis/drive` etc. | Smaller bundles but multiple deps; monolith is simpler for multi-API access |

**Installation:**
```bash
npm install @anthropic-ai/claude-agent-sdk @playwright/mcp openai googleapis
```

## Architecture Patterns

### Recommended Project Structure
```
packages/gateway/src/
├── claude-code/
│   ├── session-manager.ts    # Spawn/manage Claude Code sessions
│   ├── event-relay.ts        # Map SDK events to transport ServerMessages
│   ├── approval-proxy.ts     # Proxy approval requests to active channel
│   └── types.ts              # ClaudeCodeSession state types
├── skills/
│   ├── web-search.ts         # Web search skill (AI SDK tool)
│   ├── image-gen.ts          # Image generation skill (DALL-E, Stability)
│   ├── browser.ts            # Browser automation (Playwright MCP wrapper)
│   └── google-workspace.ts   # Gmail, Drive, Calendar, Docs skill
└── tools/
    └── claude-code.ts        # Claude Code as an AI SDK tool for workflows
```

### Pattern 1: Claude Code Session Manager
**What:** A manager class that wraps `@anthropic-ai/claude-agent-sdk` `query()`, consuming the async generator and relaying events to AgentSpace's transport layer.
**When to use:** For CCDE-01 through CCDE-04 -- spawning, streaming, and proxying Claude Code.
**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/agent-sdk/typescript
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

interface ClaudeCodeSession {
  id: string;
  queryInstance: ReturnType<typeof query>;
  abortController: AbortController;
  status: "running" | "completed" | "error";
}

async function spawnSession(
  prompt: string,
  cwd: string,
  transport: Transport,
  requestId: string,
): Promise<ClaudeCodeSession> {
  const abortController = new AbortController();

  const queryInstance = query({
    prompt,
    options: {
      cwd,
      abortController,
      includePartialMessages: true,
      permissionMode: "default",  // requires approval
      canUseTool: async (toolName, input, { signal }) => {
        // Proxy approval to AgentSpace transport
        return proxyApprovalToUser(toolName, input, transport, requestId, signal);
      },
    },
  });

  // Consume the async generator and relay events
  const session: ClaudeCodeSession = {
    id: crypto.randomUUID(),
    queryInstance,
    abortController,
    status: "running",
  };

  consumeAndRelay(session, transport, requestId);
  return session;
}
```

### Pattern 2: Event Relay (SDK Events to ServerMessages)
**What:** Map Claude Agent SDK `SDKMessage` types to AgentSpace `ServerMessage` protocol types for transport to the active channel.
**When to use:** For CCDE-04 -- streaming output to user's active interface.
**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/agent-sdk/streaming-output
async function consumeAndRelay(
  session: ClaudeCodeSession,
  transport: Transport,
  requestId: string,
) {
  for await (const message of session.queryInstance) {
    switch (message.type) {
      case "stream_event": {
        const event = message.event;
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          transport.send({
            type: "claude-code.stream.delta",
            requestId,
            sessionId: session.id,
            delta: event.delta.text,
          });
        }
        break;
      }
      case "assistant": {
        // Complete assistant message -- relay tool calls
        transport.send({
          type: "claude-code.assistant",
          requestId,
          sessionId: session.id,
          message: message.message,
        });
        break;
      }
      case "result": {
        transport.send({
          type: "claude-code.result",
          requestId,
          sessionId: session.id,
          subtype: message.subtype,
          result: message.subtype === "success" ? message.result : undefined,
          cost: message.total_cost_usd,
          usage: message.usage,
        });
        session.status = "completed";
        break;
      }
    }
  }
}
```

### Pattern 3: Approval Proxying via canUseTool
**What:** Use the Agent SDK's `canUseTool` callback to intercept permission requests, send them over the AgentSpace transport to whichever channel the user is on, and await their response.
**When to use:** For CCDE-02 and CCDE-03 -- interactive prompt proxying.
**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/agent-sdk/typescript
async function proxyApprovalToUser(
  toolName: string,
  input: unknown,
  transport: Transport,
  requestId: string,
  signal: AbortSignal,
): Promise<PermissionResult> {
  const approvalId = crypto.randomUUID();

  // Send approval request to active channel
  transport.send({
    type: "claude-code.approval.request",
    requestId,
    approvalId,
    toolName,
    input,
  });

  // Wait for user response (reuse existing pendingApprovals pattern)
  const approved = await waitForUserApproval(approvalId, signal);

  if (approved) {
    return { behavior: "allow", updatedInput: input };
  }
  return { behavior: "deny", message: "User denied permission" };
}
```

### Pattern 4: System Skills as AI SDK Tools
**What:** Each system skill is implemented as an `ai.tool()` definition, registered in the existing tool registry alongside filesystem and shell tools.
**When to use:** For SYST-04 through SYST-07.
**Example:**
```typescript
// Web search skill
import { tool } from "ai";
import { z } from "zod";

export function createWebSearchTool() {
  return tool({
    description: "Search the web for information",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
      maxResults: z.number().optional().default(5),
    }),
    execute: async ({ query, maxResults }) => {
      // Implementation depends on search provider
      // Options: Brave Search API, SerpAPI, Tavily, etc.
      const results = await searchProvider.search(query, maxResults);
      return { results };
    },
  });
}
```

### Pattern 5: Claude Code as Workflow Tool
**What:** Expose Claude Code as a tool in the workflow engine so workflow steps can delegate complex coding tasks.
**When to use:** For CCDE-05 -- orchestrating Claude Code within workflows.
**Example:**
```typescript
export function createClaudeCodeTool(sessionManager: ClaudeCodeSessionManager) {
  return tool({
    description: "Spawn a Claude Code session to perform a coding task",
    inputSchema: z.object({
      prompt: z.string().describe("The coding task to perform"),
      cwd: z.string().optional().describe("Working directory"),
      allowedTools: z.array(z.string()).optional(),
      maxTurns: z.number().optional().default(10),
    }),
    execute: async ({ prompt, cwd, allowedTools, maxTurns }) => {
      // For workflow usage, use bypassPermissions or pre-approved tools
      const result = await sessionManager.runToCompletion(prompt, {
        cwd,
        allowedTools,
        maxTurns,
        permissionMode: "acceptEdits", // workflows are pre-approved
      });
      return result;
    },
  });
}
```

### Anti-Patterns to Avoid
- **Spawning `claude` CLI via `child_process.spawn()` directly:** The Agent SDK handles process lifecycle, error recovery, and typed events. Raw CLI spawning loses all of this and requires manual NDJSON parsing.
- **Blocking on Claude Code completion in the agent loop:** Claude Code sessions can run for minutes. Never block the main agent loop; run sessions asynchronously and relay events.
- **Sharing a single Playwright browser across sessions:** Each browser automation session needs its own context to avoid state leakage. Use isolated or per-session contexts.
- **Hardcoding API keys in skill implementations:** All provider keys should come from AgentSpace config or environment variables, not skill source code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude Code process management | Custom child_process spawner + NDJSON parser | `@anthropic-ai/claude-agent-sdk` `query()` | SDK handles spawn, crash recovery, typed events, session resume, sandboxing |
| Browser automation protocol | Custom WebSocket-to-Chrome DevTools bridge | `@playwright/mcp` MCP server via existing MCPClientManager | Already have MCP infrastructure; Playwright MCP provides 25+ tools |
| Google OAuth 2.0 flow | Custom token exchange/refresh logic | `googleapis` auth module (OAuth2Client) | Handles token refresh, service accounts, JWT, credential caching |
| Image generation multi-provider | Custom HTTP clients per provider | `openai` SDK + REST for Stability | SDKs handle retries, rate limiting, response parsing |

**Key insight:** The project already has MCP client infrastructure (`MCPClientManager`) and a tool registry pattern. Playwright MCP plugs directly into MCP; other skills plug into the tool registry as `ai.tool()` definitions. No new infrastructure patterns needed.

## Common Pitfalls

### Pitfall 1: Claude Code Hanging on Exit
**What goes wrong:** Claude Code CLI (and by extension the SDK) can hang after sending the final result event, keeping the process alive indefinitely.
**Why it happens:** Known bug in Claude Code CLI (documented in GitHub issue #25629). The process doesn't always exit cleanly after streaming mode completes.
**How to avoid:** Always use the `abortController` option and implement a timeout. After receiving a `result` message, set a timer (e.g., 10s) and call `abort()` if the generator hasn't completed.
**Warning signs:** Session status shows "completed" but the async generator hasn't returned.

### Pitfall 2: Approval Proxy Deadlock
**What goes wrong:** User is on Telegram, Claude Code requests approval, but the approval relay doesn't reach the Telegram transport.
**Why it happens:** The `canUseTool` callback blocks the Claude Code session until it resolves. If the transport layer has no active connection or the user switches channels, the approval never arrives.
**How to avoid:** Implement approval timeouts (reuse existing `APPROVAL_TIMEOUT_MS` pattern from `tool-loop.ts`). Fan out approval requests to ALL connected transports (not just the "active" one). Track which transport responds.
**Warning signs:** Claude Code sessions stuck in "waiting for approval" with no client-side prompt visible.

### Pitfall 3: DALL-E 3 Deprecation
**What goes wrong:** Image generation silently fails or uses a deprecated model.
**Why it happens:** DALL-E 2 and DALL-E 3 are deprecated, sunsetting May 2026. OpenAI's current models are `gpt-image-1.5` (best), `gpt-image-1`, and `gpt-image-1-mini`.
**How to avoid:** Default to `gpt-image-1.5` for the image generation skill. Make the model configurable. Include a fallback chain.
**Warning signs:** 404 errors or deprecation warnings from the OpenAI API.

### Pitfall 4: Google Service Account Access Restriction
**What goes wrong:** Service account can't access user files on Google Drive.
**Why it happens:** As of April 2025, new Google Service Accounts can only access shared drives, not "My Drive". Domain-wide delegation is required for personal drive access.
**How to avoid:** Support both OAuth 2.0 (for personal accounts) and service accounts (for organizational use). Default to OAuth 2.0 flow for individual users. Document the setup clearly.
**Warning signs:** 403 errors when accessing Drive files that clearly exist.

### Pitfall 5: Playwright MCP Browser State Leakage
**What goes wrong:** Login sessions from one automation task leak into another.
**Why it happens:** Playwright MCP can persist browser profiles by default using `--user-data-dir`.
**How to avoid:** Use `--isolated` flag for ephemeral sessions. Only use persistent profiles when explicitly configured for a specific site login.
**Warning signs:** Unexpected cookies or login states in automation tasks.

### Pitfall 6: Streaming Backpressure
**What goes wrong:** Claude Code generates output faster than the WebSocket/Telegram transport can deliver, causing memory buildup.
**Why it happens:** The Agent SDK yields events continuously. If the transport is slow (Telegram rate limits, slow WebSocket), buffered events accumulate.
**How to avoid:** Implement throttled relay (similar to the existing streaming accumulator from Phase 9). Batch text deltas with a minimum interval (e.g., 50ms for WS, 1s for Telegram).
**Warning signs:** Gateway memory usage growing during long Claude Code sessions.

## Code Examples

### Claude Code Session with Streaming
```typescript
// Source: https://platform.claude.com/docs/en/agent-sdk/typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const abortController = new AbortController();

const session = query({
  prompt: "Fix the failing tests in src/auth/",
  options: {
    cwd: "/path/to/project",
    abortController,
    includePartialMessages: true,
    allowedTools: ["Read", "Edit", "Bash", "Grep", "Glob"],
    canUseTool: async (toolName, input) => {
      // Auto-approve safe tools, proxy dangerous ones
      if (["Read", "Grep", "Glob"].includes(toolName)) {
        return { behavior: "allow", updatedInput: input };
      }
      // Proxy to user...
      return proxyToUser(toolName, input);
    },
  },
});

for await (const msg of session) {
  if (msg.type === "stream_event") {
    // Handle streaming text deltas
    const event = msg.event;
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      process.stdout.write(event.delta.text);
    }
  } else if (msg.type === "result") {
    console.log(`Done: ${msg.subtype}, cost: $${msg.total_cost_usd}`);
  }
}
```

### Image Generation Tool (OpenAI)
```typescript
// Source: https://platform.openai.com/docs/guides/image-generation
import { tool } from "ai";
import { z } from "zod";
import OpenAI from "openai";

export function createImageGenTool(apiKey: string) {
  const openai = new OpenAI({ apiKey });

  return tool({
    description: "Generate an image from a text prompt using OpenAI",
    inputSchema: z.object({
      prompt: z.string().describe("Text description of the image to generate"),
      size: z.enum(["1024x1024", "1024x1792", "1792x1024"]).optional().default("1024x1024"),
      model: z.enum(["gpt-image-1.5", "gpt-image-1", "dall-e-3"]).optional().default("gpt-image-1.5"),
    }),
    execute: async ({ prompt, size, model }) => {
      const result = await openai.images.generate({
        model,
        prompt,
        size,
        n: 1,
      });
      return {
        url: result.data[0].url,
        revisedPrompt: result.data[0].revised_prompt,
      };
    },
  });
}
```

### Playwright MCP Integration
```typescript
// Source: https://github.com/microsoft/playwright-mcp
// Uses existing MCPClientManager -- no custom code needed for the MCP connection
// Just add to config:
const playwrightMcpConfig = {
  command: "npx",
  args: ["@playwright/mcp@latest", "--headless"],
  // Optional: "--browser", "chromium", "--isolated"
};

// Registered via existing mcpServers config in agentspace.json:
// "mcpServers": {
//   "playwright": {
//     "command": "npx",
//     "args": ["@playwright/mcp@latest", "--headless"]
//   }
// }
// Tools auto-namespaced as "playwright.browser_navigate", "playwright.browser_click", etc.
```

### Google Workspace Skill
```typescript
// Source: https://github.com/googleapis/google-api-nodejs-client
import { google } from "googleapis";
import { tool } from "ai";
import { z } from "zod";

export function createGmailSearchTool(auth: any) {
  const gmail = google.gmail({ version: "v1", auth });

  return tool({
    description: "Search Gmail messages",
    inputSchema: z.object({
      query: z.string().describe("Gmail search query (same syntax as Gmail search bar)"),
      maxResults: z.number().optional().default(10),
    }),
    execute: async ({ query, maxResults }) => {
      const res = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
      });
      // Fetch message details for each result
      const messages = await Promise.all(
        (res.data.messages ?? []).map(async (m) => {
          const detail = await gmail.users.messages.get({
            userId: "me",
            id: m.id!,
            format: "metadata",
            metadataHeaders: ["Subject", "From", "Date"],
          });
          return {
            id: m.id,
            subject: detail.data.payload?.headers?.find(h => h.name === "Subject")?.value,
            from: detail.data.payload?.headers?.find(h => h.name === "From")?.value,
            date: detail.data.payload?.headers?.find(h => h.name === "Date")?.value,
            snippet: detail.data.snippet,
          };
        }),
      );
      return { messages, total: res.data.resultSizeEstimate };
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `claude -p --output-format stream-json` CLI | `@anthropic-ai/claude-agent-sdk` TypeScript SDK | 2025 | Typed events, tool callbacks, session management built-in |
| DALL-E 3 (`dall-e-3` model) | GPT Image 1.5 (`gpt-image-1.5`) | 2025 | DALL-E 3 deprecated May 2026; new API surface same but model names differ |
| Manual Chrome DevTools Protocol | Playwright MCP (`@playwright/mcp`) | March 2025 | Accessibility-tree based, 25+ standard tools, MCP-native |
| Google Service Account for all Drive | OAuth 2.0 for personal, SA for shared only | April 2025 | New SAs cannot access My Drive; domain delegation required for personal |

**Deprecated/outdated:**
- `@anthropic-ai/claude-code` (old package name) -- now `@anthropic-ai/claude-agent-sdk`
- DALL-E 2, DALL-E 3 -- sunset May 2026, replaced by gpt-image-1.x family
- Stability AI SDXL endpoints -- two endpoints discontinuing July 2025; use Stable Image Core/Ultra

## Open Questions

1. **Claude Code API key source for AgentSpace**
   - What we know: The Agent SDK uses the user's own Anthropic API key or Claude.ai subscription
   - What's unclear: Should AgentSpace use its own API key for Claude Code sessions, or the user's? Cost attribution differs.
   - Recommendation: Allow configuration of a dedicated Claude Code API key in AgentSpace config, defaulting to the user's ANTHROPIC_API_KEY env var

2. **Web search provider selection (SYST-04)**
   - What we know: AI SDK has built-in web search for some providers. Standalone options include Brave Search API, Tavily, SerpAPI.
   - What's unclear: Which provider offers the best quality/cost ratio for AgentSpace's use case
   - Recommendation: Make the search provider configurable. Start with Tavily (good free tier, simple API) or Brave Search (independent index). Abstract behind a provider interface.

3. **Google Workspace auth flow UX**
   - What we know: OAuth 2.0 requires a browser redirect for user consent. Service accounts need manual GCP setup.
   - What's unclear: How to handle the OAuth consent flow when the user is on CLI or Telegram (no browser)
   - Recommendation: Implement a one-time setup flow that generates and stores refresh tokens. Provide a `/setup google` command that opens a browser auth URL and stores credentials.

4. **Stability AI SDK availability**
   - What we know: Stability AI has a REST API at platform.stability.ai. No official Node.js SDK found.
   - What's unclear: Whether an official SDK exists or if raw fetch is the way
   - Recommendation: Use raw `fetch` calls to Stability AI REST API. Wrap in a simple provider class. The API is straightforward multipart form POST.

## Sources

### Primary (HIGH confidence)
- [Claude Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript) -- Full API surface, types, `query()` function, `canUseTool`, `SDKMessage` types
- [Claude Agent SDK Streaming](https://platform.claude.com/docs/en/agent-sdk/streaming-output) -- Stream event types, `SDKPartialAssistantMessage`, message flow
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) -- All CLI flags, `--output-format`, `--permission-prompt-tool`
- [Claude Code Headless/Programmatic](https://code.claude.com/docs/en/headless) -- SDK usage patterns, `--continue`, structured output
- [Playwright MCP GitHub](https://github.com/microsoft/playwright-mcp) -- MCP config, tools, transport modes, browser options
- [OpenAI Image Generation](https://platform.openai.com/docs/guides/image-generation) -- gpt-image-1.5 model, API surface
- [googleapis npm](https://www.npmjs.com/package/googleapis) -- Google API client, OAuth 2.0, service accounts

### Secondary (MEDIUM confidence)
- [@anthropic-ai/claude-agent-sdk npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) -- Version info, package metadata
- [Claude Code Issue #25629](https://github.com/anthropics/claude-code/issues/25629) -- CLI hanging bug in stream-json mode
- [Stability AI API Pricing Update](https://stability.ai/api-pricing-update-25) -- Endpoint deprecations July 2025
- [Google Service Account Restriction](https://developers.google.com/workspace/drive/api/quickstart/nodejs) -- April 2025 shared drive limitation

### Tertiary (LOW confidence)
- Stability AI REST API details -- could not access docs (Cloudflare protection); needs direct verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All recommendations based on official SDK docs and npm packages
- Architecture: HIGH -- Patterns directly derived from existing AgentSpace codebase + official SDK examples
- Pitfalls: HIGH -- Most pitfalls documented in official sources or GitHub issues
- Google Workspace auth: MEDIUM -- OAuth flow UX for non-browser channels needs experimentation
- Stability AI integration: LOW -- Could not access API docs; raw REST approach needs validation

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days -- Agent SDK is rapidly evolving)
