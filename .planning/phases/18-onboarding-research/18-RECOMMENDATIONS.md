# Phase 18: Onboarding Research - Recommendations

**Synthesized from:** [18-RESEARCH.md](./18-RESEARCH.md)
**Purpose:** Actionable implementation guidance for Phase 15 and Phase 16 planners
**Date:** 2026-02-18

---

## For Phase 15: Init & Onboarding Polish

### 1. Two-Phase Onboarding

Split onboarding into infrastructure setup (existing `tek init` wizard) and personality setup (new).

**Infrastructure phase** (existing): API keys, gateway config, security mode, model selection. Already implemented in Phase 14 with skippable steps.

**Personality phase** (new): Add a final "Hatch" step to `tek init` that starts a mini conversational session where the agent asks personality questions. The agent itself conducts the setup, not a form-based wizard.

**If user skips the Hatch step:** Create a `BOOTSTRAP.md` file in the memory directory. On first `tek chat`, the agent detects BOOTSTRAP.md, reads it, and walks the user through personality setup conversationally. BOOTSTRAP.md is deleted after completion (one-time file).

**Implementation:**
- Add Hatch step after existing wizard steps in `packages/cli/src/commands/init.tsx`
- Hatch step spawns a short chat session (reuse existing chat infrastructure)
- BOOTSTRAP.md template lives in `packages/db/memory-files/BOOTSTRAP.md`
- First-run detection: check for BOOTSTRAP.md existence in memory directory

### 2. Personality Presets

Add 5 presets selectable during the Hatch step or BOOTSTRAP.md flow:

| Preset | Description | Tone |
|--------|-------------|------|
| Professional | Concise, formal, business-appropriate | Minimal emoji, structured responses |
| Friendly | Conversational, warm, asks follow-ups | Casual language, encouraging |
| Technical | Detailed, code-heavy, precise | Verbose explanations, implementation details |
| Opinionated | Has preferences, disagrees, personality-forward | Direct, has takes, avoids corporate-speak |
| Custom | User writes their own or agent interviews them | Freeform |

**Implementation:**
- Store presets as markdown template files in `packages/db/memory-files/presets/`
- Each preset is a complete SOUL.md template (50-150 lines)
- Preset selection populates SOUL.md; Custom triggers conversational interview
- Presets are starting points, not locked configurations

### 3. Agent Naming

Add two questions to the Hatch step:

1. "What should your agent be called?" (default: "tek")
2. "How should the agent address you?" (default: first name from config)

**Implementation:**
- Store `agentName` and `userDisplayName` in config.json
- Inject both into system prompt via context assembler
- Agent name appears in CLI status bar and Telegram bot display name

### 4. Skippable Re-run

`tek init` when already configured shows current values and lets user skip any step. Phase 14 implemented this for infrastructure steps. Extend to personality steps.

**Implementation:**
- If SOUL.md already exists and is customized (not default template), show "Keep current personality? [Y/n]"
- If agent name is already set, show current name with skip option
- Never silently overwrite personality files

---

## For Phase 16: Agent Personality System

### 1. Multi-File Identity Architecture

Expand from single SOUL.md to a structured file set. Each file has a distinct purpose and loading rule.

| File | Purpose | When Loaded | Exists Today? |
|------|---------|-------------|---------------|
| `SOUL.md` | Behavioral philosophy (50-150 lines) | Every session | Yes (expand template) |
| `IDENTITY.md` | Name, emoji, avatar, vibe, presentation | Every session | No (create) |
| `USER.md` | Static user context (name, timezone, work) | Private sessions only | No (split from MEMORY.md) |
| `STYLE.md` | Writing style guide, tone calibration | Every session | No (create) |
| `AGENTS.md` | Multi-agent coordination instructions | Every session | No (create) |
| `MEMORY.md` | Dynamic learned facts, decisions | Private sessions only | Yes (keep) |
| `daily/` | Daily conversation logs | Today + yesterday | Yes (keep) |

**Implementation:**
- Update `packages/db/memory-files/` with new template files
- Update `packages/gateway/src/memory/context-assembler.ts` to load new files
- Loading order: SOUL.md > IDENTITY.md > STYLE.md > USER.md > MEMORY.md > daily logs
- Token budget: soul + identity + style should stay under 3000 tokens total

### 2. Richer SOUL.md Template

Replace the current 20-line generic template with an opinionated 50-150 line template containing:

**Sections:**
1. **Core Truths** -- Behavioral principles (be genuinely helpful, have opinions, be resourceful before asking, earn trust through competence)
2. **Communication Style** -- How to write and respond (detail level, examples, code formatting preferences)
3. **Vibe** -- Personality tone (what to embrace: directness, personality; what to avoid: corporate-speak, sycophancy)
4. **Boundaries** -- Hard constraints (private things stay private, ask before acting externally, never send incomplete replies)
5. **Continuity** -- Self-modification instructions ("These files ARE your memory. Read them. Update them. If you change this file, tell the user.")
6. **Learned Preferences** -- Auto-populated section (existing, keep as-is)

