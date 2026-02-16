# Phase 6: Agent Capabilities - Research

**Researched:** 2026-02-16
**Domain:** MCP tool integration, tool approval gates, shell execution sandboxing, filesystem access control, pre-flight planning, skills directory
**Confidence:** HIGH

## Summary

Phase 6 transforms AgentSpace from a conversational LLM interface into an agentic platform that can discover tools, execute them with user oversight, read/write files, and run shell commands. The research reveals a mature, converging ecosystem: the **AI SDK 6 `@ai-sdk/mcp` package** provides first-class MCP client integration that converts MCP tools directly into AI SDK tool objects, while AI SDK 6's **`needsApproval` flag and `ToolLoopAgent`** handle the human-in-the-loop approval flow natively. The **Model Context Protocol (MCP) TypeScript SDK** (`@modelcontextprotocol/sdk`) handles low-level transport (stdio, Streamable HTTP) for connecting to user-configured MCP servers.

The codebase already has substantial scaffolding for Phase 6: the context assembler has stub sections for `skills` and `tools`, the CLI gateway-client defines `ToolCallMessage` and `BashCommandMessage` discriminated union types, and the `MessageBubble` component has a `tool_call` rendering case. The security module already implements `isPathWithinWorkspace()` for filesystem sandboxing, and the config schema includes `securityMode` ("full-control" | "limited-control") and `workspaceDir`. The streaming infrastructure (`streamText` in `stream.ts`) needs to be upgraded from text-only streaming to tool-aware streaming (using `fullStream` instead of `textStream`).

The pre-flight checklist requirement (AGNT-04/05) has no off-the-shelf library; it must be built as a custom gateway feature that analyzes the agent's planned steps before execution. The SKILL.md metadata format follows emerging ecosystem conventions (Claude Code, GitHub Copilot) using YAML frontmatter for discovery metadata and markdown body for instructions.

**Primary recommendation:** Use `@ai-sdk/mcp` (v1.0.x) + `@modelcontextprotocol/sdk` for MCP integration, AI SDK 6's `tool()` with `needsApproval` for approval gates, `execa` (v9.x) for safe shell execution, extend the existing WebSocket protocol with tool-call/approval message types, and build the pre-flight checklist as a gateway-side analysis step that runs before the agent loop begins.

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@ai-sdk/mcp` | ^1.0.20 | MCP client for AI SDK - converts MCP tools to AI SDK tools | Official Vercel adapter. `createMCPClient()` handles transport, `tools()` method returns AI SDK-compatible tool objects. Supports stdio, SSE, and Streamable HTTP transports. |
| `@modelcontextprotocol/sdk` | latest v1.x | Low-level MCP transports (StdioClientTransport, StreamableHTTPClientTransport) | Official MCP SDK. Provides transport implementations that `@ai-sdk/mcp` consumes. v1.x is production-recommended; v2 is pre-alpha. |
| `ai` | ^6.0.86 (already installed) | Tool calling via `tool()`, `streamText` with `fullStream`, `needsApproval`, `ToolLoopAgent` | Already in use for streaming. Upgrade usage from `textStream` to `fullStream` to capture tool-call/tool-result events. |
| `execa` | ^9.6.0 | Safe shell command execution | Promise-based, no shell injection risk with template tag API, automatic zombie process cleanup, cross-platform. ESM-only, matches project setup. |
| `zod` | ^4.3.6 (already installed) | Schema validation for tool inputs, MCP config, approval policies | Already in use throughout. Tool input schemas use Zod natively in AI SDK. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gray-matter` | ^4.0.3 | Parse YAML frontmatter from SKILL.md files | Skills directory: extract metadata from SKILL.md without hand-rolling YAML parsing |
| `glob` | ^11.x | Filesystem glob for skill discovery | Discover `*/SKILL.md` files in skills directories |
| `tokenx` | ^1.3.0 (already installed) | Token estimation for pre-flight cost calculation | Pre-flight checklist: estimate context + tool description token costs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@ai-sdk/mcp` | Direct `@modelcontextprotocol/sdk` Client class | More control but must manually convert MCP tool schemas to AI SDK format. `@ai-sdk/mcp` does this automatically. |
| `execa` | Node.js built-in `child_process.execFile` | Execfile avoids shell injection but lacks timeout management, streaming output, and cross-platform normalization that execa provides. |
| `ToolLoopAgent` | Manual `streamText` loop with `stopWhen` | ToolLoopAgent is higher-level but less flexible. For AgentSpace, manual streamText with stopWhen gives more control over the approval/streaming UX. |
| `gray-matter` | Hand-rolled YAML frontmatter parser | gray-matter handles edge cases (TOML, JSON frontmatter, excerpts) and is the de facto standard (35M+ weekly downloads). |

**Installation:**

```bash
# New dependencies for gateway
pnpm --filter @agentspace/gateway add @ai-sdk/mcp @modelcontextprotocol/sdk execa

