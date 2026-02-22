# Phase 30: Ollama Auto-Discovery and Remote Setup - Research

**Researched:** 2026-02-21
**Domain:** Ollama model auto-discovery, local/remote endpoint management, CLI setup integration
**Confidence:** HIGH

## Summary

Phase 30 enhances the existing Ollama provider integration to automatically detect locally running Ollama instances and their available models, list those models during setup just like other providers, and support manual IP:port + model entry for remote Ollama instances on the LAN. The existing codebase already has Ollama registered as a provider via `@ai-sdk/openai-compatible` with configurable endpoints (`ollamaEndpoints` in config schema), but the `MODEL_CATALOG` for Ollama is an empty array -- models must be known in advance. The gap is: no runtime discovery.

Ollama exposes two relevant discovery APIs: the native `GET /api/tags` endpoint (returns model name, size, family, parameter count, quantization) and the OpenAI-compatible `GET /v1/models` endpoint (returns model IDs in OpenAI format). Since Tek already uses the `/v1` base URL for `createOpenAICompatible`, using `GET /v1/models` for discovery is the simpler path -- a single `fetch()` call to the same base URL already configured. The native `/api/tags` endpoint provides richer metadata (parameter size, quantization level, family) that would make for better display in the setup UI.

For remote Ollama instances, the remote server must be configured with `OLLAMA_HOST=0.0.0.0` to accept non-localhost connections. Tek should probe the endpoint with a health check before registering it. The existing `OllamaEndpointSchema` in the config already supports `{ name: string; url: string }` entries, so the config layer is ready. The CLI setup flow needs a new step for entering remote Ollama endpoints.

**Primary recommendation:** Use `GET /api/tags` on `http://localhost:11434` for local model discovery (richer metadata), fall back to `GET /v1/models` for remote endpoints (simpler, guaranteed compatible). Populate the `MODEL_CATALOG.ollama` array dynamically at setup time by probing the Ollama server. Add a "remote Ollama" step to the onboarding flow. Create a shared `ollama-client.ts` utility module for discovery/health-check operations.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@ai-sdk/openai-compatible` | ^2 (already installed) | Ollama provider for streaming/chat | Already used for Ollama; handles chat, streaming, tool calls |
| `ai` | ^6 (already installed) | Provider registry | `createProviderRegistry()` already manages Ollama providers |
| `zod` | ^4 (already installed) | Schema validation for config | Already validates `OllamaEndpointSchema` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `fetch` | built-in | Ollama API discovery calls | Probe `/api/tags` and `/v1/models` for model listing |
| `ink` + `@inkjs/ui` | (already installed) | CLI setup UI components | Render model selection, remote endpoint input in onboarding |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch` to Ollama API | `ollama-ai-provider-v2` community package | Community package adds another dependency and abstraction layer; raw fetch to `/api/tags` is ~15 lines and gives full control over response handling |
| `GET /api/tags` for discovery | `GET /v1/models` (OpenAI-compatible) | `/v1/models` returns less metadata (no parameter_size, no quantization_level, no family); `/api/tags` returns everything needed for display |
| Polling-based auto-detect | mDNS/Bonjour discovery | mDNS adds significant complexity and a new dependency; polling localhost:11434 on startup is simple and reliable |

**Installation:**
```bash
# No new packages needed. All dependencies are already installed.
```

## Architecture Patterns

### Recommended Project Structure
```
packages/
├── core/src/
│   └── ollama/
│       └── client.ts          # NEW: Shared Ollama discovery client (listModels, healthCheck)
├── cli/src/
│   ├── lib/
│   │   └── models.ts          # MODIFY: Dynamic MODEL_CATALOG population for Ollama
│   └── components/
│       └── Onboarding.tsx     # MODIFY: Add Ollama model listing + remote endpoint steps
├── gateway/src/
│   └── llm/
│       └── registry.ts        # MODIFY: Use discovered models for Ollama, dynamic endpoint registration
```

