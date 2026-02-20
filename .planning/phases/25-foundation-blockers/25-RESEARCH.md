# Phase 25: Foundation & Blockers - Research

**Researched:** 2026-02-20
**Domain:** Monorepo architecture, React error handling, WebSocket resilience, test infrastructure
**Confidence:** HIGH

## Summary

Phase 25 resolves four foundational issues that block parallel work on CLI (Phase 26), desktop (Phase 27), and testing (Phase 28). The work decomposes cleanly into four independent streams:

1. **Vault extraction** -- Move `packages/cli/src/vault/` to `@tek/core` (or a new `@tek/vault` sub-export) to break the circular dependency where `@tek/gateway` depends on `@tek/cli` for vault functions while `@tek/cli` depends on `@tek/gateway` for protocol types. Currently `@tek/gateway/package.json` lists `"@tek/cli": "workspace:*"` as a dependency solely for the vault sub-path import. The vault module itself is small (3 files, ~120 lines total) with two dependencies: `@napi-rs/keyring` (native) and `@tek/db` (for audit events).

2. **React error boundaries** -- The desktop app (`apps/desktop`) has zero error boundaries. If any page component throws during render, the entire Tauri app white-screens. The `react-error-boundary` package (v6.1.1) provides the standard `ErrorBoundary` component with `FallbackComponent`, `onReset`, and `onError` props.

3. **WebSocket auto-reconnect with exponential backoff** -- The CLI's `useWebSocket` hook (`packages/cli/src/hooks/useWebSocket.ts`) has no reconnect logic at all. The desktop's `useWebSocket` hook (`apps/desktop/src/hooks/useWebSocket.ts`) has reconnect but uses fixed 3s delay with a hard cap of 5 retries. The requirement specifies exponential backoff: 1s -> 2s -> 4s -> 8s -> max 30s with unlimited retries. Both clients also need to resume the previous session (re-send `sessionId`) after reconnection.

4. **Vitest workspace config** -- The repo has zero test files and no vitest config anywhere. Vitest 4.0.18 is already installed as a root devDependency. The modern approach (Vitest 3.2+) uses `projects` in the root `vitest.config.ts` (the old `vitest.workspace.ts` is deprecated). Turborepo recommends per-package `test` scripts with `turbo run test` for caching.

**Primary recommendation:** Tackle vault extraction first (it unblocks gateway test isolation), then error boundaries / reconnect / vitest config in parallel since they are fully independent.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-01 | Vault code extracted from @tek/cli to @tek/core, circular dependency eliminated, Turbo builds in one pass | Vault is 3 files (~120 LOC). Move to `@tek/core` with a `./vault` sub-export. Add `@napi-rs/keyring` and `@tek/db` as `@tek/core` dependencies. Update 5 import sites in `@tek/gateway` and 7 import sites in `@tek/cli`. Remove `@tek/cli` from `@tek/gateway` dependencies. |
| FOUND-02 | Desktop app has per-page React error boundaries with recovery UI | Install `react-error-boundary` v6. Wrap each page component in App.tsx with `<ErrorBoundary>`. Create a `PageErrorFallback` component with "retry" button that calls `resetErrorBoundary()`. |
| FOUND-03 | CLI and desktop WebSocket clients auto-reconnect with exponential backoff (1s->2s->4s->8s->max 30s) | Rewrite both `useWebSocket` hooks to use exponential backoff with jitter. Desktop hook already has reconnect infrastructure (needs backoff formula change + unlimited retries). CLI hook has zero reconnect logic (needs full implementation). Both need to re-send `sessionId` on reconnect to resume the session. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-error-boundary | 6.1.1 | Declarative React error boundaries with recovery | De facto standard (1,846 dependents on npm), maintained by React team member (bvaughn) |
| vitest | 4.0.18 | Test runner | Already installed as root devDependency; modern Vite-native test runner |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @napi-rs/keyring | ^1.2.0 | OS keychain access | Already a dependency in @tek/cli -- needs to move to @tek/core |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-error-boundary | Hand-rolled class component | Would need to maintain lifecycle methods, miss `onReset`/`resetKeys` features |
| Custom reconnect logic | websocket-ts library | Adds external dependency for a simple pattern; hand-rolled is fine for this use case |

**Installation:**
```bash
pnpm add -D react-error-boundary --filter @tek/desktop
```

## Architecture Patterns

