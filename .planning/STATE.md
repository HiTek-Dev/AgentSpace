# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Every interaction with your AI agent is transparent, secure, and under your control -- you see exactly what's being sent, what tools are running, and can approve or skip permissions at any granularity.
**Current focus:** Phase 4: Multi-Provider Intelligence -- COMPLETE

## Current Position

Phase: 4 of 10 (Multi-Provider Intelligence) -- COMPLETE
Plan: 2 of 2 in current phase -- COMPLETE
Status: Completed 04-02 (complexity-based routing with auto/manual modes)
Last activity: 2026-02-16 -- Completed 04-02 (complexity classifier, routing engine, WS proposal/confirm protocol)

Progress: [████████████░] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 3min
- Total execution time: 0.49 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3/3 | 8min | 3min |
| 02 | 3/3 | 8min | 3min |
| 03 | 2/2 | 7min | 4min |
| 04 | 2/2 | 7min | 4min |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 10 phases derived from 65 requirements across 9 categories; comprehensive depth
- [Roadmap]: Phases 3/4/5 can parallelize after Phase 2; Phases 7/8/9/10 can parallelize after Phase 6
- [Research]: TypeScript/Node.js monorepo with Fastify, AI SDK 6, Drizzle+SQLite, Ink CLI, grammY for Telegram
- [01-01]: Used Zod 4.x with factory function defaults for nested object schemas
- [01-01]: Auto-create audit_log table in getDb() for zero-friction first run
- [01-01]: Singleton database connection pattern for SQLite
- [01-02]: Hidden input for CLI key prompts uses raw stdin, not Ink TextInput
- [01-02]: Key prefix validation is advisory-only (warnings, not enforcement)
- [01-02]: Vault functions are synchronous, matching better-sqlite3 sync API
- [01-03]: Scoped bearer-auth to /keys/* routes only, leaving /health unauthenticated
- [01-03]: Runtime.json written on server start with PID/port/timestamp, cleaned on exit
- [01-03]: Onboarding wizard uses multi-step Ink component with state machine flow
- [02-01]: Refactored createKeyServer into createServer/start for pre-listen plugin registration
- [02-01]: WeakMap for per-connection state with automatic garbage collection
- [02-01]: DEFAULT_MODEL set to claude-sonnet-4-5-20250514 (updated to 20250929 in 02-03)
- [02-01]: Localhost-only WebSocket access via preValidation hook
- [02-02]: Model pricing includes fuzzy matching for versioned model IDs
- [02-02]: Handlers dispatched from WS message handler with .catch() error boundary
- [02-02]: UsageTracker singleton pattern consistent with SessionManager
- [02-03]: Updated DEFAULT_MODEL to claude-sonnet-4-5-20250929 (previous ID returned 404)
- [03-01]: Downgraded marked to ^15.0.0 to satisfy marked-terminal peer dep
- [03-01]: WebSocket callbacks stored in refs to prevent stale closures in useEffect
- [03-01]: setStreamingText callback form for atomic promotion of streaming text to messages
- [03-02]: ChatMessage refactored to discriminated union on type field for forward-compatible tool_call/bash_command/reasoning
- [03-02]: Plain text during streaming, markdown only on completion (avoids partial-parse artifacts)
- [03-02]: Used markedTerminal() extension API with marked.use() for marked v15 compatibility
- [03-02]: Custom type declarations for marked-terminal (no @types package available)
- [04-01]: Singleton provider registry pattern with lazy init, consistent with SessionManager/UsageTracker
- [04-01]: resolveModelId() prefixes bare model names with "anthropic:" for backward compatibility
- [04-01]: Ollama always registered even without a key (local, keyless)
- [04-01]: Provider-qualified model IDs as standard format ("provider:model")
- [04-01]: Pricing keeps both bare and provider-prefixed Anthropic entries for backward compat
- [04-01]: Cast model to `never` for registry.languageModel() due to dynamic registry type parameter
- [04-02]: Default routing mode is auto (routes silently, shows tier in stream.start)
- [04-02]: Explicit msg.model bypasses routing entirely (user choice takes precedence)
- [04-02]: streamToClient helper extracted to avoid code duplication between normal and route-confirm flows
- [04-02]: Confidence scoring: 1.0 keyword, 0.7 length/history, 0.5 default fallback
- [04-02]: Protocol extension pattern: add schema, add to discriminated union, wire handler in server.ts

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 04-02-PLAN.md (complexity routing, auto/manual modes, WS protocol extension)
Resume file: None
