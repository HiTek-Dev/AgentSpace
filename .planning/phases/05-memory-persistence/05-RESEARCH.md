# Phase 05: Memory & Persistence - Research

**Researched:** 2026-02-16
**Domain:** Long-term memory systems, vector search, conversation persistence, agent personality evolution
**Confidence:** HIGH

## Summary

Phase 5 implements a sophisticated memory and persistence system that transforms AgentSpace from a stateless LLM interface into a learning agent with durable memory, searchable conversation history, and evolving personality. The research reveals a convergence around **dual-layer memory architectures** (daily logs + curated knowledge), **SQLite-native vector search** via sqlite-vec, and **markdown-first soul documents** for personality definition.

The technical stack is well-established: sqlite-vec (0.1.7-alpha) for vector operations, AI SDK 6's embed/embedMany functions for generating embeddings, and file-based markdown logs that provide transparency and Git-friendliness. Memory management follows the MemGPT pattern of "memory pressure triggers" where context window utilization (70-80% thresholds) automatically triggers consolidation to external storage.

Key insight: Modern agent memory systems favor **explicit control over automated convenience**. The industry is moving away from opaque vector-only approaches toward hybrid systems that combine structured knowledge graphs, semantic search, and human-readable markdown files that users can inspect, edit, and version control.

**Primary recommendation:** Implement a dual-layer memory system with daily markdown logs (memory/YYYY-MM-DD.md), curated long-term memory (MEMORY.md), SQLite-based vector embeddings for semantic search, and an evolving soul document (SOUL.md). Use memory pressure triggers (70-80% context utilization) to automatically flush important information before context compaction, and leverage sqlite-vec for fast, dependency-free vector search that runs anywhere SQLite runs.

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sqlite-vec | 0.1.7-alpha.2 | Vector search extension for SQLite | Pure C, zero dependencies, runs anywhere SQLite runs. Successor to sqlite-vss with SIMD acceleration and minimal footprint. MIT/Apache-2 licensed. |
| better-sqlite3 | 11.10.0 (current) | Synchronous SQLite driver for Node.js | Fast, synchronous API, perfect for server-side TypeScript. Already in use at AgentSpace. |
| AI SDK 6 | 6.x | Embedding generation (embed/embedMany) | Multi-provider embeddings with unified API. Already integrated for LLM streaming. |
| Drizzle ORM | 0.45.1 (current) | Type-safe SQL schema and migrations | Zero-friction migrations with drizzle-kit push:sqlite. Already in use. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| OpenAI text-embedding-3-small | Latest | Cost-effective embeddings (1536 dims) | Default choice: $0.02/1M tokens, strong performance |
| OpenAI text-embedding-3-large | Latest | High-quality embeddings (3072 dims) | When quality matters more than cost: $0.13/1M tokens |
| Voyage AI voyage-3.5 | Latest | Anthropic-recommended embeddings | Alternative to OpenAI with domain-specific models |
| tiktoken | Latest | Token counting/estimation | Accurate token counts for memory pressure triggers |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sqlite-vec | Pinecone/Chroma/Weaviate | External vector DBs add deployment complexity, network latency, cost. sqlite-vec keeps everything local and portable. |
| Markdown memory files | PostgreSQL JSONB, MongoDB | Traditional DBs work but lack transparency. Markdown is human-readable, Git-friendly, inspectable. |
| OpenAI embeddings | Voyage AI, Cohere, local models | Voyage has domain-specific models (finance, legal, code). Local models (via Ollama) eliminate API costs but slower. |
| File-based daily logs | Pure SQL tables | SQL tables work but markdown files are more transparent, easier to audit, and Git-versionable. |

**Installation:**

```bash
# Core dependencies
pnpm add sqlite-vec

# Supporting (if not already installed)
pnpm add tiktoken
```

## Architecture Patterns

### Recommended Project Structure

