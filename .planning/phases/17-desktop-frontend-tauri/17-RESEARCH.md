# Phase 17: Desktop Frontend (Tauri) - Research

**Researched:** 2026-02-18
**Domain:** Desktop GUI application with Tauri v2, React, TypeScript
**Confidence:** MEDIUM

## Summary

Tauri v2 is the standard framework for building lightweight desktop apps with web frontends. It uses a Rust core with the OS native webview (WebKit on macOS) and provides a rich plugin ecosystem for file system access, WebSocket connections, shell/sidecar process management, system tray, and auto-updates. The tek project already has the gateway running as a standalone Node.js process on localhost with WebSocket protocol -- the desktop app does NOT need to embed or replace the gateway. Instead, it acts as a GUI client that discovers the running gateway (via `~/.config/tek/runtime.json`), connects over WebSocket, and manages the gateway lifecycle via shell commands.

The existing CLI already has React hooks (`useWebSocket`, `useChat`) and typed gateway client code that can be extracted and reused in the Tauri frontend. The WebSocket protocol is fully typed with Zod schemas in `@tek/gateway`. The desktop app will be a new `packages/desktop` (or `apps/desktop`) workspace package containing a Vite+React frontend and a `src-tauri` Rust backend.

**Primary recommendation:** Create a Tauri v2 + React + Vite desktop app as a new workspace package. Use the Tauri WebSocket plugin for gateway communication (not the Node.js `ws` module). Use the Tauri shell plugin to spawn/stop the gateway process. Reuse existing `@tek/core` constants and `@tek/gateway` protocol types. Do NOT bundle the gateway as a sidecar -- the gateway is a separate process managed by the user's system.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tauri` (Rust crate) | `~2.10` | Desktop app framework (Rust backend) | Only serious Electron alternative; 10x smaller bundles, OS native webview |
| `@tauri-apps/api` | `^2.10` | Frontend JS API for Tauri IPC | Official Tauri frontend bindings |
| `@tauri-apps/cli` | `^2.10` | Build/dev CLI tooling | Required to build and develop Tauri apps |
| `react` | `^19.0.0` | UI framework | Already used in CLI's Ink components; team familiarity |
| `vite` | `^6` | Frontend bundler/dev server | Tauri's recommended bundler for React SPAs |
| `typescript` | `^5.9` | Type safety | Already used across the monorepo |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/plugin-websocket` | `^2` | WebSocket client via Rust | Connect to gateway WebSocket from Tauri webview |
| `@tauri-apps/plugin-shell` | `^2` | Spawn/manage child processes | Start/stop gateway, run `tek` CLI commands |
| `@tauri-apps/plugin-fs` | `^2` | File system read/write | Read/write identity files (SOUL.md, IDENTITY.md), config |
| `@tauri-apps/plugin-process` | `^2` | App process control | Exit app, restart |
| `@tauri-apps/plugin-updater` | `^2` | Auto-update mechanism | Ship updates via GitHub Releases |
| `zustand` | `^5` | Global UI state management | Lightweight store for app state (connection, settings) |
| `tailwindcss` | `^4` | Utility-first CSS | Fast UI development, consistent design |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tauri WebSocket plugin | Browser native `WebSocket` | Tauri webview MAY restrict `ws://localhost` connections due to CSP; the plugin routes through Rust and bypasses CSP restrictions. Plugin is the safer choice. |
| Zustand | React Context + useReducer | Context causes unnecessary re-renders; Zustand is tiny (1KB) and selective |
| Tailwind CSS | CSS Modules / styled-components | Tailwind is faster for prototyping and has no runtime cost |
| Vite | Webpack / Turbopack | Vite is Tauri's official recommendation for React SPAs |

**Installation:**
```bash
# In the desktop package directory
pnpm add react react-dom @tauri-apps/api @tauri-apps/plugin-websocket @tauri-apps/plugin-shell @tauri-apps/plugin-fs @tauri-apps/plugin-process zustand
pnpm add -D @tauri-apps/cli vite @vitejs/plugin-react typescript tailwindcss
# In src-tauri:
cargo add tauri-plugin-websocket tauri-plugin-shell tauri-plugin-fs tauri-plugin-process
```

## Architecture Patterns

