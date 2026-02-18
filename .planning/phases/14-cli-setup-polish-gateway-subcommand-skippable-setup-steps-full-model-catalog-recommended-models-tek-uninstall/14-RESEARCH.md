# Phase 14: CLI & Setup Polish - Research

**Researched:** 2026-02-18
**Domain:** CLI subcommands, setup wizard UX, model catalogs, uninstall lifecycle
**Confidence:** HIGH

## Summary

Phase 14 polishes five areas of the Tek CLI: (1) a `tek gateway` subcommand group replacing the raw `node ~/tek/packages/gateway/dist/index.js` invocation, (2) making each `tek init` setup step independently skippable with current-value display, (3) expanding the Venice AI model catalog to cover all text models from their API, (4) adding per-provider recommended-model annotations, and (5) a `tek uninstall` command for clean removal.

The codebase already uses Commander.js for CLI commands, Ink + @inkjs/ui for the React-based onboarding wizard, and a runtime.json PID-file pattern for gateway discovery. All five features layer on existing patterns. The gateway subcommand is a new Commander command that spawns/forks the gateway process. The skippable setup wizard requires reworking the linear Onboarding.tsx state machine to load existing config. The model catalog is a static data structure that needs updating. The uninstall command is a new Commander command that performs file/keychain/PATH cleanup.

**Primary recommendation:** Implement as 2-3 plans: (A) gateway subcommand group + uninstall command (pure CLI, no UI), (B) skippable setup wizard + model catalog with recommendations (Ink UI work), and optionally (C) install/update script updates.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | ^12.0.0 | CLI command/subcommand routing | Already used for all CLI commands |
| ink | ^6.0.0 | React-based terminal UI | Already used for Onboarding, Chat |
| @inkjs/ui | ^2.0.0 | Select, TextInput, ConfirmInput components | Already used in Onboarding wizard |
| chalk | ^5.0.0 | Terminal string coloring | Already used throughout CLI |
| @napi-rs/keyring | ^1.2.0 | macOS Keychain access | Already used for key storage |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:child_process | built-in | spawn/fork gateway process | `tek gateway start` needs to launch gateway |
| node:fs | built-in | File deletion for uninstall | `tek uninstall` removes files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| child_process.fork() for gateway | child_process.spawn() with detached | fork() shares node modules path; spawn() with detached+unref gives true daemon. spawn() is better for `tek gateway start` because it detaches from parent |
| Static model catalog | API call to Venice /models endpoint | API call requires network + API key at init time; static catalog is simpler and works offline. Can be refreshed periodically |

**Installation:** No new packages needed. All dependencies are already in the project.

## Architecture Patterns

### Recommended Project Structure
```
packages/cli/src/
  commands/
    gateway.ts           # NEW: tek gateway start|stop|status|logs
    uninstall.ts         # NEW: tek uninstall
    init.ts              # MODIFIED: wire up skippable wizard
  components/
    Onboarding.tsx       # MODIFIED: skippable steps, current-value display
  lib/
    discovery.ts         # EXISTING: gateway PID/port discovery
    models.ts            # NEW: model catalog with recommendations

packages/core/src/config/
    constants.ts         # MAY ADD: INSTALL_DIR default constant
```

### Pattern 1: Commander Subcommand Group
**What:** Use Commander's `.command()` with nested subcommands for `tek gateway start|stop|status|logs`
**When to use:** When a CLI command has multiple related operations
**Example:**
```typescript
// Source: existing pattern in packages/cli/src/commands/config.ts
export const gatewayCommand = new Command("gateway")
  .description("Manage the Tek gateway server");

gatewayCommand
  .command("start")
  .description("Start the gateway server")
  .option("--foreground", "Run in foreground (default: background)")
  .action(async (options) => {
    // Check if already running via discoverGateway()
    // Spawn gateway process
  });

gatewayCommand
  .command("stop")
  .description("Stop the gateway server")
  .action(async () => {
    // Read runtime.json, send SIGTERM
  });
```
**Confidence:** HIGH -- this exactly matches the existing `configCommand` pattern in config.ts and `keysCommand` in keys.ts.