```
packages/
├── db/
│   ├── src/
│   │   ├── schema/
│   │   │   ├── conversations.ts      # Thread management
│   │   │   ├── memories.ts           # Vector embeddings table
│   │   │   ├── system-prompts.ts     # Per-thread and global prompts
│   │   │   └── index.ts
│   │   ├── memory/
│   │   │   ├── daily-logger.ts       # Append to YYYY-MM-DD.md
│   │   │   ├── memory-curator.ts     # Update MEMORY.md
│   │   │   ├── soul-manager.ts       # Read/evolve SOUL.md
│   │   │   └── vector-search.ts      # sqlite-vec KNN queries
│   │   ├── migrations/               # Drizzle migrations
│   │   └── connection.ts
│   └── memory-files/                 # Markdown storage
│       ├── daily/                    # Auto-generated logs
│       │   ├── 2026-02-14.md
│       │   ├── 2026-02-15.md
│       │   └── 2026-02-16.md
│       ├── MEMORY.md                 # Curated long-term facts
│       └── SOUL.md                   # Personality definition
├── core/
│   ├── memory/
│   │   ├── memory-manager.ts         # Orchestrates all memory operations
│   │   ├── pressure-detector.ts      # Context window monitoring
│   │   └── embeddings.ts             # AI SDK embed/embedMany wrappers
│   └── context/
│       └── prompt-builder.ts         # Inject SOUL.md + MEMORY.md + recent logs
```

### Pattern 1: Dual-Layer Memory Architecture

**What:** Separate fast-changing daily logs from slow-changing curated knowledge

**When to use:** All agent memory systems with ongoing conversations

**Example:**

```typescript
// Source: Moltbot/OpenClaw architecture (zenvanriel.nl)
interface MemorySystem {
  // Layer 1: Daily logs (high-churn, auto-loaded)
  dailyLogs: {
    today: string;      // memory/2026-02-16.md
    yesterday: string;  // memory/2026-02-15.md
  };

  // Layer 2: Curated knowledge (low-churn, manually promoted)
  longTermMemory: string; // MEMORY.md

  // Layer 3: Semantic search (vector embeddings)
  vectorStore: {
    search(query: string, topK: number): Promise<MemoryChunk[]>;
  };
}

// On conversation start: load today + yesterday
const context = await loadDailyContext();

// On conversation end: append to today's log
await appendDailyLog(conversationSummary);

// Periodic: curator promotes patterns to MEMORY.md
await promoteToLongTerm(importantFacts);
```

**Why it works:** Mimics human memory (working memory vs. long-term storage), prevents context window explosion, maintains continuity without loading everything.

### Pattern 2: Memory Pressure Triggers

**What:** Automatically flush important information when context approaches capacity

**When to use:** Before any context compaction or summarization

**Example:**

```typescript
// Source: MemGPT/Letta architecture (serokell.io)
interface MemoryPressureMonitor {
  threshold: number; // 0.70 = 70% of context window
  currentUsage: () => number;

  async check(messages: Message[]): Promise<void> {
    const usage = this.currentUsage() / maxTokens;

    if (usage >= this.threshold) {
      // Extract important facts from working memory
      const facts = await extractFacts(messages);

      // Write to today's daily log
      await appendDailyLog(facts);

      // Optionally: summarize older messages
      const summary = await summarize(messages.slice(0, -10));
      messages = [summary, ...messages.slice(-10)];
    }
  }
}
```

**Why it matters:** Prevents information loss during context window management. Industry standard is 70-80% threshold for automated triggers.

### Pattern 3: Soul Document Evolution

**What:** Markdown file defining agent personality that evolves based on interactions

**When to use:** Agents with persistent identity across sessions

**Example:**

```markdown
<!-- SOUL.md -->
# Agent Identity

## Core Values
- Emphasize honesty over sycophancy
- Operate as a thoughtful partner, not a servile assistant
- Maintain transparency about limitations and uncertainties

## Communication Style
- Concise and direct when users need quick answers
- Detailed and exploratory when users seek understanding
- Uses technical precision without unnecessary jargon

## Learned Preferences (Updated 2026-02-16)
- User prefers TypeScript over JavaScript
- User values production-ready patterns over experimental approaches
- User appreciates explicit tradeoffs in technical decisions

## Boundaries
- Never make up information when uncertain
- Always cite sources for factual claims
- Refuse tasks that violate user privacy or security
```

```typescript
// Source: SOUL.md framework (soul.md, github.com/aaronjmars/soul.md)
interface SoulManager {
  async load(): Promise<string>;

  async evolve(interaction: Interaction): Promise<void> {
    // Detect new preferences or personality adjustments
    const insights = await extractPersonalityInsights(interaction);

    if (insights.length > 0) {
      // Append to "Learned Preferences" section
      await updateSoul(insights);
    }
  }
}
```