### Pattern 1: Vault Extraction to @tek/core

**What:** Move the 3 vault files from `packages/cli/src/vault/` to `packages/core/src/vault/`, add a `./vault` sub-export to `@tek/core`, and update all import paths.

**Current dependency graph (BROKEN):**
```
@tek/cli ──depends──> @tek/gateway (for protocol types)
@tek/gateway ──depends──> @tek/cli (for vault)  ← CIRCULAR
```

**Target dependency graph (FIXED):**
```
@tek/cli ──depends──> @tek/core (for vault + config)
@tek/cli ──depends──> @tek/gateway (for protocol types)
@tek/gateway ──depends──> @tek/core (for vault + config)
```

**Files to move:**
- `packages/cli/src/vault/index.ts` -> `packages/core/src/vault/index.ts`
- `packages/cli/src/vault/keychain.ts` -> `packages/core/src/vault/keychain.ts`
- `packages/cli/src/vault/providers.ts` -> `packages/core/src/vault/providers.ts`

**@tek/core package.json changes:**
```json
{
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./vault": { "import": "./dist/vault/index.js", "types": "./dist/vault/index.d.ts" }
  },
  "dependencies": {
    "@napi-rs/keyring": "^1.2.0",
    "@tek/db": "workspace:*",
    "gray-matter": "^4.0.3",
    "zod": "^4.3.6"
  }
}
```

**@tek/gateway package.json change:** Remove `"@tek/cli": "workspace:*"` from dependencies.

**@tek/cli package.json change:** Remove `"./vault"` from exports (no longer exported from CLI).

**Import updates (gateway -- 5 files):**
```
@tek/cli/vault  ->  @tek/core/vault
```
- `packages/gateway/src/ws/handlers.ts` (line 54)
- `packages/gateway/src/llm/provider.ts` (line 2)
- `packages/gateway/src/llm/registry.ts` (line 6)
- `packages/gateway/src/key-server/auth.ts` (line 1)
- `packages/gateway/src/key-server/routes.ts` (line 2)

**Import updates (CLI -- 7 files):**
```
../vault/index.js  ->  @tek/core/vault
../vault/keychain.js  ->  @tek/core/vault (for keychainSet specifically used in config.ts)
```
- `packages/cli/src/commands/onboard.ts`
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/config.ts` (two imports: vault/index and vault/keychain)
- `packages/cli/src/commands/keys.ts`
- `packages/cli/src/components/Onboarding.tsx`

**Note on keychain.ts:** The `keychainSet` function is directly imported by `packages/cli/src/commands/config.ts`. Options: (a) re-export `keychainSet` from `@tek/core/vault`, or (b) keep keychain internals unexposed and add a dedicated function to the vault API. Option (a) is simpler.

### Pattern 2: Per-Page Error Boundaries

**What:** Wrap each page component in `App.tsx` with an `<ErrorBoundary>` that renders a recovery UI on uncaught render errors.

**Current App.tsx structure:**
```tsx
// No error boundaries -- throws white-screen the entire app
<Layout currentPage={currentPage} onNavigate={setCurrentPage}>
  <ActivePage />
</Layout>
```

**Target pattern:**
```tsx
import { ErrorBoundary } from 'react-error-boundary';

function PageErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <h2 className="text-xl font-semibold text-red-400">Something went wrong</h2>
      <pre className="text-sm text-gray-400 max-w-lg overflow-auto">{error.message}</pre>
      <button onClick={resetErrorBoundary}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        Try Again
      </button>
    </div>
  );
}

export function App() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const ActivePage = pages[currentPage];

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      <ErrorBoundary
        FallbackComponent={PageErrorFallback}
        resetKeys={[currentPage]}
        onError={(error) => console.error('Page error:', error)}
      >
        <ActivePage />
      </ErrorBoundary>
    </Layout>
  );
}
```

**Key detail:** `resetKeys={[currentPage]}` automatically resets the error boundary when the user navigates to a different page, without requiring them to click "Try Again."

### Pattern 3: Exponential Backoff with Jitter

**What:** Replace fixed-delay reconnect with exponential backoff: `delay = min(baseDelay * 2^attempt, maxDelay) + jitter`.

**Backoff formula (matching requirement: 1s->2s->4s->8s->max 30s):**
```typescript
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const JITTER_MS = 500; // random 0-500ms to prevent thundering herd

