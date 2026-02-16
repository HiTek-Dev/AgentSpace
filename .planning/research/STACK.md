# Stack Research

**Domain:** Self-hosted AI Agent Gateway Platform
**Researched:** 2026-02-15
**Confidence:** HIGH (core stack) / MEDIUM (some library versions need validation at install time)

## Recommended Stack

### Runtime and Language

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 24.x LTS | Runtime | Current Active LTS (Krypton), supported through April 2028. Playwright, node-pty, better-sqlite3 all tested against it. |
| TypeScript | 5.9 (stable) | Type safety | Latest stable release. TS 6.0 beta exists but is not production-ready yet. Stay on 5.9 until 6.0 GA. |
| pnpm | 9.x | Package manager | Content-addressable storage saves disk, strict node_modules prevents phantom dependencies, native workspace support. Standard for monorepos in 2025/2026. |

### Monorepo Tooling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Turborepo | 2.8.x | Build orchestration | 3x faster than Nx on small projects (our case: ~6-8 packages). Simpler config, JS/TS focused. Vercel-maintained. Start here, evaluate Nx only if hitting 15+ packages. |
| pnpm workspaces | (built-in) | Package linking | Native workspace:* protocol for local dependencies. No extra tool needed. TypeScript project references for incremental builds. |

### Workspace Package Layout

```
packages/
  @agentspace/core        # Shared types, config, crypto utilities
  @agentspace/gateway      # WebSocket server, session management, LLM routing
  @agentspace/cli          # Terminal UI (Ink-based)
  @agentspace/web          # Next.js dashboard
  @agentspace/telegram     # grammY bot
  @agentspace/db           # Drizzle schema, migrations, vector search
  @agentspace/plugins      # Plugin system, skill registry
```

### Core Framework (Gateway Server)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Fastify | 5.x | HTTP server for gateway | Best raw performance on Node.js (40K+ req/s). Schema-based validation built-in. Mature plugin ecosystem. Better than Hono here because we are Node.js only (not edge/multi-runtime) and need WebSocket integration via @fastify/websocket. |
| ws | 8.x | WebSocket server | 35M weekly npm downloads, battle-tested, zero-bloat. Used under @fastify/websocket. No need for Socket.IO overhead since we control both client and server. |
| @fastify/websocket | 11.x | WS integration | Clean integration of ws into Fastify request lifecycle, with route-level WebSocket handlers. |

### LLM Provider Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| ai (Vercel AI SDK) | 6.x | Multi-provider LLM abstraction | 2M+ weekly downloads. Unified API for streaming, tool calling, structured output. Agent abstraction in v6. Type-safe throughout. The standard for TS LLM apps. |
| @ai-sdk/anthropic | latest | Anthropic provider | Official provider package for Claude models. |
| @ai-sdk/openai | latest | OpenAI provider | Official provider package for GPT models. |
| @ai-sdk/openai-compatible | latest | Ollama provider | Ollama exposes OpenAI-compatible API. Use createOpenAICompatible() pointed at localhost:11434. Avoids depending on community Ollama packages with version churn. |
| zod | 4.x | Schema validation | 14x faster string parsing vs v3, ~1.9KB mini variant. Used by AI SDK for tool definitions. Standard for runtime validation in TS ecosystem. |

**Confidence: HIGH** -- AI SDK is the dominant TS LLM toolkit. Provider packages are well-maintained. Ollama via openai-compatible is documented officially.

### Database and Storage

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| better-sqlite3 | 11.x | SQLite driver | Synchronous API (simpler mental model for CLI/gateway), fastest Node.js SQLite driver, well-maintained. Required by sqlite-vec. |
| drizzle-orm | 0.45.x | SQL ORM | TypeScript-first, zero dependencies, SQL-centric (not hiding SQL). Sync API support for better-sqlite3. Built-in Zod integration for validators. Generates migrations via drizzle-kit. |
| drizzle-kit | latest | Migrations | Schema push and migration generation. Works with better-sqlite3. |
| sqlite-vec | latest | Vector search | Pure C, no dependencies, successor to sqlite-vss. SIMD-accelerated. Runs anywhere SQLite runs. Loads as extension into better-sqlite3. Good for tens of thousands of embeddings (plenty for self-hosted agent memory). |

**Confidence: HIGH** -- Drizzle + better-sqlite3 is the standard pattern. sqlite-vec is the only maintained option for SQLite vector search.