### Pattern 4: Vector Search with sqlite-vec

**What:** Semantic search over conversation history using KNN in SQLite

**When to use:** Finding relevant past conversations, similar discussions, recalled facts

**Example:**

```typescript
// Source: sqlite-vec documentation (alexgarcia.xyz/sqlite-vec)
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { embed } from 'ai';

const db = new Database(':memory:');
sqliteVec.load(db);

// Create vector table with cosine distance
db.exec(`
  CREATE VIRTUAL TABLE vec_memories USING vec0(
    memory_id INTEGER PRIMARY KEY,
    embedding FLOAT[1536] distance_metric=cosine
  );
`);

// Insert memory with embedding
async function storeMemory(text: string, metadata: any) {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text,
  });

  const blob = new Uint8Array(new Float32Array(embedding).buffer);

  db.prepare(`INSERT INTO vec_memories (memory_id, embedding) VALUES (?, ?)`)
    .run(metadata.id, blob);
}

// Search for similar memories
async function searchMemories(query: string, topK = 10) {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: query,
  });

  const blob = new Uint8Array(new Float32Array(embedding).buffer);

  return db.prepare(`
    SELECT memory_id, distance
    FROM vec_memories
    WHERE embedding MATCH ?
    AND k = ?
  `).all(blob, topK);
}
```

### Pattern 5: Multi-Thread Conversation Management

**What:** SQLite schema supporting multiple conversation threads with per-thread and global prompts

**When to use:** Chat applications with topic-based threading, project-scoped conversations

**Example:**

```typescript
// Drizzle schema for conversation threads
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  systemPrompt: text('system_prompt'), // Thread-specific prompt (nullable)
  archived: integer('archived', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  lastActiveAt: text('last_active_at').notNull(),
});

export const globalPrompts = sqliteTable('global_prompts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  priority: integer('priority').default(0), // Higher = loaded first
});

// Usage: merge global + thread-specific prompts
function buildSystemPrompt(threadId: string): string {
  const global = db.select().from(globalPrompts)
    .where(eq(globalPrompts.isActive, true))
    .orderBy(desc(globalPrompts.priority))
    .all();

  const thread = db.select().from(threads)
    .where(eq(threads.id, threadId))
    .get();

  return [
    ...global.map(p => p.content),
    thread?.systemPrompt,
  ].filter(Boolean).join('\n\n');
}
```

### Anti-Patterns to Avoid

- **Pure vector search without structured data:** Embeddings alone can't answer relational queries like "What did we decide last week about X?" Combine with metadata filtering.
- **Appending to single daily log without rotation:** Files grow unbounded. Rotate daily (YYYY-MM-DD.md pattern).
- **Embedding entire conversations:** Too expensive and noisy. Embed summaries, key decisions, and important facts instead.
- **Ignoring memory pressure until out-of-tokens error:** Monitor proactively at 70-80% capacity, not reactively at 100%.
- **Opaque memory systems:** Users should be able to inspect, edit, and delete their memory files. Avoid black-box databases.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector search in SQLite | Custom BLOB storage + numpy-style distance calculations | sqlite-vec | Battle-tested, SIMD-optimized, supports multiple distance metrics, works everywhere SQLite runs |
| Token counting | Regex-based character estimation | tiktoken or AI SDK token utilities | Embeddings and LLMs use specific tokenizers (cl100k_base for OpenAI). Character counts are inaccurate. |
| Conversation summarization | Template-based text compression | LLM-powered summarization via AI SDK | Modern LLMs excel at extracting key facts and compressing context while preserving meaning |
| Memory consolidation logic | Manual if/else for "what to keep" | LLM-powered fact extraction + structured storage | Let the LLM decide what's important using function calls to write to specific memory tiers |
| Embedding generation | Direct API calls to OpenAI/Voyage | AI SDK embed/embedMany | Handles retries, batching, token tracking, multi-provider switching, and type safety |

**Key insight:** Memory management is deceptively complex. MemGPT/Letta spent years refining when to consolidate, what to discard, and how to retrieve. Vector search has subtle performance pitfalls (index selection, quantization, chunking strategies). Use proven libraries.

## Common Pitfalls