function getReconnectDelay(attempt: number): number {
  const exponential = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  const jitter = Math.random() * JITTER_MS;
  return exponential + jitter;
}
// attempt 0: ~1000-1500ms
// attempt 1: ~2000-2500ms
// attempt 2: ~4000-4500ms
// attempt 3: ~8000-8500ms
// attempt 4: ~16000-16500ms
// attempt 5+: ~30000-30500ms (capped)
```

**Session resume on reconnect:** After reconnection, the client should re-send the last `sessionId` so the gateway associates the new WebSocket with the existing session state. The `ChatSend` message already supports `sessionId` as an optional field. The reconnect hook should store the last `sessionId` and include it in the first message after reconnect.

**CLI hook (needs full rewrite):** The current CLI `useWebSocket` creates a single `ws` connection with no reconnect. Must add `close` handler with backoff retry loop, reset attempt counter on successful open.

**Desktop hook (needs modification):** The current desktop `useWebSocket` already has reconnect logic with `MAX_RETRIES=5` and `RECONNECT_DELAY_MS=3000`. Changes needed:
1. Replace fixed delay with exponential backoff function
2. Remove `MAX_RETRIES` cap (unlimited retries with backoff)
3. Store/restore `sessionId` for session resumption

### Pattern 4: Vitest Projects Configuration

**What:** Configure Vitest with the modern `projects` approach (Vitest 3.2+ deprecates `workspace`).

**Two viable approaches:**

**Approach A: Root vitest.config.ts with projects (Vitest-native)**
```typescript
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
});
```
Each package gets its own `vitest.config.ts`:
```typescript
// packages/gateway/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'gateway',
    include: ['src/**/*.test.ts'],
  },
});
```
Run: `npx vitest` from root runs all packages in one process.

**Approach B: Per-package test scripts with Turborepo (Turbo-native, recommended by Turborepo docs)**
Each package.json gets:
```json
{ "scripts": { "test": "vitest run" } }
```
Turbo parallelizes and caches per-package. Run: `pnpm turbo test`.

**Recommendation: Use Approach A (root vitest.config.ts with projects)** because:
1. The success criterion says `pnpm test` from repo root discovers and runs tests across all packages -- a root config achieves this naturally
2. The turbo.json already has `"test": { "dependsOn": ["build"] }` which calls each package's test script
3. With a root `vitest.config.ts`, we can also run `npx vitest` directly for watch mode during development
4. Phase 28 (Testing Foundation) creates tests in `packages/gateway` -- having a unified config makes that smoother

**Turbo.json update needed:**
Current turbo.json has `"test": { "dependsOn": ["build"] }`. This is correct -- tests should run after build since TypeScript compilation is needed. No change needed.

**Per-package vitest.config.ts:** Each package that will have tests needs its own config to specify test file patterns and any environment-specific settings (e.g., the desktop app would need `environment: 'jsdom'` if tested).

### Anti-Patterns to Avoid
- **Moving vault to a separate `@tek/vault` package:** Adds a package for 3 files. The sub-export from `@tek/core` is simpler and keeps the package count low.
- **Global error boundary only at the root:** A single boundary around `<App>` would lose the Layout/sidebar on error. Per-page boundaries inside `<Layout>` preserve navigation.
- **Reconnect without jitter:** Multiple clients reconnecting simultaneously after gateway restart creates a thundering herd. Always add jitter.
- **Using `vitest.workspace.ts`:** Deprecated since Vitest 3.2 and prints a warning. Use `projects` in `vitest.config.ts` instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| React error boundaries | Custom class component with `componentDidCatch` | `react-error-boundary` v6 | Provides `resetKeys`, `onReset`, `FallbackComponent` props; handles edge cases around concurrent mode |
| Exponential backoff math | Custom delay calculation | Simple utility function (hand-roll is fine) | The formula is 3 lines; a library is overkill for this |
| Vitest monorepo config | Custom test runner scripts | Vitest `projects` config | Built-in feature; don't script around it |

**Key insight:** The vault extraction and Vitest setup are pure refactoring/configuration -- no new libraries needed beyond `react-error-boundary` for the error boundaries.

## Common Pitfalls

### Pitfall 1: Native Module in @tek/core Breaks Desktop Builds
**What goes wrong:** `@napi-rs/keyring` is a native Node.js addon. If the desktop app (Vite/browser context) tries to bundle `@tek/core` and encounters the keyring import, the build breaks.
**Why it happens:** The desktop app imports `@tek/core` for config types. If the vault code is in the same entry point, Vite tries to resolve `@napi-rs/keyring` for the browser.
**How to avoid:** Use the separate `./vault` sub-export. The desktop app imports from `@tek/core` (main entry) which does NOT re-export vault. Only Node.js packages (`@tek/gateway`, `@tek/cli`) import from `@tek/core/vault`. The vault module must NOT be re-exported from `packages/core/src/index.ts`.
**Warning signs:** Vite build errors mentioning `@napi-rs/keyring` or `node:` imports.

### Pitfall 2: @tek/db Becomes a Dependency of @tek/core
**What goes wrong:** Moving vault to `@tek/core` requires adding `@tek/db` as a dependency because `vault/index.ts` calls `recordAuditEvent()` from `@tek/db`. This creates a new dependency edge: `@tek/core -> @tek/db`. Currently `@tek/db -> @tek/core` already exists. This would be a circular dependency.
**Why it happens:** The vault's audit logging couples it to the database layer.
**How to avoid:** Two options: (a) Remove the `recordAuditEvent` calls from vault and have the calling code handle audit logging (cleanest), or (b) accept `@tek/db` as an optional dependency and conditionally import it. Option (a) is strongly recommended -- the vault should be a pure credential store, and audit logging belongs at the call site (handlers, CLI commands).
**Warning signs:** `pnpm turbo build` still shows circular dependency warnings after vault move.

### Pitfall 3: Tauri WebSocket Plugin API Differs from Node ws
**What goes wrong:** The desktop uses `@tauri-apps/plugin-websocket` (Tauri's Rust-backed WS), not the `ws` npm package. The reconnect implementation must use TauriWebSocket's API (`connect()`, `addListener()`, `disconnect()`), not `new WebSocket()`.
**Why it happens:** Tauri apps can't use Node.js `ws` in the renderer.
**How to avoid:** Keep the two `useWebSocket` hooks separate. Extract only the backoff logic into a shared utility if needed.
**Warning signs:** TypeScript errors about incompatible WebSocket types.

### Pitfall 4: Error Boundary Doesn't Catch Async Errors
**What goes wrong:** React error boundaries only catch errors during rendering, not in event handlers, async code, or `useEffect`. Network errors in `useChat` or `useWebSocket` won't be caught.
**Why it happens:** This is a fundamental React limitation.
**How to avoid:** Error boundaries handle render crashes (the white-screen problem). Async errors should be caught with try/catch and rendered as error state in the component (the hooks already do this with `error` state).
**Warning signs:** "Something went wrong" not appearing for network failures.

### Pitfall 5: Session Not Resumable After Gateway Restart
**What goes wrong:** After reconnecting, the client sends `sessionId` but the gateway has lost all in-memory session state (it restarted).
**Why it happens:** Sessions are managed in-memory (`sessionManager`). A gateway restart clears all sessions.
**How to avoid:** The reconnect should handle the case where the session no longer exists gracefully. The gateway already creates a new session if `sessionId` is not found. The client should detect a "new session" response and update its stored sessionId. The requirement says "resuming the session without user intervention" -- this means the client should seamlessly create a new session if the old one is gone, not fail.
**Warning signs:** "Session not found" errors after gateway restart.

## Code Examples

### Exponential Backoff Utility
```typescript
// Source: Standard pattern, verified against websocket-ts and MDN recommendations

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const JITTER_FACTOR = 0.3; // 0-30% of delay added as jitter