### Pattern 1: Ollama Discovery Client
**What:** A shared module that probes Ollama servers for available models and health status.
**When to use:** During setup/onboarding, when building model catalog, and when validating remote endpoints.
**Example:**
```typescript
// packages/core/src/ollama/client.ts
// Source: Ollama API docs (https://docs.ollama.com/api/tags)

export interface OllamaModel {
  name: string;            // e.g. "llama3:latest"
  model: string;           // e.g. "llama3:latest"
  modified_at: string;     // ISO 8601 timestamp
  size: number;            // bytes on disk
  digest: string;          // sha256
  details: {
    format: string;            // "gguf"
    family: string;            // "llama"
    families: string[];
    parameter_size: string;    // "8B"
    quantization_level: string; // "Q4_K_M"
  };
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

/**
 * Probe an Ollama server for available models.
 * Uses the native /api/tags endpoint for richer metadata.
 * Falls back to /v1/models (OpenAI-compatible) if /api/tags fails.
 */
export async function listOllamaModels(
  baseUrl = "http://localhost:11434",
  timeoutMs = 3000,
): Promise<OllamaModel[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Try native API first (richer metadata)
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal,
    });
    if (res.ok) {
      const data: OllamaTagsResponse = await res.json();
      return data.models;
    }
  } catch {
    // Fall through to OpenAI-compat endpoint
  } finally {
    clearTimeout(timer);
  }

  // Fallback: OpenAI-compatible endpoint
  const controller2 = new AbortController();
  const timer2 = setTimeout(() => controller2.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      signal: controller2.signal,
    });
    if (res.ok) {
      const data = await res.json();
      // Convert OpenAI format to OllamaModel shape
      return (data.data ?? []).map((m: { id: string }) => ({
        name: m.id,
        model: m.id,
        modified_at: "",
        size: 0,
        digest: "",
        details: {
          format: "unknown",
          family: "unknown",
          families: [],
          parameter_size: "unknown",
          quantization_level: "unknown",
        },
      }));
    }
  } catch {
    // Ollama not reachable
  } finally {
    clearTimeout(timer2);
  }

  return [];
}

/**
 * Check if an Ollama server is reachable.
 */
export async function isOllamaReachable(
  baseUrl = "http://localhost:11434",
  timeoutMs = 2000,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
```

### Pattern 2: Dynamic Model Catalog Population
**What:** Populate `MODEL_CATALOG.ollama` at setup time by probing the local Ollama server.
**When to use:** During `tek init` and `tek onboard` when building model selection options.
**Example:**
```typescript
// packages/cli/src/lib/models.ts — extension

import { listOllamaModels, type OllamaModel } from "@tek/core/ollama/client";

/**
 * Build model options for Ollama by probing the server.
 * Returns empty array if Ollama is not running.
 */
export async function buildOllamaModelOptions(
  baseUrl = "http://localhost:11434",
): Promise<Array<{ label: string; value: string }>> {
  const models = await listOllamaModels(baseUrl);
  return models.map((m) => {
    const displayName = formatOllamaModelName(m);
    return {
      label: displayName,
      value: `ollama:${m.name}`,
    };
  });
}

function formatOllamaModelName(m: OllamaModel): string {
  const parts = [m.name];
  if (m.details?.parameter_size && m.details.parameter_size !== "unknown") {
    parts.push(`(${m.details.parameter_size}`);
    if (m.details.quantization_level && m.details.quantization_level !== "unknown") {
      parts.push(`${m.details.quantization_level})`);
    } else {
      parts.push(")");
    }
  }
  const sizeGB = m.size > 0 ? `${(m.size / 1e9).toFixed(1)}GB` : "";
  if (sizeGB) parts.push(`[${sizeGB}]`);
  return parts.join(" ");
}
```