### CLI Interface

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Ink | 6.x | React-based terminal UI | Component model for rich terminal rendering. Flexbox layout via Yoga. Claude Code-style UI needs dynamic updating, spinners, inline tool output -- Ink handles this natively. |
| Ink UI | latest | Pre-built CLI components | Themed UI components (spinners, selects, text input). Saves building from scratch. |
| @inkjs/ui | latest | Additional UI primitives | Progress bars, status messages, alerts. |
| chalk | 5.x | Terminal colors | ESM-native, zero-dependency string coloring. Used within Ink components. |
| commander | 12.x | CLI argument parsing | Mature, well-typed, supports subcommands. Handles `agentspace chat`, `agentspace config` etc. |

**Confidence: HIGH** -- Ink is the only serious React-for-terminal solution. 3,247 dependents on npm. Actively maintained (6.7.0 published days ago).

### Web Dashboard

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.x | Dashboard framework | App Router, Turbopack default, React Server Components. Standard for React dashboards. |
| React | 19.x | UI library | Bundled with Next.js 16. Server Components for data-heavy dashboard pages. |
| shadcn/ui | latest | Component library | Copy-paste components (not a dependency). Tailwind-based. Many admin dashboard templates exist. Full ownership of code. |
| Tailwind CSS | 4.x | Styling | Utility-first, works with shadcn/ui. v4 ships with Next.js 16 starter. |
| @xterm/xterm | 5.x | Web terminal | For terminal view in dashboard. Powers VS Code's terminal. Use @xterm/* scoped packages (old xterm packages deprecated). |
| Recharts or Tremor | latest | Charts/monitoring | Dashboard visualization for token usage, request metrics, session timelines. |

**Confidence: MEDIUM** -- Next.js 16 + shadcn is the standard pattern, but dashboard comes in a later phase. Exact component needs may shift.

### Telegram Bot

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| grammY | latest | Telegram bot framework | TypeScript-first, runs on Node.js/Deno/browser. Best DX of Telegram bot libraries. Plugin ecosystem (sessions, menus, conversations). Better maintained and more modern than Telegraf. |

**Confidence: HIGH** -- grammY is the clear winner for TypeScript Telegram bots.

### Encrypted Credential Storage

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @napi-rs/keyring | 1.x | OS keychain access | Rust-based (via napi-rs), 100% keytar-compatible API. No libsecret dependency (works in WSL2, headless). Backed by Microsoft OSS fund. Replaces deprecated keytar. |
| Node.js crypto | (built-in) | Encryption fallback | AES-256-GCM for encrypting secrets at rest when keychain unavailable. No external dependency needed. |

**Architecture:** Try OS keychain first (@napi-rs/keyring). Fall back to AES-256-GCM encrypted file with key derived from machine-specific entropy. Never store API keys in plain text config files.

**Confidence: MEDIUM** -- @napi-rs/keyring is the best keytar replacement available, but has a smaller community. Validate prebuilt binaries work on target platforms.

### Browser Automation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Playwright | 1.58.x | Browser automation | Microsoft-maintained. Chromium, Firefox, WebKit. Headless and headed modes. Auto-wait, network interception, screenshots, PDF. The standard for Node.js browser automation. |

**Confidence: HIGH** -- Playwright is unchallenged in this space.

### Terminal Proxy

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| node-pty | 1.x | Pseudoterminal forking | Microsoft-maintained. Powers VS Code terminal, Tabby, Hyper. Supports Linux, macOS, Windows (conpty). Required for interactive CLI app proxying. |
| @xterm/xterm | 5.x | Terminal rendering (web) | Paired with node-pty for web-based terminal. Stream pty output over WebSocket to xterm.js in dashboard. |

**Confidence: HIGH** -- node-pty is the only maintained Node.js PTY library. Native addon requires build tools (Python, C++ compiler) at install time.

### Plugin System

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| zod | 4.x | Plugin manifest validation | Validate plugin.json manifests. Same library already used for AI SDK tools. |
| Node.js dynamic import | (built-in) | Plugin loading | `import()` for loading plugin modules at runtime. No extra framework needed. |

**Architecture:** Plugins as npm packages or local directories with a standard manifest. Each plugin exports tools (for AI SDK), UI components (optional), and lifecycle hooks. Keep it simple -- no heavyweight plugin framework.

**Confidence: MEDIUM** -- Plugin architecture is custom. Pattern is well-established but implementation details need phase-specific design.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Unit/integration testing | Fast, ESM-native, compatible with Turborepo caching. Use instead of Jest. |
| Biome | Linting + formatting | Single tool replaces ESLint + Prettier. Turborepo 2.7 added Biome rule support. Faster than ESLint. |
| tsx | TypeScript execution | For running TS files directly during development. Faster than ts-node. |
| changesets | Version management | Standard for pnpm monorepo versioning and changelogs. |

## Installation