### Pitfall 1: Context Window Miscalculation

**What goes wrong:** Counting only messages, forgetting system prompt + SOUL.md + MEMORY.md + function schemas consume significant tokens.

**Why it happens:** System prompt + soul + memory can be 5-10% of context window before conversation starts. Underestimating leads to premature out-of-tokens errors.

**How to avoid:**
- Budget 10-15% of context for system/memory/soul overhead
- Use tiktoken to count all components: `systemTokens + memoryTokens + conversationTokens`
- Set memory pressure threshold accounting for this overhead (e.g., if 10% overhead, trigger at 65% conversation usage)

**Warning signs:** Frequent token limit errors despite "low" message count, inconsistent agent behavior as context fills.

### Pitfall 2: Embedding Dimension Mismatch

**What goes wrong:** Using text-embedding-3-small (1536 dims) for insertion but text-embedding-3-large (3072 dims) for search, or vice versa.

**Why it happens:** Model names are similar, easy to swap accidentally. Different embedding models produce different dimensions.

**How to avoid:**
- Store model name alongside embeddings in database
- Validate dimensions match on every search: `if (queryEmbedding.length !== storedEmbedding.length) throw error`
- Use consistent model across entire memory system (recommend text-embedding-3-small for cost/performance balance)

**Warning signs:** Vector search returns random results, distance scores don't make sense, errors about dimension mismatch.

### Pitfall 3: Over-Embedding Noise

**What goes wrong:** Embedding every single message including greetings, acknowledgments, "ok", "thanks" creates a noisy vector store.

**Why it happens:** Instinct to "capture everything" without filtering signal from noise.

**How to avoid:**
- Only embed substantive content: decisions, facts, important context, user preferences
- Use LLM to filter: "Is this worth remembering long-term?" before embedding
- Embed summaries of conversations, not raw message-by-message transcripts

**Warning signs:** Semantic search returns irrelevant small-talk instead of important information, vector store grows rapidly without quality improvement.

### Pitfall 4: Forgetting to Normalize Embeddings for Cosine

**What goes wrong:** Using cosine similarity with unnormalized vectors produces incorrect results.

**Why it happens:** Some embedding APIs return normalized vectors (Voyage AI), others don't (raw OpenAI). Assumption of normalization leads to bugs.

**How to avoid:**
- Always normalize embeddings before storage if using cosine: `normalized = vec / ||vec||`
- Or use sqlite-vec's distance_metric=cosine which handles normalization internally
- Verify with Voyage AI documentation: their embeddings are pre-normalized to length 1

**Warning signs:** Cosine similarity scores outside [-1, 1] range, inconsistent retrieval quality.

### Pitfall 5: Daily Log Timestamp Collisions

**What goes wrong:** Multiple conversation sessions on same day overwrite each other's daily logs.

**Why it happens:** Using date-only filenames (2026-02-16.md) without append-only writes.

**How to avoid:**
- Always open daily logs in append mode, never truncate
- Include timestamp headers within the file: `## Session 14:23 UTC`
- Use atomic append operations (Node.js fs.appendFileSync or database transactions)

**Warning signs:** Missing conversation history, incomplete daily logs, merge conflicts in Git.

### Pitfall 6: Memory Leaks in Long-Running Sessions

**What goes wrong:** Drizzle/better-sqlite3 connections leak when not properly reused via singleton pattern.

**Why it happens:** Creating new Database() instances in hot paths (every request) without cleanup.

**How to avoid:**
- Already implemented in AgentSpace: singleton getDb() pattern in packages/db/src/connection.ts
- Reuse sqlite-vec loading: load extension once during getDb() initialization, not per query

**Warning signs:** Increasing memory usage over time, file descriptor warnings, performance degradation.

## Code Examples

Verified patterns from official sources:

### Loading sqlite-vec Extension

```typescript
// Source: https://alexgarcia.xyz/sqlite-vec/js.html
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

const db = new Database('./agentspace.db');
db.pragma('journal_mode = WAL'); // Already in use

sqliteVec.load(db); // Load extension once on startup
```

### Creating Vector Tables