### Recommended Project Structure
```
packages/desktop/
├── package.json
├── vite.config.ts
├── index.html
├── tsconfig.json
├── tailwind.config.ts
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Root component with routing
│   ├── lib/
│   │   ├── gateway-client.ts # WebSocket client (Tauri plugin-based)
│   │   ├── discovery.ts      # Read runtime.json for gateway status
│   │   ├── process.ts        # Start/stop gateway via shell plugin
│   │   └── files.ts          # Read/write identity & config files
│   ├── hooks/
│   │   ├── useWebSocket.ts   # WebSocket hook (adapted for Tauri plugin)
│   │   ├── useChat.ts        # Chat state management (reused from CLI)
│   │   ├── useGateway.ts     # Gateway lifecycle (start/stop/status)
│   │   └── useConfig.ts      # App configuration state
│   ├── stores/
│   │   └── app-store.ts      # Zustand global state
│   ├── pages/
│   │   ├── ChatPage.tsx       # Chat interface
│   │   ├── DashboardPage.tsx  # Gateway status, quick actions
│   │   ├── AgentsPage.tsx     # Agent personality file management
│   │   ├── SettingsPage.tsx   # Config, API keys, model settings
│   │   └── SetupPage.tsx      # First-run onboarding
│   └── components/
│       ├── ChatMessage.tsx
│       ├── ChatInput.tsx
│       ├── Sidebar.tsx
│       ├── GatewayStatus.tsx
│       ├── ToolApproval.tsx
│       └── StreamingText.tsx
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/
    │   └── default.json       # Permissions for plugins
    ├── icons/                 # App icons
    └── src/
        ├── lib.rs             # Plugin registration, setup
        └── main.rs            # Entry point
```

### Pattern 1: Gateway Discovery via File System Plugin
**What:** Read `~/.config/tek/runtime.json` to discover if gateway is running, get port/PID.
**When to use:** On app launch and when checking gateway status.
**Example:**
```typescript
// Source: Adapted from packages/cli/src/lib/discovery.ts
import { readTextFile, exists } from '@tauri-apps/plugin-fs';

interface RuntimeInfo {
  pid: number;
  port: number;
  startedAt: string;
}

export async function discoverGateway(): Promise<RuntimeInfo | null> {
  const runtimePath = '~/.config/tek/runtime.json'; // Use homeDir() + path
  const fileExists = await exists(runtimePath, { baseDir: BaseDirectory.Home });
  if (!fileExists) return null;

  try {
    const content = await readTextFile(runtimePath, { baseDir: BaseDirectory.Home });
    return JSON.parse(content) as RuntimeInfo;
  } catch {
    return null;
  }
}
```

### Pattern 2: WebSocket Connection via Tauri Plugin
**What:** Connect to the gateway WebSocket using the Tauri WebSocket plugin instead of browser native WebSocket.
**When to use:** For all gateway communication (chat, sessions, etc.).
**Example:**
```typescript
// Source: https://v2.tauri.app/plugin/websocket/
import WebSocket from '@tauri-apps/plugin-websocket';

const ws = await WebSocket.connect(`ws://127.0.0.1:${port}/gateway`);
ws.addListener((msg) => {
  const parsed = JSON.parse(msg.data as string) as ServerMessage;
  handleServerMessage(parsed);
});
await ws.send(JSON.stringify({ type: 'chat.send', id: nanoid(), content: text }));
```

### Pattern 3: Gateway Process Management via Shell Plugin
**What:** Start/stop the gateway by spawning the `tek` CLI binary or the gateway entry point directly.
**When to use:** Dashboard controls for gateway lifecycle.
**Example:**
```typescript
// Source: https://v2.tauri.app/plugin/shell/
import { Command } from '@tauri-apps/plugin-shell';

export async function startGateway(): Promise<void> {
  // Option A: Use the tek CLI
  const command = Command.create('tek', ['gateway', 'start']);
  await command.execute();
  // Option B: Spawn node directly with gateway entry point
  // const command = Command.create('node', ['~/tek/packages/gateway/dist/index.js']);
}