### Pattern 2: Skippable Onboarding Steps
**What:** Each Onboarding step checks for existing config values and offers skip option
**When to use:** Re-running `tek init` when already configured
**Example:**
```typescript
// Concept: each step shows current value and offers skip
if (step === "mode" && existingConfig) {
  return (
    <Box flexDirection="column">
      <Text>Current security mode: <Text bold>{existingConfig.securityMode}</Text></Text>
      <Text dimColor>Press Enter to keep, or select a new mode:</Text>
      <Select
        options={[
          { label: "Keep current", value: "__skip__" },
          { label: "Full Control", value: "full-control" },
          { label: "Limited Control", value: "limited-control" },
        ]}
        onChange={(v) => { if (v !== "__skip__") setMode(v); setStep(nextStep); }}
      />
    </Box>
  );
}
```
**Confidence:** HIGH -- follows existing Ink/Select patterns already in Onboarding.tsx.

### Pattern 3: Static Model Catalog with Recommendations
**What:** A centralized data structure mapping providers to their available models with metadata
**When to use:** Model selection during setup, /swap command reference
**Example:**
```typescript
// packages/cli/src/lib/models.ts
export interface ModelInfo {
  id: string;           // e.g. "llama-3.3-70b"
  qualifiedId: string;  // e.g. "venice:llama-3.3-70b"
  displayName: string;  // e.g. "Llama 3.3 70B"
  recommended?: string; // e.g. "low-cost", "coding", "general"
  contextWindow?: number;
  tier?: "xs" | "s" | "m" | "l";
}

export const MODEL_CATALOG: Record<string, ModelInfo[]> = {
  venice: [
    { id: "llama-3.3-70b", qualifiedId: "venice:llama-3.3-70b", displayName: "Llama 3.3 70B", recommended: "low-cost", tier: "m" },
    { id: "qwen3-coder-480b-a35b-instruct", qualifiedId: "venice:qwen3-coder-480b-a35b-instruct", displayName: "Qwen3 Coder 480B", recommended: "coding", tier: "l" },
    // ...
  ],
  // ...
};
```
**Confidence:** HIGH -- straightforward data structure.

### Pattern 4: Gateway Process Management
**What:** `tek gateway start` spawns a detached child process, writes PID to runtime.json
**When to use:** Starting gateway from CLI rather than raw node command
**Example:**
```typescript
import { spawn } from "node:child_process";
import { resolve } from "node:path";

function startGateway(installDir: string, foreground: boolean): void {
  const gatewayEntry = resolve(installDir, "packages/gateway/dist/index.js");

  if (foreground) {
    // Run in current process (replaces current process with gateway)
    // Or just spawn attached
    const child = spawn("node", [gatewayEntry], { stdio: "inherit" });
    child.on("exit", (code) => process.exit(code ?? 0));
    return;
  }

  // Background: detached + unref so CLI exits immediately
  const child = spawn("node", [gatewayEntry], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  console.log(`Gateway started (PID ${child.pid})`);
  // runtime.json is written by gateway itself on startup
}
```
**Confidence:** HIGH -- standard Node.js child_process pattern. The gateway already writes runtime.json on startup, so the CLI just needs to spawn it and wait briefly for the runtime.json to appear.

### Pattern 5: Uninstall Command
**What:** `tek uninstall` with destructive confirmation, removing all traces
**When to use:** Clean removal for testing or permanent uninstall
**Example:**
```typescript
// Follows existing reset.sh pattern with RESET confirmation
// But as a Commander command, not a shell script
gatewayCommand.command("uninstall")... // or top-level uninstallCommand
```
**Confidence:** HIGH -- reset.sh already demonstrates the pattern (RESET confirmation, PID stop, file removal). Uninstall extends it to also remove install dir, keychain entries, and PATH entry.

