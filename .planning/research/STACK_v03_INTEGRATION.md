# v0.3 Stack Integration Guide

**For:** REQUIREMENTS.md scoping phase
**Date:** 2026-02-22
**Status:** Ready for implementation

---

## Libraries to Add (Exact Versions)

### Frontend Package (`apps/desktop/package.json`)

```json
{
  "dependencies": {
    "@tanstack/react-form": "^1.4.0",
    "@tanstack/react-query": "^5.56.0",
    "zustand": "^5.0.5"
  }
}
```

**Context:**
- TanStack Form/Query v1.x and v5.x released Jan-Feb 2026, verified with React 19.1.0
- Zustand 5.0.5 already in package.json, no change
- No breaking changes expected in 2026

**Installation command:**
```bash
cd apps/desktop && npm install @tanstack/react-form@^1.4.0 @tanstack/react-query@^5.56.0
```

### Backend Package (`packages/gateway/package.json`)

```json
{
  "dependencies": {
    "bullmq": "^5.7.0",
    "redis": "^4.7.0"
  },
  "devDependencies": {
    "bull-board": "^7.3.0"
  }
}
```

**Context:**
- BullMQ v5.7.0 stable, Feb 2026 release
- Redis v4.7.0 client library (note: requires Redis server 7.0+, not npm package version)
- bull-board optional (web UI for monitoring jobs; install only if team wants dashboard)

**Installation command:**
```bash
cd packages/gateway && npm install bullmq@^5.7.0 redis@^4.7.0
cd packages/gateway && npm install -D bull-board@^7.3.0  # Optional
```

### No Changes Required

- `@tauri-apps/api` — already 2.5.0, no upgrade
- `@tauri-apps/plugin-process` — already 2.2.0, no upgrade
- `@tauri-apps/plugin-shell` — already 2.2.0, no upgrade
- `better-sqlite3` — already 11.0.0, no upgrade
- `drizzle-orm` — already 0.45.0, no upgrade
- `react` — already 19.1.0, no change
- `zod` — already 4.3.6, use for BullMQ job schema validation

---

## Integration Points & Configuration

### 1. TanStack Form Setup (React Component Layer)

**File:** `apps/desktop/src/components/ProviderForm.tsx`

```typescript
import { useForm } from '@tanstack/react-form'
import { zodValidator } from '@tanstack/zod-form-adapter'
import { z } from 'zod'
import { invoke } from '@tauri-apps/api/core'

// Schema for provider config
const providerSchema = z.object({
  name: z.string().min(1, 'Provider name required'),
  apiKey: z.string().min(1, 'API key required'),
  modelName: z.string().min(1, 'Model name required'),
})

export function ProviderForm() {
  const form = useForm({
    defaultValues: {
      name: '',
      apiKey: '',
      modelName: 'gpt-4',
    },
    validatorAdapter: zodValidator(),
    onSubmit: async (values) => {
      // Async validation: test API key before saving
      const valid = await invoke('validateProvider', values)
      if (!valid) {
        throw new Error('Invalid API key for provider')
      }
      // Save to gateway
      await invoke('saveProvider', values)
    },
  })

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      form.handleSubmit()
    }}>
      <form.Field name="name">
        {(field) => (
          <input
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder="Provider name"
          />
        )}
      </form.Field>
      {/* Similar for apiKey, modelName */}
      <button type="submit">Save Provider</button>
    </form>
  )
}
```

**Note:** TanStack Form requires `zodValidator` adapter. Install:
```bash
npm install @tanstack/zod-form-adapter
```

### 2. TanStack Query Setup (Data Fetching Layer)

**File:** `apps/desktop/src/lib/queryClient.ts`

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 1000, // Cache for 5 seconds
      gcTime: 30 * 1000, // Remove from memory after 30s
      retry: 2, // Retry failed queries twice
    },
  },
})
```

**File:** `apps/desktop/src/App.tsx`

```typescript
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your routes/components */}
    </QueryClientProvider>
  )
}
```

**Hook for fetching provider list:**

```typescript
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: () => invoke('getProviders'),
  })
}
```

### 3. Zustand Store Setup (Client State Layer)

**File:** `apps/desktop/src/stores/uiStore.ts`

```typescript
import { create } from 'zustand'

interface UIState {
  // Onboarding
  onboardingStage: 'detecting' | 'firstRun' | 'welcome' | 'providers' | 'complete'
  setOnboardingStage: (stage: UIState['onboardingStage']) => void

  // Monitor panel
  monitorVisible: boolean
  setMonitorVisible: (visible: boolean) => void
  monitorLogs: Array<{ timestamp: string; message: string }>
  addLog: (message: string) => void
  clearLogs: () => void

  // Sidebar
  activeSidebar: 'chat' | 'gateway' | 'agents'
  setActiveSidebar: (active: UIState['activeSidebar']) => void
}