export async function stopGateway(): Promise<void> {
  const command = Command.create('tek', ['gateway', 'stop']);
  await command.execute();
}
```

### Pattern 4: Reuse Protocol Types from @tek/gateway
**What:** Import `ServerMessage` and `ClientMessage` types from the gateway package.
**When to use:** Always -- for type-safe WebSocket communication.
**Note:** The desktop package can depend on `@tek/gateway` as a workspace dependency for types only. The Zod schemas and TypeScript types are importable without running the gateway.

### Anti-Patterns to Avoid
- **Bundling the gateway as a Tauri sidecar:** The gateway is a long-running server with dependencies on SQLite, AI SDK, etc. Compiling it to a standalone binary is fragile and unnecessary. The gateway runs independently.
- **Using browser native WebSocket in Tauri webview:** May hit CSP issues. Use the Tauri WebSocket plugin which routes through Rust and avoids CSP entirely.
- **Writing Rust IPC commands for everything:** The Tauri app is thin -- it delegates to the gateway over WebSocket for all AI/agent functionality. Rust commands should be limited to process management and file I/O that plugins don't cover.
- **Duplicating CLI logic:** Extract shared hooks/types into importable packages rather than copy-pasting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket client | Custom WebSocket wrapper with reconnect | `@tauri-apps/plugin-websocket` | CSP-safe, Rust-backed, handles connection lifecycle |
| Process spawning | Node.js `child_process` via IPC | `@tauri-apps/plugin-shell` Command API | Sandboxed, permission-controlled, handles cleanup on app exit |
| File reading/writing | Rust IPC commands for every file op | `@tauri-apps/plugin-fs` | Already built, permission-scoped, handles platform differences |
| Auto-update | Custom update checker + downloader | `@tauri-apps/plugin-updater` | Handles signing, delta updates, platform-specific installers |
| System tray | Custom menu bar approach | Tauri `tray-icon` feature + `TrayIconBuilder` | Native OS integration, handles macOS/Windows/Linux differences |
| State management | React Context for global state | `zustand` | Selective re-renders, devtools, tiny bundle size |

**Key insight:** Tauri's plugin ecosystem covers 90% of what the desktop app needs. The remaining 10% is domain-specific UI and connecting to the existing gateway protocol.

## Common Pitfalls

### Pitfall 1: CSP Blocking WebSocket Connections
**What goes wrong:** The Tauri webview enforces Content Security Policy by default. `ws://127.0.0.1:*` connections from the frontend may be blocked.
**Why it happens:** Tauri uses a custom protocol (`tauri://`) for serving frontend assets, and the default CSP doesn't include `ws://` connect-src.
**How to avoid:** Use the `@tauri-apps/plugin-websocket` which connects via Rust (bypasses CSP entirely). Alternatively, configure CSP in `tauri.conf.json` under `app.security.csp` to allow `ws://127.0.0.1:*`.
**Warning signs:** WebSocket connection fails silently in the webview console.

### Pitfall 2: pnpm Workspace Detection Issues
**What goes wrong:** `pnpm tauri add [plugin]` uses npm instead of pnpm because it doesn't detect the workspace correctly.
**Why it happens:** Known bug -- Tauri CLI looks for `pnpm-lock.yaml` in the package directory, not the workspace root.
**How to avoid:** Install Tauri plugins manually: `pnpm add @tauri-apps/plugin-shell` for JS, `cargo add tauri-plugin-shell` in `src-tauri/` for Rust. Don't rely on `tauri add`.
**Warning signs:** npm lockfile appearing in the package directory.

### Pitfall 3: Vite Dev Server Port Mismatch
**What goes wrong:** `tauri dev` can't connect to the Vite dev server.
**Why it happens:** Vite picks a random port if 5173 is taken, but Tauri expects the exact `devUrl` configured.
**How to avoid:** Set `strictPort: true` in `vite.config.ts`. Configure `devUrl: "http://localhost:5173"` in `tauri.conf.json`.
**Warning signs:** White screen in the Tauri window during development.

### Pitfall 4: Gateway Not Found on App Launch
**What goes wrong:** User opens the desktop app but the gateway isn't running, leading to a broken experience.
**Why it happens:** The gateway is a separate process that must be started independently.
**How to avoid:** On app launch, check `runtime.json`. If gateway is not running, show a prominent "Start Gateway" button or offer to start it automatically. Consider auto-starting the gateway when the app launches.
**Warning signs:** Chat page with connection error, no clear path to resolution.

### Pitfall 5: Sidecar Process Orphaning
**What goes wrong:** If the app starts the gateway and then crashes, the gateway process continues running without management.
**Why it happens:** Detached child processes survive parent exit by design.
**How to avoid:** This is actually DESIRED behavior for tek -- the gateway is meant to run independently. But track that the app started it, and offer to stop it on graceful app close. Use the existing `runtime.json` PID-based discovery.
**Warning signs:** Multiple gateway instances running.

### Pitfall 6: Tauri Plugin Registration Order
**What goes wrong:** Plugins silently fail or aren't available in JavaScript.
**Why it happens:** Each plugin must be registered in `lib.rs` AND have permissions in `capabilities/default.json`.
**How to avoid:** For every plugin: (1) add Rust crate, (2) register in `tauri::Builder`, (3) add capability permissions, (4) install JS bindings.
**Warning signs:** "Plugin not found" errors at runtime.

## Code Examples