# New dependencies for core (skills parsing)
pnpm --filter @agentspace/core add gray-matter glob
```

## Architecture Patterns

### Recommended Project Structure

```
packages/
├── gateway/
│   └── src/
│       ├── agent/                    # NEW: Agent loop and tool execution
│       │   ├── tool-loop.ts          # streamText-based agent loop with tool calling
│       │   ├── tool-registry.ts      # Merge MCP tools + built-in tools into unified set
│       │   ├── approval-gate.ts      # Tool approval policy evaluation
│       │   └── preflight.ts          # Pre-flight checklist generation
│       ├── mcp/                      # NEW: MCP server management
│       │   ├── client-manager.ts     # Lifecycle management for MCP client connections
│       │   ├── config.ts             # Load/validate mcpServers config
│       │   └── index.ts
│       ├── tools/                    # NEW: Built-in tool implementations
│       │   ├── filesystem.ts         # read_file, write_file, list_files
│       │   ├── shell.ts             # execute_command tool
│       │   └── index.ts
│       ├── ws/
│       │   ├── protocol.ts          # EXTEND: Add tool-call, approval, preflight messages
│       │   ├── handlers.ts          # EXTEND: Add tool/agent handlers
│       │   └── ...
│       ├── context/
│       │   ├── assembler.ts         # EXTEND: Fill skills + tools sections
│       │   └── ...
│       └── ...
├── core/
│   └── src/
│       ├── config/
│       │   ├── schema.ts            # EXTEND: Add mcpServers and toolApproval config
│       │   └── ...
│       └── skills/                   # NEW: Skills directory management
│           ├── loader.ts             # Discover and parse SKILL.md files
│           ├── types.ts              # SkillMetadata, SkillTier types
│           └── index.ts
├── cli/
│   └── src/
│       ├── hooks/
│       │   └── useSlashCommands.ts   # EXTEND: Add /tools, /skills, /approve commands
│       ├── components/
│       │   ├── MessageBubble.tsx     # EXTEND: Render tool_call and bash_command types
│       │   ├── ToolApprovalPrompt.tsx # NEW: Interactive approval UI
│       │   └── PreflightChecklist.tsx # NEW: Pre-flight review UI
│       └── lib/
│           └── gateway-client.ts     # EXTEND: Add tool/approval message factories
└── ...
```

### Pattern 1: MCP Client Lifecycle Management (Singleton Pool)

**What:** A singleton MCPClientManager that lazily connects to user-configured MCP servers, caches connections, and handles reconnection/cleanup.

**When to use:** On first tool call or agent session start, not at gateway boot (servers may not be running).

**Example:**

```typescript
// Source: @ai-sdk/mcp docs + existing singleton pattern from handlers.ts
import { createMCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface MCPServerConfig {
  command?: string;       // stdio transport
  args?: string[];
  env?: Record<string, string>;
  url?: string;           // HTTP/SSE transport
  transport?: "stdio" | "http" | "sse";
}

class MCPClientManager {
  private clients = new Map<string, Awaited<ReturnType<typeof createMCPClient>>>();

  async getTools(serverName: string, config: MCPServerConfig) {
    let client = this.clients.get(serverName);
    if (!client) {
      client = await this.connect(serverName, config);
      this.clients.set(serverName, client);
    }
    return client.tools();
  }

  private async connect(name: string, config: MCPServerConfig) {
    if (config.command) {
      return createMCPClient({
        transport: new StdioClientTransport({
          command: config.command,
          args: config.args ?? [],
          env: config.env,
        }),
      });
    }
    if (config.url) {
      return createMCPClient({
        transport: {
          type: (config.transport ?? "http") as "http" | "sse",
          url: config.url,
        },
      });
    }
    throw new Error(`Invalid MCP config for "${name}"`);
  }

  async closeAll() {
    for (const [name, client] of this.clients) {
      await client.close().catch(() => {});
      this.clients.delete(name);
    }
  }
}
```

### Pattern 2: Tool-Aware Streaming via fullStream

**What:** Upgrade from `textStream` to `fullStream` to capture tool-call and tool-result events during streaming, relaying them to the client over WebSocket.

**When to use:** Every chat.send that enters the agent loop.

**Example:**

```typescript
// Source: AI SDK docs (ai-sdk.dev/docs/ai-sdk-core/stream-text)
import { streamText, tool } from "ai";
import { z } from "zod";

// Instead of:
//   for await (const chunk of result.textStream) { ... }
// Use:
const result = streamText({
  model: languageModel,
  messages,
  system,
  tools: mergedTools, // MCP tools + built-in tools
  stopWhen: stepCountIs(10),
  onStepFinish({ toolCalls, toolResults, usage }) {
    // Record per-step usage, emit tool results to client
  },
});

for await (const part of result.fullStream) {
  switch (part.type) {
    case "text-delta":
      send(socket, { type: "chat.stream.delta", requestId, delta: part.textDelta });
      break;
    case "tool-call":
      send(socket, {
        type: "tool.call",
        requestId,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.args,
      });
      break;
    case "tool-result":
      send(socket, {
        type: "tool.result",
        requestId,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        result: part.result,
      });
      break;
    case "finish-step":
      // Step boundary - useful for multi-step tracking
      break;
  }
}
```

### Pattern 3: Tiered Tool Approval with needsApproval

**What:** Use AI SDK 6's `needsApproval` to implement three-tier approval: auto-approve (safe reads), session-approve (approved once per session), and always-ask (dangerous operations).

**When to use:** Every tool definition in the merged tool registry.

**Example:**

```typescript
// Source: AI SDK docs (ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
type ApprovalTier = "auto" | "session" | "always";

interface ApprovalPolicy {
  defaultTier: ApprovalTier;
  perTool: Record<string, ApprovalTier>;
  sessionApprovals: Set<string>; // toolNames approved this session
}

function wrapToolWithApproval(
  name: string,
  originalTool: any,
  policy: ApprovalPolicy,
) {
  const tier = policy.perTool[name] ?? policy.defaultTier;

  return tool({
    ...originalTool,
    needsApproval: tier === "auto"
      ? false
      : tier === "session"
        ? async ({ toolName }) => !policy.sessionApprovals.has(toolName)
        : true, // "always" tier
  });
}
```

### Pattern 4: Filesystem Tools with Security Mode Enforcement

**What:** Built-in read_file/write_file/list_files tools that respect the security mode boundary. Full Control mode allows system-wide access; Limited Control restricts to workspaceDir.

**When to use:** Built-in tools, always available.

**Example:**

```typescript
// Source: existing security.ts isPathWithinWorkspace pattern
import { isPathWithinWorkspace } from "@agentspace/core";
import { tool } from "ai";
import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";

function createFilesystemTools(securityMode: string, workspaceDir?: string) {
  return {
    read_file: tool({
      description: "Read the contents of a file",
      inputSchema: z.object({ path: z.string() }),
      needsApproval: false, // reads are safe
      execute: async ({ path }) => {
        if (securityMode === "limited-control" && workspaceDir) {
          if (!isPathWithinWorkspace(path, workspaceDir)) {
            throw new Error(`Access denied: ${path} is outside workspace`);
          }
        }
        return readFile(path, "utf-8");
      },
    }),
    write_file: tool({
      description: "Write content to a file",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      needsApproval: true, // writes always need approval
      execute: async ({ path, content }) => {
        if (securityMode === "limited-control" && workspaceDir) {
          if (!isPathWithinWorkspace(path, workspaceDir)) {
            throw new Error(`Access denied: ${path} is outside workspace`);
          }
        }
        await writeFile(path, content, "utf-8");
        return `Written ${content.length} bytes to ${path}`;
      },
    }),
  };
}
```

### Pattern 5: Shell Execution with execa

**What:** A shell execution tool using execa with timeout, cwd restriction, and output capture.

**When to use:** AGNT-10 shell command execution.

**Example:**

```typescript
// Source: execa docs (github.com/sindresorhus/execa)
import { execaCommand } from "execa";
import { tool } from "ai";
import { z } from "zod";

function createShellTool(securityMode: string, workspaceDir?: string) {
  return tool({
    description: "Execute a shell command and return its output",
    inputSchema: z.object({
      command: z.string(),
      cwd: z.string().optional(),
      timeout: z.number().optional().default(30000),
    }),
    needsApproval: true, // shell commands always need approval
    execute: async ({ command, cwd, timeout }) => {
      const effectiveCwd = securityMode === "limited-control"
        ? workspaceDir ?? process.cwd()
        : cwd ?? process.cwd();

      const result = await execaCommand(command, {
        cwd: effectiveCwd,
        timeout,
        reject: false, // don't throw on non-zero exit
        env: { ...process.env, NODE_ENV: "production" },
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        failed: result.failed,
      };
    },
  });
}
```

### Pattern 6: Pre-flight Checklist Generation

**What:** Before executing a complex agent task, analyze the prompt + available tools to generate a checklist of planned steps, estimated costs, required permissions, and risks.

**When to use:** AGNT-04/05 - triggered before the agent loop starts for complex tasks.

**Example:**

```typescript
// Custom implementation - no off-the-shelf library exists
import { generateObject } from "ai";
import { z } from "zod";

const PreflightChecklistSchema = z.object({
  steps: z.array(z.object({
    description: z.string(),
    toolName: z.string().optional(),
    risk: z.enum(["low", "medium", "high"]),
    needsApproval: z.boolean(),
  })),
  estimatedCost: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    estimatedUSD: z.number(),
  }),
  requiredPermissions: z.array(z.string()),
  warnings: z.array(z.string()),
});