### Pattern 3: Onboarding Flow with Ollama Auto-Detect
**What:** During setup, automatically detect if Ollama is running locally and show discovered models alongside other providers. Add a step for remote Ollama endpoint entry.
**When to use:** During `tek init` and `tek onboard` flows.
**Example flow:**
```
Step 1: Security mode selection (existing)
Step 2: API keys for cloud providers (existing)
Step 3: (NEW) Ollama auto-detect
   → Probe localhost:11434
   → If reachable: "Found Ollama with N models: [list]. Include in setup?"
   → If not reachable: "Ollama not detected on localhost. Skip or enter custom endpoint?"
Step 4: (NEW) Remote Ollama endpoints
   → "Add a remote Ollama instance? (e.g., 192.168.1.100:11434)"
   → Probe entered endpoint, show models if reachable
   → Save to ollamaEndpoints config
Step 5: Default model selection (existing, now includes Ollama models)
Step 6: Aliases, Telegram, etc. (existing)
```

### Pattern 4: Remote Endpoint Validation
**What:** Before saving a remote Ollama endpoint, validate connectivity and list available models.
**When to use:** When user enters an IP:port for a remote Ollama instance.
**Example:**
```typescript
async function validateRemoteOllama(
  host: string,
  port = 11434,
): Promise<{ reachable: boolean; models: OllamaModel[] }> {
  const baseUrl = `http://${host}:${port}`;
  const models = await listOllamaModels(baseUrl);
  return {
    reachable: models.length > 0 || await isOllamaReachable(baseUrl),
    models,
  };
}
```

### Anti-Patterns to Avoid
- **Blocking startup on Ollama discovery:** Discovery should be async and non-blocking. If Ollama is not running, the system should work fine with other providers. Never make Ollama availability a requirement.
- **Caching discovered models permanently:** Ollama models change frequently (users pull/remove models). Discovery results should be used for the current session/setup but not hardcoded into config. The `ollamaEndpoints` config stores the server URL, not the model list.
- **Using community Ollama AI SDK packages:** The project already uses `@ai-sdk/openai-compatible` for Ollama. Adding `ollama-ai-provider-v2` or `ai-sdk-ollama` would create a dependency conflict and an inconsistent pattern. Stick with `createOpenAICompatible` + raw `fetch` for discovery.
- **Hardcoding model IDs for Ollama:** Unlike cloud providers with stable model catalogs, Ollama models are user-installed and vary per machine. Never assume specific models are available.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model discovery | Custom Ollama SDK wrapper | Raw `fetch` to `/api/tags` | Single endpoint, well-documented JSON response, ~15 lines of code |
| OpenAI-compat streaming | Custom streaming client | `@ai-sdk/openai-compatible` (already used) | Already handles streaming, tool calls, error handling for Ollama |
| Provider registry | Custom model routing map | `createProviderRegistry()` from `ai` | Already manages all providers including multi-Ollama endpoints |
| Config schema | Custom JSON parser | Zod `OllamaEndpointSchema` (already exists) | Already validates `{ name: string; url: string }` entries |
| CLI interactive UI | Raw readline prompts | Ink `Select`, `TextInput`, `ConfirmInput` (already used) | Consistent with existing onboarding flow |

**Key insight:** The existing infrastructure handles 90% of this phase. The core work is: (1) a ~50-line discovery client, (2) a new onboarding step, and (3) wiring discovered models into the existing model selection flow.

## Common Pitfalls

### Pitfall 1: Ollama Not Running During Setup
**What goes wrong:** User runs `tek init`, Ollama isn't started yet. Setup shows "no models found" and user skips Ollama. Later they start Ollama but have no models configured.
**Why it happens:** Ollama is a separate process that may not be running at setup time.
**How to avoid:** Make model discovery lazy -- don't require Ollama at setup. Store endpoint URLs in config, discover models at chat-time. Show clear messaging: "Ollama not detected -- you can start it later and models will be available automatically."
**Warning signs:** Empty Ollama model list during setup on machines that have Ollama installed.

### Pitfall 2: Ollama Binds to 127.0.0.1 by Default
**What goes wrong:** User enters a remote Ollama IP:port, but the remote server rejects connections.
**Why it happens:** Ollama's default `OLLAMA_HOST` is `127.0.0.1`, rejecting non-local connections.
**How to avoid:** When remote endpoint validation fails, show a specific help message: "Could not reach Ollama at {host}:{port}. Ensure the remote server has OLLAMA_HOST=0.0.0.0 configured."
**Warning signs:** Connection refused or timeout errors for remote endpoints that work locally on the remote machine.

### Pitfall 3: Model Name Format Differences
**What goes wrong:** `/api/tags` returns `llama3:latest` but `createOpenAICompatible` expects just `llama3` as the model ID when sending to `/v1/chat/completions`.
**Why it happens:** Ollama's native API includes the tag (`:latest`, `:8b-q4_K_M`) while the OpenAI-compatible endpoint accepts both with and without tags.
**How to avoid:** Use the `name` field from `/api/tags` as-is (e.g., `llama3:latest`). The OpenAI-compatible endpoint handles both formats. Don't strip tags -- users may have multiple variants of the same base model (e.g., `llama3:8b` vs `llama3:70b`).
**Warning signs:** Model not found errors when using short names that are ambiguous.

### Pitfall 4: Stale Model Lists
**What goes wrong:** User selects a model during setup, later removes it from Ollama. Chat attempts fail with model not found.
**Why it happens:** Model discovery happened at setup time, but models can be added/removed at any time.
**How to avoid:** Don't store discovered model lists in config. Store only the endpoint URL. At chat time, the AI SDK will send the model ID to Ollama, and Ollama itself will return an error if the model isn't available. Handle this error gracefully in the agent loop.
**Warning signs:** "Model not found" errors during chat for previously-working models.

### Pitfall 5: Network Timeout During Discovery
**What goes wrong:** Discovery hangs for 30+ seconds when Ollama is unreachable, making setup feel frozen.
**Why it happens:** Default `fetch` has no timeout, or timeout is too long.
**How to avoid:** Use `AbortController` with a 2-3 second timeout for discovery probes. Show a spinner during probing. Fail fast and gracefully.
**Warning signs:** Setup wizard appearing to freeze during the Ollama detection step.

### Pitfall 6: Multiple Ollama Endpoints with Same Models
**What goes wrong:** User has localhost Ollama and a remote GPU server both with `llama3`. They select `ollama:llama3` but it routes to the wrong server.
**Why it happens:** The first Ollama endpoint is registered as `ollama` and subsequent ones as `ollama-{name}`. If both have `llama3`, the bare `ollama:llama3` always goes to the first.
**How to avoid:** When multiple Ollama endpoints exist, qualify model selections with the endpoint name: `ollama-gpu:llama3` vs `ollama:llama3`. Make this clear in the setup UI.
**Warning signs:** Wrong performance characteristics (fast model seems slow = routing to wrong server).

## Code Examples

Verified patterns from the existing codebase and Ollama API docs:

### Ollama /api/tags Response Structure
```typescript
// Source: https://docs.ollama.com/api/tags
// GET http://localhost:11434/api/tags
{
  "models": [
    {
      "name": "llama3:latest",
      "model": "llama3:latest",
      "modified_at": "2025-10-03T23:34:03.409490317-07:00",
      "size": 3338801804,
      "digest": "a2af6cc3eb7fa8be8504abaf9b04e88f17a...",
      "details": {
        "format": "gguf",
        "family": "llama",
        "families": ["llama"],
        "parameter_size": "8B",
        "quantization_level": "Q4_K_M"
      }
    }
  ]
}
```

### Ollama /v1/models Response Structure (OpenAI-compatible)
```typescript
// Source: https://docs.ollama.com/api/openai-compatibility
// GET http://localhost:11434/v1/models
{
  "object": "list",
  "data": [
    {
      "id": "llama3:latest",
      "object": "model",
      "created": 1696384443,
      "owned_by": "library"
    }
  ]
}
```

### Integrating Discovery into Existing buildModelOptions()
```typescript
// Source: existing packages/cli/src/lib/models.ts pattern
// Currently MODEL_CATALOG.ollama is an empty array.
// The fix: make buildModelOptions async for Ollama, or populate
// the catalog before calling it.