```bash
# Initialize monorepo
pnpm init
pnpm add -Dw turbo typescript @types/node vitest @biomejs/biome tsx

# Gateway package
pnpm --filter @agentspace/gateway add fastify @fastify/websocket ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/openai-compatible zod

# Database package
pnpm --filter @agentspace/db add better-sqlite3 drizzle-orm sqlite-vec
pnpm --filter @agentspace/db add -D drizzle-kit @types/better-sqlite3

# CLI package
pnpm --filter @agentspace/cli add ink ink-ui @inkjs/ui chalk commander @napi-rs/keyring

# Web dashboard package (later phase)
pnpm --filter @agentspace/web add next react react-dom @xterm/xterm
pnpm --filter @agentspace/web add -D tailwindcss @types/react

# Telegram package (later phase)
pnpm --filter @agentspace/telegram add grammy

# Browser automation (later phase)
pnpm --filter @agentspace/plugins add playwright

# Terminal proxy
pnpm --filter @agentspace/gateway add node-pty
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Fastify | Hono | If you need edge/multi-runtime deployment. AgentSpace is self-hosted Node.js, so Fastify's raw performance wins. |
| Fastify | Express | Never for new projects. Express 5 exists but Fastify is faster with better TypeScript support. |
| ws (via @fastify/websocket) | Socket.IO | If you need browser fallback transports (long-polling). We control both ends, so pure WebSocket is cleaner and lighter. |
| AI SDK 6 | LangChain.js | If you need LangGraph-style stateful agent graphs. AI SDK is simpler, more TypeScript-native, and has better streaming. LangChain adds complexity we don't need. |
| AI SDK 6 | Direct provider SDKs | If you only need one LLM provider. We need three (Anthropic, OpenAI, Ollama), so a unified abstraction pays for itself immediately. |
| Drizzle ORM | Prisma | If you need a visual schema editor or more abstraction. Drizzle is closer to SQL, lighter, and has sync API for SQLite. Prisma's engine binary is unnecessary overhead for embedded SQLite. |
| Drizzle ORM | Raw better-sqlite3 | If queries are trivially simple. We have migrations, multiple tables, vector search -- ORM pays for itself in type safety and migration management. |
| Turborepo | Nx | If monorepo grows past 15+ packages or you need code generators. Start simple, migrate later if needed. |
| Ink | blessed/blessed-contrib | Never. Blessed is unmaintained since 2018. Ink is actively developed with React mental model. |
| Biome | ESLint + Prettier | If you need ESLint plugins not yet available in Biome (some niche cases). For standard TS/React linting, Biome covers everything faster. |
| @napi-rs/keyring | keytar | Never. keytar is archived (Dec 2022). @napi-rs/keyring is the maintained successor with no libsecret dependency. |
| sqlite-vec | Dedicated vector DB (Pinecone, Qdrant) | If you need millions of embeddings or distributed vector search. Self-hosted agent with tens of thousands of embeddings runs perfectly on sqlite-vec. No infrastructure needed. |
| grammY | Telegraf | Never for new projects. grammY is the modern TypeScript-first successor with better plugin support and maintenance. |
| Vitest | Jest | If you have existing Jest config to maintain. For greenfield, Vitest is faster and ESM-native. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Express | Slower than Fastify, worse TypeScript support, no built-in schema validation | Fastify 5.x |
| Prisma | Heavy engine binary, async-only, overkill for embedded SQLite | Drizzle ORM |
| keytar | Archived December 2022, no longer maintained | @napi-rs/keyring |
| sqlite-vss | Deprecated predecessor with FAISS dependency | sqlite-vec (pure C, no dependencies) |
| blessed | Unmaintained since 2018 | Ink 6.x |
| Telegraf | Less maintained, worse TypeScript types | grammY |
| npm/yarn | npm lacks workspace strictness; yarn has overhead for this use case | pnpm |
| Jest | Slower, CJS-first, config-heavy | Vitest |
| ESLint + Prettier | Two tools where one suffices | Biome |
| Webpack | Slow, complex config | Turborepo + built-in bundlers (Next.js Turbopack, tsup for packages) |
| Socket.IO | Unnecessary protocol overhead when you control both ends | ws via @fastify/websocket |
| LangChain.js | Heavyweight abstraction, Python-first mentality ported to JS | AI SDK 6 |
| dotenv for secrets | Plain text .env files are insecure for API keys | @napi-rs/keyring + AES-256-GCM fallback |

## Stack Patterns by Variant

**If adding MCP (Model Context Protocol) server support later:**
- AI SDK 6 has built-in MCP compatibility
- Next.js 16 includes MCP Devtools support
- Design tool system to be MCP-compatible from the start

**If macOS native companion app is needed:**
- Use Swift + SwiftUI for the native app
- Communicate with gateway over local WebSocket (already built)
- Share no Node.js code with native app -- clean boundary at the WebSocket API
- Consider Tauri as alternative if cross-platform desktop is desired instead of macOS-only

**If scaling beyond single machine:**
- SQLite becomes a bottleneck -- migrate Drizzle schema to PostgreSQL (Drizzle supports both)
- Gateway becomes stateless, sessions move to Redis
- This is unlikely for self-hosted agent platform but architecture should not preclude it

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| ai@6.x | @ai-sdk/anthropic@latest, @ai-sdk/openai@3.x | AI SDK 6 requires matching provider versions. Use latest of each. |
| ai@6.x | zod@4.x | AI SDK 6 supports Zod 4 and Standard JSON Schema interface |
| drizzle-orm@0.45.x | better-sqlite3@11.x | Drizzle has sync API specifically for better-sqlite3 |
| better-sqlite3@11.x | sqlite-vec | sqlite-vec loads as extension via better-sqlite3's loadExtension() |
| Ink@6.x | React@18.x | Ink uses its own React renderer, not React DOM. Ships with compatible React. |
| Next.js@16.x | React@19.x | Next.js 16 requires React 19. Dashboard is separate from CLI (different React versions OK in monorepo). |
| node-pty@1.x | Node.js@24.x | Requires Python 3 + C++ compiler at install time for native build |
| @napi-rs/keyring@1.x | Node.js@24.x | Prebuilt binaries for major platforms. Falls back to build if unavailable. |
| Turborepo@2.8.x | pnpm@9.x | Full workspace integration, including workspace:* protocol |

## Sources

- [AI SDK Documentation](https://ai-sdk.dev/docs/introduction) -- AI SDK architecture, provider model, v6 features (HIGH confidence)
- [AI SDK 6 Blog Post](https://vercel.com/blog/ai-sdk-6) -- Agent abstraction, unified structured output (HIGH confidence)
- [AI SDK Ollama Community Provider](https://ai-sdk.dev/providers/community-providers/ollama) -- Ollama integration options (HIGH confidence)
- [AI SDK OpenAI-Compatible Providers](https://ai-sdk.dev/providers/openai-compatible-providers) -- createOpenAICompatible for Ollama (HIGH confidence)
- [Drizzle ORM SQLite Docs](https://orm.drizzle.team/docs/get-started-sqlite) -- better-sqlite3 integration, sync API (HIGH confidence)
- [sqlite-vec GitHub](https://github.com/asg017/sqlite-vec) -- Pure C vector search, SIMD acceleration (HIGH confidence)
- [Ink GitHub](https://github.com/vadimdemedes/ink) -- React terminal renderer, v6.7.0 (HIGH confidence)
- [grammY Official Site](https://grammy.dev/) -- TypeScript Telegram bot framework (HIGH confidence)
- [node-pty GitHub](https://github.com/microsoft/node-pty) -- PTY forking, platform support (HIGH confidence)
- [Playwright Release Notes](https://playwright.dev/docs/release-notes) -- v1.58.x features (HIGH confidence)
- [@napi-rs/keyring GitHub](https://github.com/Brooooooklyn/keyring-node) -- keytar replacement, Rust bindings (MEDIUM confidence)
- [Fastify vs Hono Comparison](https://betterstack.com/community/guides/scaling-nodejs/hono-vs-fastify/) -- Performance benchmarks, use cases (MEDIUM confidence)
- [Turborepo 2.7 Blog](https://turborepo.dev/blog/turbo-2-7) -- Devtools, composable config (HIGH confidence)
- [Zod v4 Release](https://www.infoq.com/news/2025/08/zod-v4-available/) -- Performance improvements, mini package (HIGH confidence)
- [Next.js 16 Blog](https://nextjs.org/blog/next-16) -- Turbopack default, PPR, Proxy (HIGH confidence)
- [xterm.js GitHub](https://github.com/xtermjs/xterm.js) -- Scoped @xterm/* packages (HIGH confidence)
- [pnpm Workspaces Docs](https://pnpm.io/workspaces) -- Workspace protocol, configuration (HIGH confidence)
- [Node.js 24 LTS](https://nodejs.org/en/blog/release/v24.13.1) -- Current Active LTS (HIGH confidence)
- [TypeScript 5.9 Docs](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html) -- Latest stable TS (HIGH confidence)
- [Nx vs Turborepo Comparison](https://www.wisp.blog/blog/nx-vs-turborepo-a-comprehensive-guide-to-monorepo-tools) -- When to choose each (MEDIUM confidence)

---
*Stack research for: Self-hosted AI Agent Gateway Platform (AgentSpace)*
*Researched: 2026-02-15*