async function generatePreflight(
  model: any,
  userMessage: string,
  availableTools: Record<string, any>,
) {
  const toolDescriptions = Object.entries(availableTools)
    .map(([name, t]) => `- ${name}: ${t.description}`)
    .join("\n");

  const { object: checklist } = await generateObject({
    model,
    schema: PreflightChecklistSchema,
    prompt: `Analyze this user request and create an execution plan.
Available tools:\n${toolDescriptions}\n\nUser request: ${userMessage}`,
  });

  return checklist;
}
```

### Pattern 7: SKILL.md Discovery and Loading

**What:** Filesystem-based skills with YAML frontmatter metadata, discovered at startup and loaded into context on demand.

**When to use:** SYST-02 skills directory.

**Example:**

```typescript
// Source: SKILL.md ecosystem conventions (Claude Code, Copilot)
import matter from "gray-matter";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const SkillMetadataSchema = z.object({
  name: z.string(),
  description: z.string(),
  tier: z.enum(["workspace", "managed"]).default("workspace"),
  version: z.string().optional(),
  tools: z.array(z.string()).optional(),
  triggers: z.array(z.string()).optional(),
});

interface LoadedSkill {
  metadata: z.infer<typeof SkillMetadataSchema>;
  instructions: string;
  path: string;
}