export async function getOllamaModelsForCatalog(
  endpoints?: Array<{ name: string; url: string }>,
): Promise<ModelInfo[]> {
  const allModels: ModelInfo[] = [];
  const targets = endpoints ?? [
    { name: "localhost", url: "http://localhost:11434" },
  ];

  for (const ep of targets) {
    const models = await listOllamaModels(ep.url);
    for (const m of models) {
      allModels.push({
        id: m.name,
        displayName: `${m.name} (${m.details.parameter_size}, ${m.details.quantization_level})`,
        tier: categorizeOllamaModel(m),
      });
    }
  }

  return allModels;
}

function categorizeOllamaModel(m: OllamaModel): "xs" | "s" | "m" | "l" {
  const paramStr = m.details?.parameter_size ?? "";
  const paramNum = parseFloat(paramStr);
  if (paramNum <= 3) return "xs";
  if (paramNum <= 13) return "s";
  if (paramNum <= 40) return "m";
  return "l";
}
```

### Extending Onboarding with Ollama Detection
```typescript
// Source: existing Onboarding.tsx pattern + new Ollama step
// New step type to add to OnboardingStep union:
// | "ollama-detect"
// | "ollama-remote-ask"
// | "ollama-remote-input"

// Ollama detect step (auto-runs, shows results):
if (step === "ollama-detect") {
  // Use useEffect to probe Ollama on mount
  // Show: "Detecting Ollama..." spinner
  // Then: "Found N models on localhost" or "Ollama not detected"
  // Options: "Use these models" / "Add remote Ollama" / "Skip"
}