### Anti-Patterns to Avoid
- **Running gateway inline in CLI process:** Don't import and run gateway code directly in the CLI. The gateway should be a separate process so the CLI can exit. The gateway already has its own startup logic in its index.ts.
- **Hardcoding install directory:** Don't assume `~/tek`. Detect from the running CLI binary location (e.g., `process.argv[1]` resolves through the symlink to `~/tek/packages/cli/dist/index.js`, so `../../..` from that gives the install root).
- **Modifying shell profile files programmatically:** PATH removal in `tek uninstall` should print instructions rather than editing ~/.zshrc directly. Editing shell profiles is fragile and dangerous.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Custom arg parser | Commander.js (already used) | Battle-tested, handles help text, validation |
| Terminal UI prompts | Raw readline | Ink + @inkjs/ui (already used) | React model, Select/TextInput components |
| Keychain access | Custom security binary | @napi-rs/keyring (already used) | Cross-platform, handles macOS Keychain natively |
| Process management | Custom daemon code | child_process.spawn with detached | Standard Node.js pattern, no dependency needed |

**Key insight:** Every component for Phase 14 already exists in the project. This phase is about wiring existing primitives together, not introducing new technology.

## Common Pitfalls

### Pitfall 1: Gateway Start Race Condition
**What goes wrong:** `tek gateway start` spawns the process and immediately prints "started" but the gateway hasn't bound to the port yet. User runs `tek chat` and it fails because gateway isn't ready.
**Why it happens:** spawn() returns immediately; gateway needs time to start Fastify, bind port, write runtime.json.
**How to avoid:** After spawning, poll for runtime.json (with timeout). Only print success after runtime.json exists and PID is alive. Print port info from runtime.json.
**Warning signs:** "Gateway started" message but `tek chat` fails immediately after.

### Pitfall 2: Install Directory Detection
**What goes wrong:** CLI assumes `~/tek` as install directory, but user installed elsewhere.
**Why it happens:** install.sh accepts a custom INSTALL_DIR argument. The CLI binary symlink resolves to the actual install location.
**How to avoid:** Derive install directory from `process.argv[1]` or `__dirname` resolution. The bin/tek symlink points to `../packages/cli/dist/index.js`, so resolving that path backward gives the install root.
**Warning signs:** "File not found" errors when running `tek gateway start` from non-default install.

### Pitfall 3: Uninstall Leaving Orphan PATH Entry
**What goes wrong:** `tek uninstall` removes files but user's ~/.zshrc still has the PATH entry, causing "command not found" noise.
**Why it happens:** Automatically editing shell profiles is fragile and risky.
**How to avoid:** Print clear instructions telling user to remove the PATH line from their shell profile. Don't try to sed/edit the file automatically.
**Warning signs:** User gets confused error messages after uninstall when opening new terminal.

### Pitfall 4: Keychain Entry Deletion Failures
**What goes wrong:** `tek uninstall` tries to delete keychain entries but @napi-rs/keyring throws if entry doesn't exist.
**Why it happens:** Not all providers may have keys configured.
**How to avoid:** Wrap each keychainDelete() call in try/catch (already done in keychain.ts). Iterate over KNOWN_ACCOUNTS and silently skip missing entries.
**Warning signs:** Uninstall crashes partway through, leaving partial cleanup.

### Pitfall 5: Onboarding State Machine Complexity
**What goes wrong:** Adding skip logic to every step makes the state machine unwieldy and hard to test.
**Why it happens:** The current Onboarding.tsx has 10 states with linear flow. Adding branching for each step doubles complexity.
**How to avoid:** Pass existing config as a prop. For each step, check if config has a value and add a "Keep current: X" option. Don't change the state machine flow, just add an option to each step.
**Warning signs:** Onboarding tests break, steps get skipped unintentionally.