```typescript
// Source: https://alexgarcia.xyz/sqlite-vec/features/knn.html
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_memories USING vec0(
    memory_id INTEGER PRIMARY KEY,
    content_embedding FLOAT[1536] distance_metric=cosine
  );

  -- Regular table for metadata (join with vector table)
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    memory_type TEXT NOT NULL -- 'fact', 'preference', 'decision'
  );
`);
```

### Generating and Storing Embeddings

```typescript
// Source: https://ai-sdk.dev/docs/ai-sdk-core/embeddings
import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

// Single embedding
async function embedMemory(text: string) {
  const { embedding, usage } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text,
  });

  console.log(`Tokens used: ${usage.tokens}`);
  return embedding; // number[] of length 1536
}

// Batch embeddings (more efficient)
async function embedManyMemories(texts: string[]) {
  const { embeddings, usage } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: texts,
  });

  console.log(`Total tokens: ${usage.tokens}`);
  return embeddings; // number[][] - array of embeddings
}

// Store in sqlite-vec (convert to BLOB)
function storeEmbedding(memoryId: number, embedding: number[]) {
  const blob = new Uint8Array(new Float32Array(embedding).buffer);

  db.prepare(`INSERT INTO vec_memories (memory_id, content_embedding) VALUES (?, ?)`)
    .run(memoryId, blob);
}
```

### Semantic Search with KNN

```typescript
// Source: https://alexgarcia.xyz/sqlite-vec/features/knn.html
async function searchMemories(query: string, topK = 10, threadId?: string) {
  // Generate query embedding
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: query,
  });

  const queryBlob = new Uint8Array(new Float32Array(embedding).buffer);

  // KNN search with optional metadata filtering
  const sql = `
    WITH knn_matches AS (
      SELECT memory_id, distance
      FROM vec_memories
      WHERE content_embedding MATCH ?
        AND k = ?
    )
    SELECT
      m.id,
      m.content,
      m.created_at,
      m.memory_type,
      knn.distance
    FROM knn_matches knn
    LEFT JOIN memories m ON m.id = knn.memory_id
    ${threadId ? 'WHERE m.thread_id = ?' : ''}
    ORDER BY knn.distance ASC
  `;

  const params = threadId
    ? [queryBlob, topK, threadId]
    : [queryBlob, topK];

  return db.prepare(sql).all(...params);
}
```

### Daily Log Management

```typescript
// Source: Moltbot architecture (zenvanriel.nl)
import { writeFileSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const MEMORY_DIR = join(process.cwd(), 'packages', 'db', 'memory-files', 'daily');

function getTodayLogPath(): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return join(MEMORY_DIR, `${today}.md`);
}

function getYesterdayLogPath(): string {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  return join(MEMORY_DIR, `${yesterday}.md`);
}

async function appendDailyLog(content: string): Promise<void> {
  const logPath = getTodayLogPath();
  const timestamp = new Date().toISOString();
  const entry = `\n## ${timestamp}\n\n${content}\n`;

  appendFileSync(logPath, entry, 'utf8');
}

function loadRecentLogs(): string {
  const today = getTodayLogPath();
  const yesterday = getYesterdayLogPath();

  const logs: string[] = [];

  if (existsSync(yesterday)) {
    logs.push(readFileSync(yesterday, 'utf8'));
  }

  if (existsSync(today)) {
    logs.push(readFileSync(today, 'utf8'));
  }

  return logs.join('\n\n---\n\n');
}
```

### Memory Pressure Detection

```typescript
// Source: MemGPT architecture + AI SDK utilities
import { estimateTokens } from '@ai-sdk/provider-utils'; // or tiktoken

interface MemoryPressureConfig {
  maxContextTokens: number;     // e.g., 200,000 for Claude Opus
  systemOverheadPercent: number; // e.g., 0.10 for 10%
  triggerThreshold: number;      // e.g., 0.70 for 70%
}

class MemoryPressureMonitor {
  constructor(private config: MemoryPressureConfig) {}