if (step === "ollama-remote-ask") {
  // "Add a remote Ollama instance?"
  // ConfirmInput -> ollama-remote-input / skip
}

if (step === "ollama-remote-input") {
  // TextInput for IP:port (e.g., "192.168.1.100:11434")
  // Validate connectivity on submit
  // If reachable: show discovered models, save to ollamaEndpoints
  // If not: show error with OLLAMA_HOST=0.0.0.0 hint
}
```

### Registering Multiple Ollama Endpoints
```typescript
// Source: existing registry.ts (already supports this pattern)
// The existing code already handles multiple Ollama endpoints:
const endpoints = keys?.ollamaEndpoints ?? [
  { name: "localhost", url: "http://localhost:11434/v1" },
];

for (let i = 0; i < endpoints.length; i++) {
  const ep = endpoints[i];
  const providerName = i === 0 ? "ollama" : `ollama-${ep.name}`;
  providers[providerName] = createOpenAICompatible({
    name: providerName,
    baseURL: ep.url,
  });
}
// This is already implemented. Phase 30 just needs to populate
// ollamaEndpoints from the setup UI.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Empty `MODEL_CATALOG.ollama = []` | Dynamic discovery via `/api/tags` | Phase 30 | Ollama models appear in model selection during setup |
| Hardcoded `localhost:11434` only | Configurable endpoints via `ollamaEndpoints` config | Phase 12 (already done) | Multiple Ollama servers supported |
| Manual model ID entry | Auto-detected model list from running Ollama | Phase 30 | Zero-config Ollama experience for local instances |
| No remote Ollama UI | Setup step for IP:port entry with validation | Phase 30 | LAN Ollama servers discoverable from CLI |

**Deprecated/outdated:**
- Ollama's API docs are moving from `github.com/ollama/ollama/blob/main/docs/api.md` to `docs.ollama.com/api` -- use the new URL for reference.
- The `/api/tags` response now includes `remote_model` and `remote_host` fields for Ollama remote model support (not the same as Tek's remote endpoint -- this is Ollama's own cloud model feature).

## Open Questions