### Pitfall 6: Venice Model Catalog Staleness
**What goes wrong:** Static model catalog becomes outdated as Venice adds/removes models.
**Why it happens:** Venice's model list is dynamic; they add models regularly (confirmed by changelog).
**How to avoid:** Accept that the catalog will need periodic updates. Consider adding a `tek models refresh` command in the future. For now, document the last-verified date alongside the catalog.
**Warning signs:** Users see models in Venice dashboard that aren't in tek's catalog.

## Code Examples

### Gateway Subcommand Registration (follows existing pattern)
```typescript
// Source: pattern from packages/cli/src/commands/config.ts
import { Command } from "commander";
import { discoverGateway } from "../lib/discovery.js";

export const gatewayCommand = new Command("gateway")
  .description("Manage the Tek gateway server");

// In packages/cli/src/index.ts:
program.addCommand(gatewayCommand);
```

### Detecting Install Directory from CLI Binary
```typescript
// Source: codebase analysis - install.sh creates bin/tek -> ../packages/cli/dist/index.js
import { resolve, dirname } from "node:path";
import { realpathSync } from "node:fs";

function getInstallDir(): string {
  // process.argv[1] is the CLI entry point
  // Resolve symlinks: ~/tek/bin/tek -> ~/tek/packages/cli/dist/index.js
  const realPath = realpathSync(process.argv[1]);
  // Go up from packages/cli/dist/index.js to install root
  return resolve(dirname(realPath), "..", "..", "..");
}
```

### Spawning Gateway in Background
```typescript
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

async function startGatewayBackground(gatewayEntry: string): Promise<void> {
  const child = spawn("node", [gatewayEntry], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  // Poll for runtime.json (gateway writes it on successful startup)
  const maxWait = 10_000; // 10 seconds
  const interval = 250;
  let elapsed = 0;
  while (elapsed < maxWait) {
    await new Promise(r => setTimeout(r, interval));
    elapsed += interval;
    const info = discoverGateway();
    if (info) {
      console.log(`Gateway started on 127.0.0.1:${info.port} (PID ${info.pid})`);
      return;
    }
  }
  console.error("Gateway did not start within 10 seconds. Check logs.");
}
```

### Uninstall Keychain Cleanup
```typescript
// Source: pattern from packages/cli/src/vault/keychain.ts
import { Entry } from "@napi-rs/keyring";
import { KEYCHAIN_SERVICE } from "@tek/core";

const KNOWN_ACCOUNTS = [
  "api-key:anthropic",
  "api-key:openai",
  "api-key:venice",
  "api-key:google",
  "api-endpoint-token",
];

function removeAllKeychainEntries(): string[] {
  const removed: string[] = [];
  for (const account of KNOWN_ACCOUNTS) {
    try {
      const entry = new Entry(KEYCHAIN_SERVICE, account);
      entry.deletePassword();
      removed.push(account);
    } catch {
      // Entry doesn't exist, skip
    }
  }
  return removed;
}
```

## Venice AI Text Model Catalog

**Confidence:** MEDIUM -- Model IDs gathered from Venice docs (llms-full.txt) and GitHub documentation. Venice's catalog is dynamic; verify model IDs against the live API before finalizing.

### Verified Venice Text Models (as of 2026-02-18)

| Model ID | Size Tier | Category | Notes |
|----------|-----------|----------|-------|
| `venice-uncensored` | S | General | Dolphin Mistral 24B Venice Edition, default model |
| `mistral-31-24b` | S | General | Mistral Small 3.1 |
| `llama-3.2-3b` | XS | General | Fast, small tasks |
| `llama-3.3-70b` | M | General | Good cost/quality balance |
| `qwen3-4b` | XS | General | Small, fast |
| `qwen3-next-80b` | M | General | Mid-tier |
| `qwen3-235b-a22b-instruct-2507` | L | General | Large, instruction-tuned |
| `qwen3-235b-a22b-thinking-2507` | L | Reasoning | Large, reasoning mode |
| `qwen3-coder-480b-a35b-instruct` | L | Coding | Coding-focused |
| `qwen-2.5-qwq-32b` | M | Reasoning | QwQ reasoning model |
| `qwen-2.5-vl` | M | Vision | Vision-language model |
| `qwen-2.5-coder-32b` | M | Coding | Coding model |
| `deepseek-ai-DeepSeek-R1` | L | Reasoning | DeepSeek R1 671B |
| `google-gemma-3-27b-it` | M | General | Google Gemma 3 |
| `grok-41-fast` | L | General | xAI Grok |
| `kimi-k2-thinking` | L | Reasoning | Moonshot reasoning |
| `gemini-3-pro-preview` | L | General | Google Gemini 3 |
| `hermes-3-llama-3.1-405b` | L | General | Hermes fine-tune |
| `zai-org-glm-4.7` | L | General | GLM 4.7 flagship |
| `openai-gpt-oss-120b` | L | General | OpenAI OSS model |