function discoverSkills(skillsDir: string): LoadedSkill[] {
  const skills: LoadedSkill[] = [];
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = join(skillsDir, entry.name, "SKILL.md");
    try {
      const raw = readFileSync(skillPath, "utf-8");
      const { data, content } = matter(raw);
      const metadata = SkillMetadataSchema.parse(data);
      skills.push({ metadata, instructions: content, path: skillPath });
    } catch {
      // Skip invalid skills silently
    }
  }
  return skills;
}
```

### Anti-Patterns to Avoid

- **Connecting MCP servers at gateway boot:** Servers may not be running. Connect lazily on first tool call and cache the connection. Handle connection failures gracefully.
- **Using `child_process.exec` or `child_process.execSync`:** These invoke a shell interpreter, enabling injection attacks. Use `execa` or at minimum `child_process.execFile` with argument arrays.
- **Blocking the event loop during tool execution:** Tool calls (especially shell commands) can be long-running. Always use async execution with timeouts. Never use `execSync` variants.
- **Sending raw MCP tool schemas to the LLM without filtering:** MCP servers can expose dozens of tools. Filter to relevant tools based on context/skills, or the LLM wastes tokens on irrelevant tool descriptions.
- **Trusting tool output without size limits:** Tool results can be arbitrarily large (e.g., `cat` on a huge file). Truncate tool output to a reasonable limit (e.g., 100KB) before sending back to the LLM.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP transport (stdio, HTTP) | Custom subprocess/HTTP management | `@modelcontextprotocol/sdk` transports | Protocol negotiation, capability exchange, JSON-RPC framing are complex and version-sensitive |
| MCP-to-AI-SDK tool conversion | Manual schema transformation | `@ai-sdk/mcp` `tools()` method | Handles JSON Schema to Zod conversion, tool invocation proxying, error wrapping |
| Tool approval UX flow | Custom approval state machine | AI SDK 6 `needsApproval` + `tool-approval-request`/`tool-approval-response` | AI SDK manages approval lifecycle, pauses execution, resumes on approval |
| Shell command execution | Raw `child_process` calls | `execa` v9 | Handles escaping, timeouts, zombie cleanup, cross-platform, streaming output |
| YAML frontmatter parsing | Regex-based extraction | `gray-matter` | Edge cases: multi-line values, nested objects, excerpt separators, multiple frontmatter formats |
| Agent tool loop | Manual while-loop with tool call detection | AI SDK `streamText` + `stopWhen` (or `ToolLoopAgent`) | Handles multi-step orchestration, token tracking per step, error recovery |

**Key insight:** The AI SDK 6 + MCP SDK combination handles 80% of the agent infrastructure. The custom work is in (1) the WebSocket protocol extensions for relaying tool events to the CLI, (2) the pre-flight checklist generator, and (3) the skills directory system.

## Common Pitfalls

### Pitfall 1: MCP Server Process Zombies
**What goes wrong:** Stdio-based MCP servers are spawned as child processes. If the gateway crashes or the WebSocket disconnects, the child processes are orphaned.
**Why it happens:** No cleanup handler registered for process exit or connection close.
**How to avoid:** Register `process.on("exit")` and `process.on("SIGTERM")` handlers in MCPClientManager that call `closeAll()`. Also clean up on WebSocket `close` event.
**Warning signs:** `ps aux | grep node` shows growing number of MCP server processes.

### Pitfall 2: Tool Approval Deadlock
**What goes wrong:** The agent loop pauses waiting for tool approval, but the client never sends an approval response (e.g., user closes the CLI).
**Why it happens:** No timeout on the approval wait.
**How to avoid:** Implement an approval timeout (e.g., 60 seconds). If no response, auto-deny and inform the agent that the tool call was rejected.
**Warning signs:** Sessions stuck in "streaming" state indefinitely.

### Pitfall 3: textStream vs fullStream Migration
**What goes wrong:** Existing code uses `result.textStream` which only yields text deltas. Tool calls are silently consumed and never relayed to the client.
**Why it happens:** `textStream` is a convenience that filters out non-text events. `fullStream` includes all event types.
**How to avoid:** Replace `textStream` usage in `stream.ts` with `fullStream` and add handlers for `tool-call`, `tool-result`, `tool-input-delta`, and `finish-step` events.
**Warning signs:** Agent makes tool calls but CLI shows no tool activity.

### Pitfall 4: MCP Config Schema Mismatch
**What goes wrong:** User provides MCP server config in a format that doesn't match the expected schema (e.g., using Claude Desktop format with `command` but no `transport` field).
**Why it happens:** The mcpServers config format has become a de facto standard but has no formal JSON Schema. Different clients expect slightly different fields.
**How to avoid:** Accept the Claude Desktop format (`{ command, args, env }` for stdio; `{ url }` for HTTP) as the canonical format. Validate with Zod but be lenient with optional fields.
**Warning signs:** "Invalid MCP config" errors that users don't understand.

### Pitfall 5: Tool Output Token Explosion
**What goes wrong:** A tool returns a massive result (e.g., reading a large file, shell output from `find /`), which blows up the context window on the next LLM call.
**Why it happens:** No output truncation or size limits on tool results.
**How to avoid:** Enforce a maximum tool output size (configurable, default ~50KB). Truncate with a clear message: `[Output truncated at 50KB. Use more specific queries.]`
**Warning signs:** Sudden spike in token usage, `context_length_exceeded` errors from the LLM.

### Pitfall 6: Shell Injection in Limited Control Mode
**What goes wrong:** Even with execa, if using `execaCommand` (which parses a command string), specially crafted inputs could exploit shell metacharacters on some platforms.
**Why it happens:** `execaCommand` splits on spaces but doesn't fully prevent shell interpretation on all platforms.
**How to avoid:** For untrusted input, prefer `execa("command", ["arg1", "arg2"])` over `execaCommand("command arg1 arg2")`. In limited-control mode, consider a command allowlist.
**Warning signs:** Unexpected file modifications outside workspace, unusual process spawns.

## Code Examples

### WebSocket Protocol Extensions

```typescript
// New client messages for Phase 6
const ToolApprovalResponseSchema = z.object({
  type: z.literal("tool.approval.response"),
  id: z.string(),
  toolCallId: z.string(),
  approved: z.boolean(),
  sessionApprove: z.boolean().optional(), // remember for session
});

