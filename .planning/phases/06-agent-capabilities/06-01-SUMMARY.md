---
phase: 06-agent-capabilities
plan: 01
subsystem: agent
tags: [mcp, tools, ai-sdk, execa, approval-gate, filesystem, shell]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: config schema, security mode, workspace path validation
provides:
  - MCPClientManager with lazy connect for stdio/http/sse MCP servers
  - Built-in filesystem tools (read_file, write_file, list_files) with security enforcement
  - Shell execution tool (execute_command) with timeout and cwd restriction
  - Unified tool registry merging MCP and built-in tools
  - Three-tier approval gate (auto/session/always)
  - Config schema extensions (mcpServers, toolApproval, skillsDir)
affects: [06-02, 06-03, 06-04, agent-loop, ws-handlers]

# Tech tracking
tech-stack:
  added: ["@ai-sdk/mcp", "@modelcontextprotocol/sdk", "execa"]
  patterns: ["AI SDK tool() with inputSchema", "namespaced MCP tools (server.tool)", "lazy singleton MCP connections"]

key-files:
  created:
    - packages/gateway/src/mcp/client-manager.ts
    - packages/gateway/src/mcp/config.ts
    - packages/gateway/src/mcp/index.ts
    - packages/gateway/src/tools/filesystem.ts
    - packages/gateway/src/tools/shell.ts
    - packages/gateway/src/tools/index.ts
    - packages/gateway/src/agent/approval-gate.ts
    - packages/gateway/src/agent/tool-registry.ts
    - packages/gateway/src/agent/index.ts
  modified:
    - packages/core/src/config/schema.ts
    - packages/core/src/config/index.ts
    - packages/core/src/index.ts
    - packages/gateway/src/index.ts
    - packages/gateway/package.json

key-decisions:
  - "AI SDK v6 uses inputSchema (not parameters) for tool() definitions"
  - "Zod 4 z.record requires explicit key schema: z.record(z.string(), valueSchema)"
  - "MCP tools namespaced as serverName.toolName to avoid collisions with built-in tools"
  - "Approval gate stores session approvals in a Set for O(1) lookup"

patterns-established:
  - "Tool creation: use tool() from ai with inputSchema, description, and execute"
  - "Security boundary: checkWorkspace helper enforces limited-control mode workspace restriction"
  - "MCP lazy connect: MCPClientManager.getTools() connects on first use, caches client"

# Metrics
duration: 7min
completed: 2026-02-16
---

# Phase 6 Plan 1: Tool Infrastructure Summary

**MCP client management, filesystem/shell tools with security enforcement, unified tool registry with namespaced MCP tools, and three-tier approval gate**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-17T00:26:58Z
- **Completed:** 2026-02-17T00:34:42Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Extended AppConfigSchema with mcpServers, toolApproval, and skillsDir fields
- Created MCPClientManager with lazy connect supporting stdio, HTTP, and SSE transports
- Built filesystem tools (read_file, write_file, list_files) respecting security mode boundaries
- Built shell execution tool with timeout, cwd restriction, and output truncation
- Created tool registry that merges built-in and MCP tools with namespace isolation
- Implemented approval gate with auto/session/always tiers and session memory

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend config schema and create MCP client manager** - `ba1d0dd` (feat)
2. **Task 2: Create built-in tools, tool registry, and approval gate** - `4cfcde9` (feat)

## Files Created/Modified
- `packages/core/src/config/schema.ts` - Added MCPServerConfig, ToolApprovalConfig, skillsDir schemas
- `packages/core/src/config/index.ts` - Re-exported new config types
- `packages/core/src/index.ts` - Re-exported new config types from package root
- `packages/gateway/package.json` - Added @ai-sdk/mcp, @modelcontextprotocol/sdk, execa deps
- `packages/gateway/src/mcp/client-manager.ts` - MCPClientManager singleton with lazy connect
- `packages/gateway/src/mcp/config.ts` - loadMCPConfigs helper
- `packages/gateway/src/mcp/index.ts` - Barrel export
- `packages/gateway/src/tools/filesystem.ts` - read_file, write_file, list_files AI SDK tools
- `packages/gateway/src/tools/shell.ts` - execute_command AI SDK tool with execa
- `packages/gateway/src/tools/index.ts` - Barrel export
- `packages/gateway/src/agent/approval-gate.ts` - ApprovalPolicy, wrapToolWithApproval, checkApproval
- `packages/gateway/src/agent/tool-registry.ts` - buildToolRegistry merging MCP + built-in tools
- `packages/gateway/src/agent/index.ts` - Barrel export
- `packages/gateway/src/index.ts` - Re-exported mcp, tools, agent modules

## Decisions Made
- AI SDK v6 uses `inputSchema` property instead of `parameters` for tool definitions (discovered during build)
- Zod 4 `z.record()` requires explicit key schema as first argument: `z.record(z.string(), valueSchema)`
- MCP tools namespaced as `serverName.toolName` to avoid collisions with built-in tools
- Approval gate uses a `Set<string>` for session approvals, providing O(1) lookup
- MCPClientManager registers cleanup on both `process.exit` and `SIGTERM` for graceful shutdown

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod 4 z.record() requiring two arguments**
- **Found during:** Task 1 (config schema extension)
- **Issue:** Zod 4 `z.record()` requires explicit key and value schemas; single-argument form caused TS2554 errors
- **Fix:** Changed `z.record(z.string())` to `z.record(z.string(), z.string())` and similar for other record types
- **Files modified:** packages/core/src/config/schema.ts
- **Verification:** `pnpm --filter @agentspace/core build` passes
- **Committed in:** ba1d0dd (Task 1 commit)

**2. [Rule 1 - Bug] Fixed AI SDK v6 tool() API using inputSchema instead of parameters**
- **Found during:** Task 2 (built-in tools)
- **Issue:** AI SDK v6 `tool()` type definition uses `inputSchema` property; `parameters` caused TS2769 overload errors
- **Fix:** Replaced all `parameters:` with `inputSchema:` in filesystem.ts and shell.ts
- **Files modified:** packages/gateway/src/tools/filesystem.ts, packages/gateway/src/tools/shell.ts
- **Verification:** `pnpm --filter @agentspace/gateway build` passes
- **Committed in:** 4cfcde9 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes were necessary for TypeScript compilation. No scope creep.

## Issues Encountered
- Pre-existing cyclic dependency between @agentspace/gateway and @agentspace/cli prevents `pnpm build` (turbo) from running. Individual package builds succeed. Out of scope for this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tool infrastructure complete, ready for agent loop (06-02), streaming integration (06-03), and skills system (06-04)
- All tool types (filesystem, shell, MCP) accessible through unified buildToolRegistry()
- Approval policy can be created from config and applied during registry build

---
*Phase: 06-agent-capabilities*
*Completed: 2026-02-16*