export const useUIStore = create<UIState>((set) => ({
  onboardingStage: 'detecting',
  setOnboardingStage: (stage) => set({ onboardingStage: stage }),

  monitorVisible: false,
  setMonitorVisible: (visible) => set({ monitorVisible: visible }),
  monitorLogs: [],
  addLog: (message) => set((state) => ({
    monitorLogs: [...state.monitorLogs, {
      timestamp: new Date().toISOString(),
      message,
    }],
  })),
  clearLogs: () => set({ monitorLogs: [] }),

  activeSidebar: 'chat',
  setActiveSidebar: (active) => set({ activeSidebar: active }),
}))
```

### 4. Tauri Events for Real-Time Logs

**File:** `apps/desktop/src/hooks/useMonitorLogs.ts`

```typescript
import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useUIStore } from '../stores/uiStore'

export function useMonitorLogs() {
  const addLog = useUIStore((state) => state.addLog)

  useEffect(() => {
    let unlisten: (() => void) | undefined

    listen('monitor:log', (event) => {
      const { line, level } = event.payload as { line: string; level: string }
      addLog(`[${level}] ${line}`)
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      if (unlisten) unlisten()
    }
  }, [addLog])
}
```

**Rust side (Tauri main):**

```rust
// src-tauri/src/main.rs
use tauri::State;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};

#[tauri::command]
async fn run_tool(
  tool: String,
  args: serde_json::Value,
  app_handle: tauri::AppHandle,
) -> Result<String, String> {
  let mut cmd = Command::new("node")
    .arg("scripts/run-tool.js")
    .arg(tool)
    .arg(args.to_string())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|e| e.to_string())?;

  if let Some(stdout) = cmd.stdout.take() {
    let reader = BufReader::new(stdout);
    for line in reader.lines() {
      if let Ok(line) = line {
        app_handle.emit("monitor:log", ToolLog {
          line,
          level: "info".to_string(),
        }).ok();
      }
    }
  }

  Ok("Tool executed".to_string())
}
```

### 5. BullMQ Queue Setup (Backend Job Processing)

**File:** `packages/gateway/src/queue.ts`

```typescript
import { Queue, Worker } from 'bullmq'
import Redis from 'redis'

// Create Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
})

// Create job queue
export const toolQueue = new Queue('tools', { connection: redis })

// Define job schema with Zod
import { z } from 'zod'

export const ToolJobSchema = z.object({
  toolName: z.string(),
  args: z.record(z.any()),
  requestedBy: z.string().optional(),
})

export type ToolJob = z.infer<typeof ToolJobSchema>

// Enqueue job from API endpoint
export async function queueToolExecution(job: ToolJob) {
  const queued = await toolQueue.add('execute', job, {
    priority: 1,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  })
  return queued.id
}

// Worker process
export function startWorker() {
  const worker = new Worker('tools', async (job) => {
    console.log(`Processing tool: ${job.data.toolName}`)
    // Execute tool logic here
    const result = await executeTool(job.data)
    return result
  }, { connection: redis })

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`)
    // Emit Tauri event or update UI
  })

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed: ${err.message}`)
  })

  return worker
}
```

**Fastify endpoint:**

```typescript
import { FastifyInstance } from 'fastify'
import { queueToolExecution } from './queue'

export async function toolRoutes(app: FastifyInstance) {
  app.post<{ Body: ToolJob }>('/tool/execute', async (req, reply) => {
    const jobId = await queueToolExecution(req.body)
    return { jobId, status: 'queued' }
  })

  app.get('/job/:id/status', async (req, reply) => {
    const job = await toolQueue.getJob((req.params as any).id)
    return {
      id: job?.id,
      status: job?.getState(),
      progress: job?.progress,
    }
  })

  app.get('/job/:id/result', async (req, reply) => {
    const job = await toolQueue.getJob((req.params as any).id)
    return { result: job?.returnvalue }
  })
}
```

### 6. Context Database Export

**File:** `packages/gateway/src/commands/exportContext.ts`

```typescript
import Database from 'better-sqlite3'
import { gzip } from 'node:zlib'
import { promisify } from 'node:util'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const gzipAsync = promisify(gzip)