const PreflightApprovalSchema = z.object({
  type: z.literal("preflight.approval"),
  id: z.string(),
  requestId: z.string(),
  approved: z.boolean(),
  editedSteps: z.array(z.object({
    description: z.string(),
    toolName: z.string().optional(),
    skip: z.boolean().optional(),
  })).optional(),
});

// New server messages for Phase 6
const ToolCallNotifySchema = z.object({
  type: z.literal("tool.call"),
  requestId: z.string(),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.unknown(),
});

const ToolResultNotifySchema = z.object({
  type: z.literal("tool.result"),
  requestId: z.string(),
  toolCallId: z.string(),
  toolName: z.string(),
  result: z.unknown(),
});

const ToolApprovalRequestSchema = z.object({
  type: z.literal("tool.approval.request"),
  requestId: z.string(),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.unknown(),
  risk: z.enum(["low", "medium", "high"]).optional(),
});

const PreflightChecklistSchema = z.object({
  type: z.literal("preflight.checklist"),
  requestId: z.string(),
  steps: z.array(z.object({
    description: z.string(),
    toolName: z.string().optional(),
    risk: z.enum(["low", "medium", "high"]),
    needsApproval: z.boolean(),
  })),
  estimatedCost: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    estimatedUSD: z.number(),
  }),
  requiredPermissions: z.array(z.string()),
  warnings: z.array(z.string()),
});
```

### MCP Config Schema Extension

```typescript
// Extend AppConfigSchema in core/src/config/schema.ts
const MCPServerConfigSchema = z.object({
  command: z.string().optional(),      // stdio transport
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  url: z.string().optional(),          // HTTP/SSE transport
  transport: z.enum(["stdio", "http", "sse"]).optional(),
});

