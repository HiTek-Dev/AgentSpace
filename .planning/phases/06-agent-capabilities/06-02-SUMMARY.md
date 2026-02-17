---
phase: 06-agent-capabilities
plan: 02
subsystem: agent
tags: [skills, gray-matter, yaml, zod, filesystem, metadata]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: config schema, logger, Zod patterns
provides:
  - SkillMetadata/SkillTier/LoadedSkill types with Zod validation
  - discoverSkills() function scanning workspace and managed directories
  - getSkillsDirs() for resolving skill directory paths from config
  - formatSkillsForContext() for context assembler integration
  - gray-matter YAML frontmatter parsing for SKILL.md files
affects: [06-agent-capabilities, context-assembler, gateway]

# Tech tracking
tech-stack:
  added: [gray-matter]
  patterns: [SKILL.md frontmatter parsing, two-tier skill discovery, workspace-over-managed precedence]

key-files:
  created:
    - packages/core/src/skills/types.ts
    - packages/core/src/skills/loader.ts
    - packages/core/src/skills/index.ts
  modified:
    - packages/core/src/index.ts
    - packages/core/package.json

key-decisions:
  - "Used readdirSync instead of glob for flat directory scanning (avoids unnecessary dependency)"
  - "safeParse for SKILL.md validation to skip invalid files silently without crashing"
  - "Cast Dirent entries for Node.js v24 type compatibility with withFileTypes"

patterns-established:
  - "SKILL.md discovery: subdirectory-per-skill with YAML frontmatter metadata"
  - "Two-tier skill system: workspace overrides managed by name"
  - "Skills formatted as ## Name sections for context injection"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 6 Plan 02: Skills Directory Summary

**SKILL.md discovery system with gray-matter YAML parsing, two-tier workspace/managed precedence, and Zod-validated metadata**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T00:27:00Z
- **Completed:** 2026-02-17T00:29:06Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments
- Skills types (SkillMetadata, SkillTier, LoadedSkill) with Zod schema validation
- discoverSkills() scans workspace and managed directories for SKILL.md files with workspace-over-managed precedence
- getSkillsDirs() resolves directory paths from config (workspace: `.agentspace/skills/`, managed: `~/.config/agentspace/skills/`)
- formatSkillsForContext() formats loaded skills into markdown sections for context assembler integration
- All exports re-exported from @agentspace/core barrel

## Task Commits

Each task was committed atomically:

1. **Task 1: Create skills types and loader** - `ed0264b` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `packages/core/src/skills/types.ts` - SkillMetadata, SkillTier, LoadedSkill types with Zod schema
- `packages/core/src/skills/loader.ts` - discoverSkills, getSkillsDirs, formatSkillsForContext functions
- `packages/core/src/skills/index.ts` - Barrel exports for skills module
- `packages/core/src/index.ts` - Re-export skills module from core package
- `packages/core/package.json` - Added gray-matter dependency

## Decisions Made
- Used `readdirSync` with `withFileTypes` instead of `glob` for directory scanning -- flat skill directory structure makes glob unnecessary
- Used `safeParse` instead of `parse` for SKILL.md validation so invalid files are skipped silently
- Cast `Dirent` entries with explicit type annotation for Node.js v24 compatibility (generic `Dirent<NonSharedBuffer>` vs `Dirent<string>`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Node.js v24 Dirent type mismatch**
- **Found during:** Task 1 (Build verification)
- **Issue:** `readdirSync({ withFileTypes: true })` returns `Dirent<NonSharedBuffer>` in Node.js v24 types, causing TS2322 error
- **Fix:** Explicit `Dirent[]` type annotation and `as string` cast for `entry.name`
- **Files modified:** packages/core/src/skills/loader.ts
- **Verification:** `pnpm --filter @agentspace/core build` passes
- **Committed in:** ed0264b (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary type fix for Node.js v24 compatibility. No scope creep.

## Issues Encountered
- Pre-existing cyclic dependency between @agentspace/cli and @agentspace/gateway causes `pnpm build` (full monorepo) to fail via turbo. This is not caused by this plan. Core package builds independently without issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Skills types and loader ready for integration with context assembler (06-03/04)
- formatSkillsForContext() can be plugged into the existing context assembly pipeline
- Two-tier discovery supports both local project skills and global managed skills

---
*Phase: 06-agent-capabilities*
*Completed: 2026-02-16*