**Key principle from research:** "An assistant with no personality is just a search engine." The default should be opinionated, not bland.

### 3. Personality Evolution

Keep tek's conservative approach (user approval required for soul changes). Add a "soul evolution proposal" mechanism:

- Agent observes patterns over time (e.g., user always asks for more detail)
- Agent proposes SOUL.md changes as a diff-style proposal
- User reviews and approves/rejects/edits before applying
- Change history tracked via git (soul files are in version-controlled directory)

**Implementation:**
- Extend existing `evolveSoul()` in `packages/gateway/src/memory/soul.ts`
- Add `proposeSoulChange(section, change, reason)` that emits a WS message
- CLI renders proposal as a diff with approve/reject buttons
- Approved changes applied via targeted section replacement, not full-file overwrite

### 4. Migration Path

Migration script for existing users upgrading to multi-file system:

1. Read existing SOUL.md content
2. Extract "Learned Preferences" section verbatim
3. Split remaining content into SOUL.md (philosophy) + IDENTITY.md (presentation) + STYLE.md (tone)
4. Create USER.md from static facts in MEMORY.md (name, timezone, etc.)
5. Preserve MEMORY.md with only dynamic facts remaining
6. Never silently overwrite -- show diff and confirm

**Implementation:**
- Migration script in `packages/db/src/migrations/`
- Runs automatically on first startup after upgrade
- Creates backup of original files before splitting
- Idempotent: safe to run multiple times

### 5. Multi-Agent Identity Isolation

Per-agent workspace directories with isolated identity files:

```
~/.config/tek/agents/
  default/
    SOUL.md
    IDENTITY.md
    STYLE.md
    MEMORY.md
    daily/
  opus/
    SOUL.md
    IDENTITY.md
    STYLE.md
    MEMORY.md
    daily/
  shared/
    USER.md          # Shared across agents
```

**Cascade resolution order:** Global config > Per-agent config > Workspace file > Default fallback. Most specific wins.

**Implementation:**
- Agent definitions in config.json (`agents.list` array with id, model, description)
- Binding rules route messages to agents by channel/context
- Shared USER.md prevents duplicating user context
- Each agent can have different model, personality, and tool permissions

---

## Don't Build (Anti-Patterns from Research)

These are patterns that seem reasonable but the research shows lead to over-engineering:

| Anti-Pattern | Why It Fails | Do This Instead |
|-------------|--------------|-----------------|
| Database-backed personality system | Adds complexity; markdown files loaded into system prompt work identically | Markdown files ARE the personality system |
| Custom NLP pipeline for style calibration | The LLM itself is the best style analyzer | Feed writing samples to the LLM, let it generate STYLE.md |
| Form-based personality questionnaire | Produces shallow, disconnected personality | Conversation-first via BOOTSTRAP.md -- agent interviews user |
| Custom routing engine for multi-agent | Over-engineering for MVP | Config-driven binding rules (channel > agent mapping) |
| SOUL.md over 150 lines | Token waste, instruction dilution | Split into SOUL.md + STYLE.md + USER.md |
| Personality CRUD APIs | Files don't need an API layer | Direct file read/write with git versioning |

**Key insight from research:** The personality system IS the markdown files. The code only needs to load, inject, and (with approval) write these files. The LLM reads markdown natively -- markdown IS the configuration language.

---

## Open Questions for User Decisions

These questions should be resolved during Phase 15/16 planning. Research-recommended answers are provided.

### 1. Should personality onboarding happen in same `tek init` session or separate `tek chat`?

**Research recommendation:** Both. Add a "Hatch" step at the end of `tek init` that starts a mini chat session. If skipped, BOOTSTRAP.md triggers on first `tek chat`. This gives users the choice without forcing either path.

### 2. How aggressive should personality self-evolution be?

**Research recommendation:** Conservative (tek's current approach). User approval required for all soul file changes. Add a "soul evolution proposal" mechanism where the agent suggests changes and the user reviews a diff before applying. OpenClaw allows more aggressive self-modification, but tek's user base values control and transparency.

### 3. How should multi-agent identities be stored (shared vs separate memory)?

**Research recommendation:** Shared USER.md (user context is the same regardless of agent), separate SOUL.md/IDENTITY.md/STYLE.md per agent (personality is agent-specific), shared long-term MEMORY.md for facts, per-agent daily logs for conversation history.

### 4. What personality fits tek's brand for the default SOUL.md?

**Research recommendation:** Opinionated but not aggressive. Direct, competent, has preferences, avoids corporate-speak and sycophancy. Close to OpenClaw's "Opinionated" preset but calibrated for a developer tool context. The default should feel like talking to a skilled colleague, not a customer service bot.

### 5. Should USER.md be split from MEMORY.md?

**Research recommendation:** Yes. USER.md is relatively static (name, timezone, work context, communication preferences) while MEMORY.md is dynamic (learned facts, project decisions, evolving preferences). Splitting enables selective loading -- USER.md in group/shared contexts, MEMORY.md in private sessions only.