**Note on minimax-m25:** The phase requirements mention `minimax-m25`. This refers to MiniMax M2.5, released 2026-02-11. It is a 230B MoE model (10B active). It was NOT found in Venice's current model catalog. The model ID on Venice may differ (e.g., `minimax-m2.5` or similar). **This needs verification against the live Venice API before implementation.**

### Recommended Models Per Provider

Based on phase requirements and research:

| Provider | Recommended Model | Reason | Tag |
|----------|-------------------|--------|-----|
| **Venice** | `llama-3.3-70b` | Good cost/quality, M tier | low-cost |
| **Venice** | `qwen3-coder-480b-a35b-instruct` | Best coding model on Venice | coding |
| **Venice** | `venice-uncensored` | Default Venice model, uncensored | general |
| **Anthropic** | `claude-sonnet-4-5-20250929` | Best balance of cost/capability | general |
| **Anthropic** | `claude-haiku-4-5-20250929` | Fast, cheap | low-cost |
| **Anthropic** | `claude-opus-4-5-20250929` | Highest capability | premium |
| **OpenAI** | `gpt-4o` | Best general OpenAI model | general |
| **OpenAI** | `gpt-4o-mini` | Fast, cheap | low-cost |
| **OpenAI** | `o3-mini` | Good reasoning | reasoning |
| **Google** | `gemini-2.5-pro-preview-05-06` | Best Google model | general |
| **Google** | `gemini-2.0-flash` | Fast, cheap | low-cost |
| **Ollama** | (user's local models) | Cannot pre-recommend | local |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node ~/tek/packages/gateway/dist/index.js` | `tek gateway start` | Phase 14 (this phase) | Hides internal paths from user |
| Linear `tek init` wizard (must complete all steps) | Skippable steps showing current values | Phase 14 (this phase) | Re-running init is painless |
| 3 Venice models in catalog | Full Venice text model catalog | Phase 14 (this phase) | Users can select any Venice model |
| Manual uninstall (4 steps documented in INSTALL.md) | `tek uninstall` command | Phase 14 (this phase) | One-command clean removal |
| Venice `minimax-01` in Onboarding | Updated model IDs (minimax-01 is likely deprecated) | Phase 14 (this phase) | Current model references |

**Deprecated/outdated in current code:**
- `PROVIDER_MODELS` in Onboarding.tsx lists `minimax-01` for Venice, which is likely deprecated. Should be replaced with current Venice model IDs.
- `dolphin-2.9.2-qwen2-72b` in Onboarding.tsx is not found in current Venice model list. Likely deprecated.
- `minimax-m1-80k` in pricing.ts may be outdated. Needs verification.

## Open Questions

1. **MiniMax M2.5 on Venice**
   - What we know: MiniMax M2.5 was released 2026-02-11 as open-source. Phase requirements mention `minimax-m25` as a Venice recommendation.
   - What's unclear: Whether Venice has added M2.5 to their API yet, and what the exact model ID would be. It was not found in the Venice docs crawled.
   - Recommendation: Check the live Venice API (`GET /models?type=text`) during implementation. If not available, use the closest alternative or note as pending.

2. **Daemon Mode (launchd) for Gateway**
   - What we know: STATE.md lists "Daemon mode for gateway" as a pending todo. The uninstall requirements mention "launchd service" removal.
   - What's unclear: Whether Phase 14 should implement launchd daemon mode or just the `tek gateway start` foreground/background spawn.
   - Recommendation: Phase 14 should implement `tek gateway start` as a background-spawned process (detached child_process), NOT a full launchd service. Launchd integration is a separate future feature. The `tek uninstall` command should handle launchd cleanup IF a plist exists, but not create one.

3. **Install Directory Discovery**
   - What we know: install.sh accepts a custom INSTALL_DIR (default ~/tek). The CLI binary is symlinked from `$INSTALL_DIR/bin/tek`.
   - What's unclear: Whether to store INSTALL_DIR in config.json or derive it at runtime.
   - Recommendation: Derive at runtime from `process.argv[1]` -> resolve symlink -> navigate up. This is more robust than storing a path that could become stale. Fall back to `~/tek` if resolution fails.

4. **Update Scripts After Phase 14**
   - What we know: update.sh currently ends with `echo "Start with: node $INSTALL_DIR/packages/gateway/dist/index.js"`. This should change to `tek gateway start`.
   - What's unclear: Whether install.sh should also auto-add PATH or if that stays manual.
   - Recommendation: Keep PATH setup manual (print instructions). Update the "start gateway" message in install.sh and update.sh to reference `tek gateway start`.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/cli/src/index.ts`, `commands/init.ts`, `commands/config.ts`, `commands/keys.ts` -- CLI command patterns
- Codebase analysis: `packages/cli/src/components/Onboarding.tsx` -- current wizard state machine and model selection
- Codebase analysis: `packages/gateway/src/index.ts`, `key-server/server.ts` -- gateway startup and runtime.json
- Codebase analysis: `packages/cli/src/lib/discovery.ts` -- gateway PID discovery
- Codebase analysis: `packages/cli/src/vault/keychain.ts` -- keychain access patterns
- Codebase analysis: `packages/core/src/config/constants.ts` -- centralized constants
- Codebase analysis: `scripts/install.sh`, `scripts/update.sh`, `scripts/reset.sh` -- install/update lifecycle
- Codebase analysis: `INSTALL.md` -- current uninstall documentation (manual 4-step process)
- Codebase analysis: `packages/gateway/src/usage/pricing.ts` -- current model pricing catalog
- Codebase analysis: `packages/gateway/src/llm/registry.ts` -- provider registration

### Secondary (MEDIUM confidence)
- Venice AI docs (llms-full.txt): Full text model catalog with tier classifications -- https://docs.venice.ai/llms-full.txt
- Venice AI docs (deprecations): qwen3-235b model split -- https://docs.venice.ai/overview/deprecations
- Venice AI blog: Model paradigm with curated tier system -- https://venice.ai/blog/venice-new-model-paradigm
- GitHub SyntaxError4Life/Venice.ai-API: Venice model IDs list -- https://github.com/SyntaxError4Life/Venice.ai-API
- Venice changelog (Dec 2025 - Jan 2026): Recent model additions -- https://featurebase.venice.ai/changelog/veniceai-change-log-december-25th-2025-january-27th-2026

### Tertiary (LOW confidence)
- MiniMax M2.5 availability on Venice: Not confirmed in Venice docs. Phase requirement mentions it but needs live API verification -- https://www.minimax.io/news/minimax-m25

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in project, no new dependencies
- Architecture: HIGH -- Patterns exactly match existing codebase conventions (Commander subcommands, Ink components, PID files)
- Model catalog: MEDIUM -- Venice model IDs gathered from docs but catalog is dynamic; specific IDs need live verification
- Pitfalls: HIGH -- Based on direct codebase analysis (race conditions, path detection, keychain error handling)

**Research date:** 2026-02-18
**Valid until:** 2026-03-04 (Venice model catalog may change; core patterns are stable)