1. **Should discovery happen at setup time or chat time?**
   - What we know: Setup-time discovery is simpler to implement and gives the user a model selection experience. Chat-time discovery would auto-detect models every session.
   - What's unclear: Whether users expect models to "just appear" when they pull a new one, or if running setup again is acceptable.
   - Recommendation: Do both. Discovery at setup time for model selection and default model choice. At chat time, accept any `ollama:*` model ID and let Ollama itself validate -- don't restrict to discovered models. This gives the best of both worlds.

2. **Should Tek auto-start Ollama if installed but not running?**
   - What we know: Ollama can be started with `ollama serve` or the macOS app. On macOS, it often runs as a background app.
   - What's unclear: Whether auto-starting is expected behavior or invasive.
   - Recommendation: Do NOT auto-start. Just detect and inform. Show: "Ollama is installed but not running. Start it with 'ollama serve' to use local models."

3. **How to handle the `/v1` suffix in endpoint URLs?**
   - What we know: `createOpenAICompatible` expects a `baseURL` ending in `/v1` (e.g., `http://localhost:11434/v1`). But the native Ollama API (`/api/tags`) uses the base URL without `/v1`.
   - What's unclear: Whether to store `http://localhost:11434` or `http://localhost:11434/v1` in config.
   - Recommendation: Store the base URL without `/v1` in `ollamaEndpoints` (e.g., `http://localhost:11434`). Append `/v1` when passing to `createOpenAICompatible`, and use the base URL directly for `/api/tags` discovery calls. This avoids user confusion.

4. **Should discovered models show in the /models slash command during chat?**
   - What we know: There is a model selection UI in setup. During chat, `/model` slash command lets users switch models.
   - What's unclear: Whether the `/model` command should re-probe Ollama for current models.
   - Recommendation: Yes, but this is likely Phase 34 (CLI UX Overhaul) scope. For Phase 30, focus on setup-time discovery and ensure any `ollama:*` model ID works at chat time.

## Sources

### Primary (HIGH confidence)
- [Ollama API Tags](https://docs.ollama.com/api/tags) - `GET /api/tags` response format with model metadata fields
- [Ollama OpenAI Compatibility](https://docs.ollama.com/api/openai-compatibility) - `GET /v1/models` endpoint, supported features, authentication behavior
- Existing codebase: `packages/gateway/src/llm/registry.ts` - Current Ollama provider registration with multi-endpoint support
- Existing codebase: `packages/core/src/config/schema.ts` - `OllamaEndpointSchema` already defined with `{ name, url }`
- Existing codebase: `packages/cli/src/lib/models.ts` - `MODEL_CATALOG.ollama = []` (empty, needs dynamic population)
- Existing codebase: `packages/cli/src/components/Onboarding.tsx` - Current setup flow structure and step pattern

### Secondary (MEDIUM confidence)
- [Ollama FAQ - Remote Access](https://docs.ollama.com/faq) - `OLLAMA_HOST=0.0.0.0` for remote access configuration
- [AI SDK OpenAI-Compatible Provider](https://ai-sdk.dev/providers/openai-compatible-providers) - `createOpenAICompatible` API, base URL configuration
- [OpenCode Ollama Issue #6231](https://github.com/sst/opencode/issues/6231) - Auto-discovery patterns, `/v1/models` endpoint for OpenAI-compatible discovery
- [Ollama GitHub Repository](https://github.com/ollama/ollama) - API documentation, release notes

### Tertiary (LOW confidence)
- Community patterns from OpenClaw and OpenCode for Ollama integration -- useful for UX patterns but implementations differ significantly from Tek's architecture. Verified concepts only, not specific code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new packages needed; all existing dependencies sufficient
- Architecture: HIGH - Existing `ollamaEndpoints` config, registry pattern, and onboarding flow provide clear extension points
- Pitfalls: HIGH - Well-documented Ollama configuration issues (OLLAMA_HOST binding, model name formats) with clear mitigations
- Discovery API: HIGH - Ollama `/api/tags` and `/v1/models` endpoints are stable, well-documented, and verified against official docs

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days -- Ollama API is stable, config patterns are established)