const ToolApprovalConfigSchema = z.object({
  defaultTier: z.enum(["auto", "session", "always"]).default("session"),
  perTool: z.record(z.enum(["auto", "session", "always"])).optional(),
  approvalTimeout: z.number().default(60000), // ms
});

// Add to AppConfigSchema
const AppConfigSchema = z.object({
  // ... existing fields ...
  mcpServers: z.record(MCPServerConfigSchema).optional(),
  toolApproval: ToolApprovalConfigSchema.optional(),
  skillsDir: z.string().optional(), // custom skills directory
});
```

### Tool Registry Merge Pattern

```typescript
// Merge MCP tools + built-in tools into a single tools object
async function buildToolRegistry(
  mcpManager: MCPClientManager,
  mcpConfigs: Record<string, MCPServerConfig>,
  securityMode: string,
  workspaceDir?: string,
  approvalPolicy?: ApprovalPolicy,
): Promise<Record<string, any>> {
  const allTools: Record<string, any> = {};

  // Built-in tools
  const fsTools = createFilesystemTools(securityMode, workspaceDir);
  const shellTool = { execute_command: createShellTool(securityMode, workspaceDir) };
  Object.assign(allTools, fsTools, shellTool);

  // MCP tools (lazy connect)
  for (const [serverName, config] of Object.entries(mcpConfigs)) {
    try {
      const mcpTools = await mcpManager.getTools(serverName, config);
      // Namespace MCP tools to avoid collisions: "serverName.toolName"
      for (const [toolName, toolDef] of Object.entries(mcpTools)) {
        allTools[`${serverName}.${toolName}`] = toolDef;
      }
    } catch (err) {
      // Log but don't fail - other tools still work
      logger.warn(`Failed to connect to MCP server "${serverName}": ${err}`);
    }
  }

  // Apply approval policy wrappers
  if (approvalPolicy) {
    for (const [name, toolDef] of Object.entries(allTools)) {
      allTools[name] = wrapToolWithApproval(name, toolDef, approvalPolicy);
    }
  }

  return allTools;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual tool loop with while/maxSteps | `ToolLoopAgent` class or `streamText` + `stopWhen` | AI SDK 6 (late 2025) | Eliminates boilerplate agent loops; built-in step tracking |
| Custom tool approval state machines | `needsApproval` flag on tool definitions | AI SDK 6 (late 2025) | Native human-in-the-loop with approval request/response message types |
| SSE transport for MCP | Streamable HTTP transport | MCP protocol 2025-03-26 | SSE deprecated; Streamable HTTP is the new standard for remote servers |
| Direct MCP SDK Client class | `@ai-sdk/mcp` createMCPClient wrapper | 2025 | Automatic MCP-to-AI-SDK tool conversion, simpler API |
| vm2 for JavaScript sandboxing | vm2 is abandoned (multiple CVEs) | 2025-2026 | Do NOT use vm2. Use process-level isolation or execa for shell commands |
| `result.textStream` for streaming | `result.fullStream` for complete event stream | AI SDK 6 | Must use fullStream to capture tool-call/tool-result events |

**Deprecated/outdated:**
- `vm2`: Multiple critical sandbox escape CVEs. Maintainer acknowledged new bypasses are inevitable. Do not use.
- MCP SSE transport: Deprecated since protocol version 2025-03-26. Use Streamable HTTP for remote MCP servers.
- `@modelcontextprotocol/sdk` v2: Pre-alpha. Use v1.x for production until Q1 2026 stabilization.

## Open Questions

1. **Pre-flight complexity threshold**
   - What we know: Pre-flight checklists (AGNT-04) should be generated "before complex tasks." AI SDK has no built-in complexity detection.
   - What's unclear: What defines "complex"? Token count? Number of tool calls predicted? Presence of destructive tools?
   - Recommendation: Start with a heuristic: if the initial LLM analysis identifies 3+ tool calls or any high-risk tool, trigger pre-flight. Make the threshold configurable.

2. **MCP tool namespacing strategy**
   - What we know: Multiple MCP servers can expose tools with the same name (e.g., two servers both have "search").
   - What's unclear: Whether to prefix with server name (`github.search`) or use a flat namespace with conflict detection.
   - Recommendation: Use `serverName.toolName` namespacing to avoid collisions. The LLM handles dotted names well.

3. **Skills directory location(s)**
   - What we know: SYST-02 requires "workspace and managed tiers." The config has `workspaceDir`.
   - What's unclear: Whether workspace skills live in `workspaceDir/.agentspace/skills/` or a separate path. Whether managed skills are in `~/.config/agentspace/skills/` or bundled with the app.
   - Recommendation: Two directories: `~/.config/agentspace/skills/` for managed (global) skills, `{workspaceDir}/.agentspace/skills/` for workspace-scoped skills. Workspace skills override managed skills with the same name.

4. **Tool approval persistence across sessions**
   - What we know: AGNT-03 says "per tool or per session" approval. Session-level is straightforward.
   - What's unclear: Whether to persist "always auto-approve tool X" across sessions in the config file.
   - Recommendation: Store persistent approval preferences in the config under `toolApproval.perTool`. Session approvals are in-memory only and reset on new session.

## Sources

### Primary (HIGH confidence)
- [AI SDK Core: Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) - tool() API, needsApproval, multi-step, human-in-the-loop
- [AI SDK Core: MCP Tools](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools) - createMCPClient, transport options, tools() method
- [AI SDK Core: ToolLoopAgent](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent) - Agent class API, stopWhen, generate/stream methods
- [AI SDK Core: createMCPClient](https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client) - Full API reference
- [AI SDK Core: streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) - fullStream, tool-call/tool-result parts
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - v1.x client, transports, tool listing/calling
- [@ai-sdk/mcp npm](https://www.npmjs.com/package/@ai-sdk/mcp) - v1.0.20, peer dependencies

### Secondary (MEDIUM confidence)
- [MCP SDKs](https://modelcontextprotocol.io/docs/sdk) - Official MCP documentation, transport options
- [execa](https://github.com/sindresorhus/execa) - v9.6.0, template tag API, process management
- [Claude Code MCP Configuration](https://code.claude.com/docs/en/mcp) - mcpServers JSON format reference
- [Node.js Security Cheat Sheet (OWASP)](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html) - child_process security
- [CVE-2025-53372](https://github.com/advisories/GHSA-5w57-2ccq-8w95) - MCP server command injection via unsanitized execSync

### Tertiary (LOW confidence)
- SKILL.md format conventions: Derived from multiple ecosystem sources (Claude Code, GitHub Copilot, OpenCode). No single authoritative specification exists yet. The format is emerging but not formally standardized.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - AI SDK 6 + @ai-sdk/mcp + @modelcontextprotocol/sdk is the canonical combination. Verified via official docs.
- Architecture: HIGH - Patterns derived from existing codebase conventions (singleton managers, WS protocol extension, Zod schemas) combined with AI SDK official patterns.
- Pitfalls: HIGH - Shell injection, zombie processes, and approval deadlocks are well-documented in security advisories and community experience.
- Pre-flight checklist: MEDIUM - No standard library exists. Custom implementation required. The approach is sound but untested.
- Skills directory: MEDIUM - SKILL.md format is an emerging convention without formal spec. gray-matter parsing is solid; the tier/discovery pattern needs validation.

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days - AI SDK and MCP SDK are actively evolving but core APIs are stable)