export async function exportContextDump() {
  const dbPath = join(homedir(), '.config/tek/memory.db')
  const db = new Database(dbPath, { readonly: true })

  // Query memory data
  const memories = db.prepare('SELECT * FROM memory_files').all()
  const agents = db.prepare('SELECT * FROM agents').all()

  const context = {
    timestamp: new Date().toISOString(),
    memories,
    agents,
  }

  db.close()

  // Compress
  const json = JSON.stringify(context)
  const compressed = await gzipAsync(json)

  // Write to exports directory
  const exportsDir = join(homedir(), '.config/tek/exports')
  mkdirSync(exportsDir, { recursive: true })

  const filename = `context-${Date.now()}.json.gz`
  const filepath = join(exportsDir, filename)
  writeFileSync(filepath, compressed)

  return filepath
}
```

**Tauri command wrapper:**

```rust
#[tauri::command]
async fn export_context_dump() -> Result<String, String> {
  let output = std::process::Command::new("node")
    .arg("scripts/export-context.js")
    .output()
    .map_err(|e| e.to_string())?;

  let filepath = String::from_utf8(output.stdout)
    .map_err(|e| e.to_string())?
    .trim()
    .to_string();

  Ok(filepath)
}
```

---

## Validation Checklist for Requirements.md

- [ ] TanStack Form v1.4.0+ installed, `zodValidator` adapter available
- [ ] TanStack Query v5.56.0+ installed, QueryClient configured
- [ ] Zustand 5.0.5 (already installed)
- [ ] BullMQ v5.7.0+ installed in gateway
- [ ] Redis client v4.7.0+ installed in gateway (note: requires Redis server 7.0+)
- [ ] Tauri Log Plugin enabled (v2.2.0)
- [ ] Tauri Event listener hooked in React component lifecycle
- [ ] Fastify routes for `/tool/execute`, `/job/:id/status`, `/job/:id/result`
- [ ] BullMQ worker process spawned on gateway startup
- [ ] Context export script created (`scripts/export-context.ts`)
- [ ] Zustand stores created for UI state (onboarding, monitor, sidebar)
- [ ] TanStack Query hooks created for data fetching

---

## Conflicts to Avoid

### Conflict 1: TanStack Query + Zustand Overlap

**Problem:** Both manage state; easy to duplicate.

**Rule:**
- **TanStack Query** = server state (providers, agents, job results, logs from gateway)
- **Zustand** = client state (UI visibility, form drafts, onboarding stage, monitor filters)

**Example:**
```typescript
// ✓ Correct: Provider list is server state → TanStack Query
const { data: providers } = useProviders() // useQuery hook

// ✓ Correct: Monitor panel visibility is UI state → Zustand
const monitorVisible = useUIStore((s) => s.monitorVisible)

// ✗ Wrong: Don't query provider list and store in Zustand manually
// (defeats purpose of TanStack Query caching)
```

### Conflict 2: BullMQ Job ID Persistence

**Problem:** Job IDs must be passed to React to track progress.

**Rule:**
- When job enqueued, return jobId immediately (don't wait for completion)
- Store jobId in Zustand + TanStack Query cache
- Use jobId to poll `/job/:id/status`

```typescript
// ✓ Correct
const jobId = await invoke('executeTool', toolJob)
useUIStore.setState({ currentJobId: jobId })
queryClient.invalidateQueries({ queryKey: ['job', jobId] })

// ✗ Wrong: Don't wait for job completion in Tauri command
// (blocks UI)
```

### Conflict 3: Real-Time Events vs Polling

**Problem:** Both events + polling can cause race conditions in state.

**Rule:**
- Events update Zustand immediately (optimistic)
- Polling via TanStack Query refetch happens in background (authoritative)
- If event data differs from query, query wins (server source of truth)

```typescript
// ✓ Correct: Event updates UI store immediately
listen('job:progress', ({ payload }) => {
  useUIStore.setState({ jobProgress: payload.progress })
})

// ✓ Also correct: Query refetch also happens, overwrites if needed
useQuery({
  queryKey: ['job', jobId],
  refetchInterval: 1000,
})
```

---

## Testing Checklist

### Unit Tests

- [ ] TanStack Form validation (schema + async validators)
- [ ] Zustand store mutations (state transitions)
- [ ] BullMQ job enqueueing (correct job shape)

### Integration Tests

- [ ] Form submission → TanStack Query mutation → Tauri invoke → gateway API
- [ ] BullMQ job → worker execution → Tauri Event → Zustand update
- [ ] Context export → subprocess → file write → React notification

### E2E Tests

- [ ] User onboards app → fills provider form → saves → sees in UI
- [ ] User runs tool → sees job queued → monitor panel shows progress → result displays
- [ ] User exports context → sees compressed file ready → can download

---

## Deployment Checklist

### Development

- [ ] Redis running locally (`docker run redis`)
- [ ] BullMQ worker auto-started with gateway
- [ ] Tauri dev build includes Log Plugin + Event listeners

### Production

- [ ] Redis cloud-hosted (AWS ElastiCache, Redis Cloud, or local managed instance)
- [ ] Connection string in `.env.production`
- [ ] Tauri app bundled with updated React + Rust code
- [ ] No breaking changes to CLI/Telegram/Web APIs

---

## Version Pinning Rationale

| Package | Version | Locked Until | Reason |
|---------|---------|--------------|--------|
| @tanstack/react-form | ^1.4.0 | 2.0.0 (2027+) | v1.x stable; v2 will have breaking changes |
| @tanstack/react-query | ^5.56.0 | 6.0.0 (2027+) | v5.x established; no major changes expected |
| bullmq | ^5.7.0 | 6.0.0 (2027+) | v5.x stable; used by thousands in production |
| redis | ^4.7.0 | 5.0.0 (2026+) | v4.x stable client; v5 released late 2025 |
| zustand | ^5.0.5 | 6.0.0 (2027+) | v5.x minimal; backwards compatible |

---

## Migration Path from v0.2

**No breaking changes needed.** v0.3 is additive:

1. Existing CLI, Telegram, Web APIs continue working
2. New libraries are React-only (frontend)
3. BullMQ worker runs in parallel with existing WebSocket routing
4. Desktop app is new UI layer; doesn't affect headless gateway

---

**Status:** Ready for REQUIREMENTS.md scoping phase.

All integration points identified. No version conflicts. Deployment plan clear.