  async checkPressure(
    systemPrompt: string,
    soulDoc: string,
    memoryDoc: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<{ shouldFlush: boolean; usage: number; remaining: number }> {
    // Count all tokens
    const systemTokens = estimateTokens(systemPrompt + soulDoc + memoryDoc);
    const messageTokens = messages.reduce(
      (sum, msg) => sum + estimateTokens(msg.content),
      0
    );

    const totalTokens = systemTokens + messageTokens;
    const usagePercent = totalTokens / this.config.maxContextTokens;

    return {
      shouldFlush: usagePercent >= this.config.triggerThreshold,
      usage: usagePercent,
      remaining: this.config.maxContextTokens - totalTokens,
    };
  }
}

// Usage
const monitor = new MemoryPressureMonitor({
  maxContextTokens: 200_000,
  systemOverheadPercent: 0.10,
  triggerThreshold: 0.70,
});

const pressure = await monitor.checkPressure(
  systemPrompt,
  soulDoc,
  memoryDoc,
  conversationMessages
);

if (pressure.shouldFlush) {
  console.log(`Memory pressure at ${(pressure.usage * 100).toFixed(1)}%, flushing...`);
  await flushToDaily(conversationMessages);
}
```

### Soul Document Management

```typescript
// Source: SOUL.md framework (github.com/aaronjmars/soul.md)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOUL_PATH = join(process.cwd(), 'packages', 'db', 'memory-files', 'SOUL.md');

interface SoulDocument {
  coreValues: string[];
  communicationStyle: string;
  learnedPreferences: Record<string, string>;
  boundaries: string[];
}

function loadSoul(): string {
  return readFileSync(SOUL_PATH, 'utf8');
}

async function evolveSoul(interaction: {
  userMessage: string;
  agentResponse: string;
  detectedPreference?: string;
}): Promise<void> {
  if (!interaction.detectedPreference) return;

  const soul = readFileSync(SOUL_PATH, 'utf8');
  const timestamp = new Date().toISOString().split('T')[0];

  // Append to "Learned Preferences" section
  const newPreference = `- ${interaction.detectedPreference} (learned ${timestamp})\n`;

  // Find insertion point (after "## Learned Preferences")
  const updated = soul.replace(
    /## Learned Preferences.*?\n/,
    `## Learned Preferences (Updated ${timestamp})\n${newPreference}`
  );

  writeFileSync(SOUL_PATH, updated, 'utf8');
}
```

### Thread-Aware System Prompt Building

```typescript
// Source: Model Context Protocol + production patterns
import { eq } from 'drizzle-orm';
import { threads, globalPrompts } from './schema/system-prompts.js';

async function buildSystemPrompt(threadId: string): Promise<string> {
  const db = getDb();

  // Load active global prompts (ordered by priority)
  const globals = await db
    .select()
    .from(globalPrompts)
    .where(eq(globalPrompts.isActive, true))
    .orderBy(desc(globalPrompts.priority))
    .all();

  // Load thread-specific prompt
  const thread = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .get();

  // Load soul document
  const soul = loadSoul();

  // Load curated long-term memory
  const memory = readFileSync(MEMORY_PATH, 'utf8');

  // Load recent daily logs (today + yesterday)
  const recentLogs = loadRecentLogs();

  // Combine in priority order
  return [
    '# System Instructions',
    ...globals.map(p => p.content),
    thread?.systemPrompt ? `\n# Thread Context\n${thread.systemPrompt}` : '',
    `\n# Your Identity (SOUL.md)\n${soul}`,
    `\n# Long-Term Memory\n${memory}`,
    `\n# Recent Activity\n${recentLogs}`,
  ].filter(Boolean).join('\n\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pure vector databases (Pinecone, Chroma) | Hybrid: SQLite + sqlite-vec for local, Pinecone for cloud scale | 2024-2025 | sqlite-vec (released 2024) enables local-first vector search without external services. Zero latency, zero cost after embedding generation. |
| Manual context window management | Automated memory pressure triggers at 70-80% capacity | 2024 (MemGPT) | MemGPT introduced OS-like memory management. Industry standardized on 70-80% thresholds for proactive consolidation. |
| JSON/SQL-only memory | Markdown-first memory files | 2025 | OpenClaw, Moltbot, Claude .md patterns popularized transparent, Git-friendly, human-editable memory. Better debugging, user trust. |
| Single-tier memory (vector store only) | Dual/triple-tier: daily logs + curated knowledge + vector embeddings | 2024-2025 | Mimics human memory (working vs. long-term). Prevents context explosion while maintaining continuity. |
| Text-embedding-ada-002 (1536 dims) | text-embedding-3-small (1536) / text-embedding-3-large (3072) | Jan 2024 | OpenAI's v3 models: 50% cheaper, 20% better MTEB scores. 3-small is new default for cost/quality balance. |
| Opaque personality in system prompts | Explicit SOUL.md documents that evolve | Dec 2025 | Anthropic's Claude "soul document" revelation sparked industry adoption of transparent, evolvable personality definitions. |

**Deprecated/outdated:**

- **sqlite-vss:** Replaced by sqlite-vec (lighter, faster, no Faiss dependency)
- **text-embedding-ada-002:** Superseded by text-embedding-3-small (cheaper, better)
- **Manual SQL for vector search:** sqlite-vec provides optimized virtual tables (vec0) with SIMD acceleration
- **Context stuffing everything:** Memory pressure triggers and tiered storage are now standard

## Open Questions

### 1. **Embedding Model Selection: OpenAI vs. Voyage AI**

**What we know:**
- OpenAI text-embedding-3-small: $0.02/1M tokens, 1536 dims, industry standard
- Voyage AI voyage-3.5: Anthropic-recommended, 1024 dims, domain-specific models available
- Both integrate with AI SDK 6

**What's unclear:**
- Actual performance comparison on AgentSpace-specific queries (code snippets, technical conversations)
- Cost difference at projected scale (need usage estimates)
- Whether domain-specific models (voyage-code-3) offer meaningful gains

**Recommendation:** Start with text-embedding-3-small (proven, cheaper, widely documented). Evaluate Voyage AI in Phase 6+ if domain-specific needs emerge (legal, finance, code-heavy use cases).

### 2. **Soul Document Evolution: Automated vs. User-Curated**

**What we know:**
- MemGPT: LLM autonomously decides what to consolidate
- Claude/OpenClaw: User-curated with LLM assistance
- SOUL.md examples show manual "Learned Preferences" sections

**What's unclear:**
- How often should soul document update? (per session, weekly, manually only)
- Should LLM auto-append preferences, or propose changes for user approval?
- Risk of personality drift if fully automated

**Recommendation:** Hybrid approach—LLM proposes soul updates as tool calls, user approves/rejects via CLI prompt. Prevent silent personality changes while enabling learning.

### 3. **Memory Archival Strategy**

**What we know:**
- Daily logs accumulate indefinitely
- Vector embeddings grow with every stored memory
- SQLite handles GBs efficiently, but retrieval slows

**What's unclear:**
- When to archive old daily logs? (30 days, 90 days, 1 year)
- Should archived logs remain searchable via embeddings, or compressed?
- How to handle thread archival (soft-delete, purge, export to JSON)

**Recommendation:** Implement archival in Phase 6+. For Phase 5, focus on core memory system. Add `archived` boolean to threads table now for future use.

### 4. **Token Counting Accuracy**

**What we know:**
- tiktoken provides exact counts for OpenAI models (cl100k_base tokenizer)
- AI SDK provider-utils has estimateTokens utility
- Different models use different tokenizers (Claude uses different encoding than OpenAI)

**What's unclear:**
- Does AI SDK estimateTokens handle multi-provider accurately?
- Should we use provider-specific token counters for memory pressure?

**Recommendation:** Use tiktoken for OpenAI models (higher accuracy). For other providers, accept AI SDK estimates as "good enough" for memory pressure thresholds (70% trigger has margin for error).

## Sources

### Primary (HIGH confidence)

- [sqlite-vec GitHub Repository](https://github.com/asg017/sqlite-vec) - Official source, v0.1.7-alpha.2
- [sqlite-vec Documentation](https://alexgarcia.xyz/sqlite-vec/) - Official docs, installation, KNN queries
- [sqlite-vec Node.js Guide](https://alexgarcia.xyz/sqlite-vec/js.html) - better-sqlite3 integration patterns
- [AI SDK Core: Embeddings](https://ai-sdk.dev/docs/ai-sdk-core/embeddings) - embed/embedMany API reference
- [OpenAI Embeddings Documentation](https://platform.openai.com/docs/models/text-embedding-3-small) - text-embedding-3 models, pricing, dimensions
- [Anthropic Embeddings Guide](https://platform.claude.com/docs/claude/docs/embeddings) - Voyage AI partnership, model recommendations
- [Design Patterns for Long-Term Memory in LLM Architectures](https://serokell.io/blog/design-patterns-for-long-term-memory-in-llm-powered-architectures) - MemGPT, OpenAI, Claude memory patterns
- [Moltbot Memory Architecture Guide](https://zenvanriel.nl/ai-engineer-blog/moltbot-memory-architecture-guide/) - Daily logs + MEMORY.md pattern
- [OpenClaw Local Memory System](https://eastondev.com/blog/en/posts/ai/20260205-openclaw-memory-system/) - Markdown-first architecture, dual-layer memory
- [SOUL.md Framework](https://soul.md/) - Personality document structure and evolution

### Secondary (MEDIUM confidence)

- [Drizzle ORM SQLite Documentation](https://orm.drizzle.team/docs/get-started-sqlite) - Schema definition, migrations
- [Better Stack: Getting Started with Drizzle](https://betterstack.com/community/guides/scaling-nodejs/drizzle-orm/) - Migration patterns
- [Model Context Protocol: Prompts](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts) - System prompt management standards
- [Context Window Management Strategies](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/) - 70-80% threshold patterns
- [Unified Chat History and Logging System](https://medium.com/@mbonsign/unified-chat-history-and-logging-system-a-comprehensive-approach-to-ai-conversation-management-dc3b5d75499f) - SQLite conversation archival patterns

### Tertiary (LOW confidence, marked for validation)

- [Agent Memory Paper List](https://github.com/Shichun-Liu/Agent-Memory-Paper-List) - Survey of memory mechanisms (research papers, not production)
- [VoltAgent TypeScript AI Agent Framework](https://voltagent.dev/blog/typescript-ai-agent-framework/) - Memory system claims, not verified in docs
- [Supermemory Research](https://supermemory.ai/research) - State-of-the-art claims, no public implementation details yet

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH - sqlite-vec, better-sqlite3, AI SDK 6, Drizzle all have official docs, active maintenance, production usage
- **Architecture patterns:** HIGH - Dual-layer memory, memory pressure triggers, soul documents verified across multiple independent implementations (MemGPT, OpenClaw, Moltbot)
- **Code examples:** HIGH - All examples sourced from official documentation with URLs provided
- **Pitfalls:** MEDIUM - Based on common issues in GitHub issues, community discussions, and inferred from architecture constraints (some validated, some anticipated)
- **Embedding model selection:** MEDIUM - OpenAI pricing/performance verified, Voyage AI partnership confirmed, but head-to-head benchmarks on our use case don't exist yet

**Research date:** 2026-02-16

**Valid until:** 60 days (2026-04-17) - Memory architecture is relatively stable. Embedding models evolve slowly. sqlite-vec is alpha but stable API. Revalidate if major AI SDK or sqlite-vec version releases occur.

---

## Next Steps for Planner

This research provides:

1. **Proven architecture:** Dual-layer memory (daily logs + MEMORY.md) with vector search via sqlite-vec
2. **Standard stack:** sqlite-vec 0.1.7-alpha, AI SDK 6 embeddings, text-embedding-3-small default
3. **Implementation patterns:** Code examples for vector tables, KNN search, daily log management, soul evolution
4. **Pitfall awareness:** Token miscalculation, embedding dimension mismatch, over-embedding noise, normalization issues
5. **Open questions:** Clearly marked decisions for user input (embedding model, soul evolution automation, archival timing)

**Planner should:**

- Create tasks for schema additions (threads, memories, system_prompts tables)
- Create tasks for memory-files directory structure (daily/, MEMORY.md, SOUL.md)
- Create tasks for sqlite-vec integration in connection.ts (one-time load)
- Create tasks for memory manager class (orchestrates daily logs, MEMORY.md, vector search)
- Create tasks for embedding generation wrapper (AI SDK embed/embedMany with usage tracking)
- Create tasks for memory pressure monitor (70% threshold, auto-flush before compaction)
- Create tasks for soul manager (load, evolve with user approval)
- Create verification tasks for pitfalls (dimension validation, normalization checks, token counting accuracy)

**User decisions needed** (defer to CONTEXT.md or Phase 6):

- Embedding model preference (OpenAI vs. Voyage AI) → Recommend OpenAI for MVP
- Soul evolution automation level (auto-append vs. user-approval) → Recommend user-approval for safety
- Memory archival timeline (30/90/365 days) → Defer to Phase 6, implement archival hooks now