export function getReconnectDelay(attempt: number): number {
  const exponential = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  const jitter = exponential * JITTER_FACTOR * Math.random();
  return exponential + jitter;
}
```

### CLI useWebSocket with Reconnect (Sketch)
```typescript
// Source: Based on current packages/cli/src/hooks/useWebSocket.ts + backoff pattern

export function useWebSocket(opts: UseWebSocketOptions): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const sessionIdRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(opts.url);
    wsRef.current = ws;

    ws.on("open", () => {
      setConnected(true);
      attemptRef.current = 0; // Reset on successful connection
    });

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as ServerMessage;
        // Track sessionId from server responses
        if ("sessionId" in msg && typeof msg.sessionId === "string") {
          sessionIdRef.current = msg.sessionId;
        }
        onMessageRef.current(msg);
      } catch { /* ignore */ }
    });

    ws.on("close", () => {
      setConnected(false);
      wsRef.current = null;
      // Schedule reconnect with exponential backoff
      const delay = getReconnectDelay(attemptRef.current);
      attemptRef.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    });

    ws.on("error", () => {
      ws.close(); // Will trigger 'close' handler -> reconnect
    });
  }, [opts.url]);

  // ...
}
```

### react-error-boundary PageErrorFallback
```tsx
// Source: react-error-boundary v6 API (https://github.com/bvaughn/react-error-boundary)