### Tauri Configuration (tauri.conf.json)
```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-config-schema/schema.json",
  "productName": "Tek",
  "version": "0.1.0",
  "identifier": "com.tek.desktop",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Tek",
        "width": 1000,
        "height": 700,
        "minWidth": 600,
        "minHeight": 400
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' ws://127.0.0.1:*; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["dmg", "app"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "minimumSystemVersion": "10.15"
    }
  }
}
```

### Vite Configuration (vite.config.ts)
```typescript
// Source: https://v2.tauri.app/start/frontend/vite/
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
```

### Rust Plugin Registration (src-tauri/src/lib.rs)
```rust
// Source: https://v2.tauri.app/plugin/websocket/, shell, fs, process docs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Capabilities/Permissions (src-tauri/capabilities/default.json)
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "websocket:default",
    "shell:allow-execute",
    "shell:allow-spawn",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-exists",
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "$HOME/.config/tek/**" },
        { "path": "$HOME/tek/**" }
      ]
    },
    {
      "identifier": "shell:allow-execute",
      "allow": [
        { "name": "tek", "cmd": "tek", "args": true }
      ]
    },
    "process:default"
  ]
}
```

### Adapted useWebSocket Hook for Tauri
```typescript
import { useState, useRef, useCallback, useEffect } from 'react';
import TauriWebSocket from '@tauri-apps/plugin-websocket';
import type { ServerMessage, ClientMessage } from '@tek/gateway';

export function useWebSocket(url: string, onMessage: (msg: ServerMessage) => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<TauriWebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    TauriWebSocket.connect(url).then((ws) => {
      if (cancelled) { ws.disconnect(); return; }
      wsRef.current = ws;
      setConnected(true);
      ws.addListener((msg) => {
        try {
          const parsed = JSON.parse(msg.data as string) as ServerMessage;
          onMessage(parsed);
        } catch { /* ignore */ }
      });
    }).catch(() => setConnected(false));
    return () => {
      cancelled = true;
      wsRef.current?.disconnect();
    };
  }, [url]);

  const send = useCallback((msg: ClientMessage) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  return { send, connected };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 (allowlist security) | Tauri v2 (capabilities/permissions) | Oct 2024 | All permission config changed; use `capabilities/` dir not `tauri.conf.json > tauri > allowlist` |
| Electron for desktop apps | Tauri v2 | 2024-2025 | 10-50x smaller bundles, native webview, Rust backend |
| `tauri::api::shell` (v1) | `@tauri-apps/plugin-shell` (v2) | Oct 2024 | Shell is now a separate plugin, not built into core |
| CSP via allowlist | CSP via `app.security.csp` | Tauri v2 | More standard CSP configuration |

**Deprecated/outdated:**
- Tauri v1 `allowlist` config pattern: Replaced by capabilities in v2
- `tauri::api::*` modules: Extracted to individual plugins in v2
- `pkg` for Node.js binary compilation: Deprecated, use `esbuild` or `bun build --compile` if sidecar is needed (but we don't need it for this phase)

## Open Questions

1. **WebSocket Plugin vs Native WebSocket**
   - What we know: The Tauri WebSocket plugin routes through Rust and avoids CSP issues. Native WebSocket might also work if CSP is configured.
   - What's unclear: Whether the Tauri WebSocket plugin API is identical enough to browser WebSocket for the existing `useChat` hook to work with minimal changes.
   - Recommendation: Start with the plugin. If the API mismatch is too large, configure CSP and use native WebSocket as a fallback.

2. **Shared Code Extraction**
   - What we know: `useChat` hook, `ChatMessage` types, and `gateway-client.ts` factory functions in the CLI are reusable.
   - What's unclear: Whether to extract shared code into a new `@tek/shared` package or simply import from `@tek/cli`.
   - Recommendation: Import types from `@tek/gateway` (already exported). For hooks, either extract to a `@tek/ui` package or duplicate with Tauri-specific adaptations (the hooks are small).

3. **Gateway Auto-Start Behavior**
   - What we know: The CLI requires users to manually run `tek gateway start`. The desktop app could auto-start.
   - What's unclear: Whether auto-starting on app launch is desirable or if users prefer manual control.
   - Recommendation: Auto-start if not running, with a setting to disable auto-start. Show clear status indicator always.

4. **System Tray Integration**
   - What we know: Tauri v2 supports system tray with menu items, dock icon hiding, and background running.
   - What's unclear: Whether the app should be a full windowed app, a menu bar app, or both.
   - Recommendation: Start as a windowed app with optional system tray for gateway status. Menu bar mode can be added later.

5. **Package Location in Monorepo**
   - What we know: `pnpm-workspace.yaml` includes both `packages/*` and `apps/*`.
   - What's unclear: Whether the desktop app belongs in `packages/desktop` or `apps/desktop`.
   - Recommendation: Use `apps/desktop` since the desktop app is an end-user application (like the CLI), not a shared library. The `apps/*` glob already exists in the workspace config.

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Official Documentation](https://v2.tauri.app/) - WebSocket plugin, shell plugin, fs plugin, system tray, Vite setup, sidecar, capabilities
- [Tauri v2 WebSocket Plugin](https://v2.tauri.app/plugin/websocket/) - Installation, API, permissions
- [Tauri v2 Shell Plugin](https://v2.tauri.app/reference/javascript/shell/) - Command execution, sidecar, permissions
- [Tauri v2 File System Plugin](https://v2.tauri.app/plugin/file-system/) - Read/write, scopes, permissions
- [Tauri v2 System Tray](https://v2.tauri.app/learn/system-tray/) - Rust and JS APIs
- [Tauri v2 Vite Frontend](https://v2.tauri.app/start/frontend/vite/) - Configuration
- [Tauri v2 DMG Distribution](https://v2.tauri.app/distribute/dmg/) - macOS bundle config
- [Tauri v2 Updater Plugin](https://v2.tauri.app/plugin/updater/) - Auto-update setup

### Secondary (MEDIUM confidence)
- [Tauri v2 Node.js Sidecar](https://v2.tauri.app/learn/sidecar-nodejs/) - For reference, not planned for use
- [Tauri v2 + Next.js Monorepo Guide](https://melvinoostendorp.nl/blog/tauri-v2-nextjs-monorepo-guide) - Monorepo patterns
- [dannysmith/tauri-template](https://github.com/dannysmith/tauri-template) - Production-ready React + Tauri v2 template
- [@tauri-apps/cli npm](https://www.npmjs.com/package/@tauri-apps/cli) - Version 2.10.0 confirmed

### Tertiary (LOW confidence)
- [Tauri pnpm workspace bug #12706](https://github.com/tauri-apps/tauri/issues/12706) - `tauri add` detection issue
- [Tauri pnpm workspace bug #11859](https://github.com/tauri-apps/tauri/issues/11859) - Dependency install issue

## Codebase Integration Notes

### Existing Code to Reuse
- **`@tek/gateway` protocol types:** `ServerMessage`, `ClientMessage` from `packages/gateway/src/ws/protocol.ts` -- fully typed with Zod, 30+ message types covering chat streaming, tool calls, sessions, workflows, schedules, memory, threads
- **`@tek/core` constants:** `CONFIG_DIR`, `RUNTIME_PATH`, `LOG_PATH`, `DISPLAY_NAME`, `CLI_COMMAND` from `packages/core/src/config/`
- **`useChat` hook pattern:** `packages/cli/src/hooks/useChat.ts` -- full chat state machine (streaming, tool calls, approvals, preflight, sessions, usage tracking). Needs WebSocket adapter swap only.
- **`gateway-client.ts` factories:** `packages/cli/src/lib/gateway-client.ts` -- `createChatSendMessage`, `createSessionListMessage`, etc. Pure functions, no Node.js deps.
- **`discovery.ts` pattern:** `packages/cli/src/lib/discovery.ts` -- reads `runtime.json`, checks PID liveness. Needs Tauri fs plugin adaptation.

### Key Integration Points
- Gateway WebSocket URL: `ws://127.0.0.1:${port}/gateway` (port from `runtime.json`)
- Auth token: stored in OS keychain via `@napi-rs/keyring` with service `tek` and account `api-endpoint-token`
- Config file: `~/.config/tek/config.json`
- Identity files (Phase 16): `~/.config/tek/SOUL.md`, `~/.config/tek/IDENTITY.md`, etc.

### Environment Confirmed
- Rust: `rustc 1.89.0` (installed, exceeds Tauri's requirement of 1.77.2+)
- Node.js: `v24.1.0` (exceeds requirement)
- pnpm: `8.15.1`
- Workspace already has `apps/*` glob in `pnpm-workspace.yaml`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Tauri v2 is well-documented, stable (2.10.x), React+Vite is the blessed path
- Architecture: MEDIUM - Monorepo integration with pnpm has known bugs; WebSocket plugin API needs hands-on validation
- Pitfalls: MEDIUM - Based on official docs and issue tracker, but some are hypothetical until validated
- Codebase integration: HIGH - Direct code review of existing hooks, types, and patterns

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (Tauri v2 is stable; 30-day validity)