import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

function PageErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <div className="text-red-400 text-4xl">!</div>
      <h2 className="text-xl font-semibold text-gray-200">Something went wrong</h2>
      <pre className="text-sm text-gray-400 max-w-md overflow-auto whitespace-pre-wrap">
        {error.message}
      </pre>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
```

### Vitest Root Config
```typescript
// vitest.config.ts (repo root)
// Source: https://vitest.dev/guide/projects

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
});
```

```typescript
// packages/gateway/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'gateway',
    include: ['src/**/*.test.ts'],
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vitest.workspace.ts` | `projects` in `vitest.config.ts` | Vitest 3.2 (June 2025) | Old approach deprecated, prints warning |
| Class-based ErrorBoundary | `react-error-boundary` v6 with hooks | v5+ (2024) | Supports `useErrorBoundary`, `resetKeys`, concurrent mode |
| Fixed-delay reconnect | Exponential backoff + jitter | Industry standard | Prevents thundering herd, reduces server load |

**Deprecated/outdated:**
- `vitest.workspace.ts` / `vitest.workspace.json`: Deprecated in Vitest 3.2, will be removed in future major version

## Open Questions

1. **Vault audit logging after extraction**
   - What we know: `vault/index.ts` imports `recordAuditEvent` from `@tek/db`. Moving vault to `@tek/core` would create `@tek/core -> @tek/db` while `@tek/db -> @tek/core` already exists (circular).
   - What's unclear: Whether audit events are consumed by any UI or just logged.
   - Recommendation: Remove `recordAuditEvent` from vault functions and have CLI commands call it directly after vault operations. This keeps vault as a pure credential store with no DB dependency.

2. **Session persistence across gateway restarts**
   - What we know: Sessions are in-memory. The requirement says "resuming the session without user intervention."
   - What's unclear: Whether "resume" means literally the same session or "seamlessly start a new one."
   - Recommendation: Interpret as "client automatically reconnects and starts a new session if the old one is gone, without prompting the user." The conversation history is in SQLite, so the user doesn't lose data.

3. **Desktop app test environment**
   - What we know: The desktop app uses React 19 + Tauri + Vite. If tests are added later, they'd need `jsdom` or `happy-dom`.
   - What's unclear: Whether Phase 28 will add desktop tests.
   - Recommendation: Create the per-package vitest config only for packages that will have tests in Phase 28 (`packages/gateway`, `packages/core`). Skip `apps/desktop` and `packages/cli` for now.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/cli/src/vault/` (3 files, ~120 LOC)
- Codebase analysis: `packages/gateway/package.json` confirming `@tek/cli` dependency
- Codebase analysis: `apps/desktop/src/App.tsx` confirming zero error boundaries
- Codebase analysis: `packages/cli/src/hooks/useWebSocket.ts` confirming zero reconnect logic
- Codebase analysis: `apps/desktop/src/hooks/useWebSocket.ts` confirming fixed-delay reconnect
- [Vitest Projects docs](https://vitest.dev/guide/projects) - projects config replacing workspace
- [Turborepo Vitest guide](https://turborepo.dev/docs/guides/tools/vitest) - per-package test scripts

### Secondary (MEDIUM confidence)
- [react-error-boundary npm](https://www.npmjs.com/package/react-error-boundary) - v6.1.1, API surface
- [Vitest 3.2 blog post](https://vitest.dev/blog/vitest-3-2.html) - workspace deprecation
- [websocket-ts docs](https://jjxxs.github.io/websocket-ts/) - exponential backoff pattern reference

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Only one new dependency (`react-error-boundary`), rest is configuration
- Architecture: HIGH - Vault extraction path is clear from codebase analysis; all import sites identified
- Pitfalls: HIGH - Circular dependency risk with `@tek/db` identified and mitigation documented; native module isolation via sub-export verified

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable domain, no fast-moving dependencies)
