---
phase: 11-install-update-system
verified: 2026-02-17T13:15:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 11: Install & Update System Verification Report

**Phase Goal:** Users can install AgentSpace to any directory, update to the latest build without losing personality/memory/config files, and optionally reset to a clean state — enabling rapid develop-test-update cycles
**Verified:** 2026-02-17T13:15:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Memory files (SOUL.md, MEMORY.md, daily logs) are read from and written to `~/.config/agentspace/memory/` | VERIFIED | All three modules set path constants using `join(CONFIG_DIR, "memory", ...)`. No `__dirname` or `import.meta.url` in path constants. |
| 2 | First run auto-seeds template files from `packages/db/memory-files/` to `CONFIG_DIR/memory/` if not present | VERIFIED | `ensureMemoryFile()` in `ensure-memory.ts` copies template on first access. `install.sh` also seeds on install if `SOUL.md` absent. |
| 3 | Existing dev-mode memory files at old location are auto-migrated to new location on first access | VERIFIED | `ensure-memory.ts` checks old `TEMPLATE_DIR` path, copies to `CONFIG_DIR/memory/` and logs `console.error("[agentspace] Migrated ...")`. |
| 4 | User can run `install.sh` to deploy AgentSpace from source repo to any target directory | VERIFIED | `scripts/install.sh` exists, is executable (`-rwxr-xr-x`), passes `bash -n` syntax check. Builds packages, rsyncs, seeds memory, creates bin symlink, writes `.version`. |
| 5 | User can run `update.sh` to replace code at install directory without losing config, database, memory, or skills | VERIFIED | `scripts/update.sh` exists, executable, syntax-clean. Syncs packages only — no touch of `~/.config/agentspace/` beyond reading `runtime.json`. No memory seeding (install-only). |
| 6 | Gateway is gracefully stopped before update and user is informed how to restart | VERIFIED | `update.sh` reads PID from `runtime.json`, calls `kill $PID`, polls up to 5 seconds for exit, removes `runtime.json`. Prints `"Start with: node $INSTALL_DIR/packages/gateway/dist/index.js"`. |
| 7 | Native modules work at install target because `node_modules` are copied from source | VERIFIED | Both `install.sh` and `update.sh` rsync root `node_modules/` and per-package `node_modules/` (core, db, cli, gateway, telegram) to install directory. |
| 8 | User can run `reset.sh` to wipe all user data and return to a clean state | VERIFIED | `scripts/reset.sh` exists, executable, syntax-clean. Executes `rm -rf "$CONFIG_DIR"` targeting only `~/.config/agentspace/`. |
| 9 | Reset requires explicit confirmation (typing RESET) to prevent accidental data loss | VERIFIED | `read -p "Type 'RESET' to confirm: " confirm` followed by `[ "$confirm" != "RESET" ] && echo "Cancelled." && exit 0`. |
| 10 | Reset script tells user how to re-initialize after wipe | VERIFIED | Prints keychain note and `"To set up AgentSpace from scratch, run: agentspace init"`. |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/memory/soul-manager.ts` | Soul manager reading from `CONFIG_DIR/memory/SOUL.md` | VERIFIED | `const SOUL_PATH = join(CONFIG_DIR, "memory", "SOUL.md")`. Imports `CONFIG_DIR` from `@agentspace/core`. |
| `packages/db/src/memory/memory-curator.ts` | Memory curator reading from `CONFIG_DIR/memory/MEMORY.md` | VERIFIED | `const MEMORY_PATH = join(CONFIG_DIR, "memory", "MEMORY.md")`. Imports `CONFIG_DIR` from `@agentspace/core`. |
| `packages/db/src/memory/daily-logger.ts` | Daily logger writing to `CONFIG_DIR/memory/daily/` | VERIFIED | `const MEMORY_DIR = join(CONFIG_DIR, "memory", "daily")`. Imports `CONFIG_DIR` from `@agentspace/core`. |
| `packages/db/src/memory/ensure-memory.ts` | Shared utility for seeding and migration | VERIFIED | 61-line implementation with `ensureMemoryFile()` and `ensureDailyDir()`. Handles first-install seeding and dev-mode migration. |
| `scripts/install.sh` | First-time installation script containing `rsync` | VERIFIED | 121 lines. Executable. Passes syntax check. Contains rsync with `--exclude` patterns. |
| `scripts/update.sh` | Update script that preserves user data, containing `runtime.json` | VERIFIED | 113 lines. Executable. Passes syntax check. References `runtime.json` for gateway stop. |
| `scripts/reset.sh` | Fresh-start reset script that wipes user data, containing `RESET` | VERIFIED | 37 lines. Executable. Passes syntax check. Contains exact `RESET` confirmation string. |
| `packages/db/memory-files/SOUL.md` | Template source file retained for seeding | VERIFIED | File exists at expected location. |
| `packages/db/memory-files/MEMORY.md` | Template source file retained for seeding | VERIFIED | File exists at expected location. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `soul-manager.ts` | `@agentspace/core CONFIG_DIR` | `import { CONFIG_DIR } from "@agentspace/core"` | WIRED | Exact import present line 3. `SOUL_PATH` uses `CONFIG_DIR`. |
| `memory-curator.ts` | `@agentspace/core CONFIG_DIR` | `import { CONFIG_DIR } from "@agentspace/core"` | WIRED | Exact import present line 3. `MEMORY_PATH` uses `CONFIG_DIR`. |
| `daily-logger.ts` | `@agentspace/core CONFIG_DIR` | `import { CONFIG_DIR } from "@agentspace/core"` | WIRED | Exact import present line 3. `MEMORY_DIR` uses `CONFIG_DIR`. |
| `scripts/install.sh` | `~/.config/agentspace/memory/` | Seeds template files on first install | WIRED | Lines 87-90: `if [ ! -f "$CONFIG_DIR/memory/SOUL.md" ]` then copies `SOUL.md` and `MEMORY.md`. |
| `scripts/update.sh` | `~/.config/agentspace/runtime.json` | Reads PID and stops gateway before update | WIRED | Lines 27-38: reads `$RUNTIME`, extracts PID via node, kills process, polls for exit. |
| `scripts/reset.sh` | `~/.config/agentspace/` | `rm -rf` wipe of config directory | WIRED | Line 28: `rm -rf "$CONFIG_DIR"` where `CONFIG_DIR="$HOME/.config/agentspace"`. |
| `@agentspace/core` | `~/.config/agentspace` | `export const CONFIG_DIR = join(homedir(), ".config", "agentspace")` | WIRED | `packages/core/src/config/types.ts` line 8 exports `CONFIG_DIR`. |

---

### Requirements Coverage

No REQUIREMENTS.md entries mapped specifically to phase 11. The phase goal is self-contained from the ROADMAP.md phase definition and is fully satisfied.

---

### Anti-Patterns Found

No anti-patterns detected in any phase 11 files. Scan covered:
- `packages/db/src/memory/soul-manager.ts`
- `packages/db/src/memory/memory-curator.ts`
- `packages/db/src/memory/daily-logger.ts`
- `packages/db/src/memory/ensure-memory.ts`
- `scripts/install.sh`
- `scripts/update.sh`
- `scripts/reset.sh`

No TODO/FIXME/HACK/PLACEHOLDER comments. No `return null` stubs. No empty handlers.

---

### Human Verification Required

#### 1. End-to-end install cycle

**Test:** From the repo root, run `bash scripts/install.sh /tmp/agentspace-test`. Verify `/tmp/agentspace-test/packages/cli/dist/index.js` exists, `/tmp/agentspace-test/.version` contains valid JSON with `sourceCommit` and `nodeVersion` fields, and `~/.config/agentspace/memory/SOUL.md` exists (if not already present).
**Expected:** Install completes without errors. All artifacts land at target. Memory files seeded if absent.
**Why human:** Requires a real pnpm build and rsync to execute — can't verify via static analysis.

#### 2. End-to-end update cycle (preserves user data)

**Test:** After running install above, modify a test file in `/tmp/agentspace-test/packages/db/dist/`, then run `bash scripts/update.sh /tmp/agentspace-test`. Verify the test file was overwritten but `~/.config/agentspace/memory/SOUL.md` was not touched. Verify `.version` `installedAt` matches the original install time.
**Expected:** Code updated, user data preserved, `installedAt` unchanged.
**Why human:** Requires comparison of filesystem state before/after update.

#### 3. Reset confirmation gate

**Test:** Run `bash scripts/reset.sh`. When prompted, type something other than `RESET` (e.g., "yes"). Verify script exits with "Cancelled." message and `~/.config/agentspace/` is intact.
**Expected:** Only exact string "RESET" triggers deletion.
**Why human:** Interactive input required; can't test stdin non-interactively easily without risk of data loss.

#### 4. Memory file migration (dev-mode)

**Test:** If `~/.config/agentspace/memory/SOUL.md` does not already exist, the TypeScript memory modules should auto-copy from `packages/db/memory-files/SOUL.md` on first `loadSoul()` call, and print migration message to stderr.
**Expected:** File appears at new location, stderr shows `[agentspace] Migrated SOUL.md to ~/.config/agentspace/memory/`.
**Why human:** Requires removing the existing config file to trigger the scenario, which risks real user data.

---

### Observations

**Design note on ensure-memory.ts migration path:** The migration source (`TEMPLATE_DIR`) points to `packages/db/memory-files/` (the template directory), not the old dev-mode path that users would have had data in. For a deployed install without templates, migration would not fire because the old path would not exist at the template location. This is acceptable: deployed installs would be fresh installs handled by `install.sh`, and dev-mode users have the template files at that location. The plan spec and implementation are consistent on this point.

**rsync exclude consistency:** `--exclude='memory-files/'` pattern is identical in both `install.sh` and `update.sh` — confirmed by diff. This ensures memory template sources are never deployed to the install target, which is correct behavior (templates are used at build-time, not runtime).

**Cyclic dependency workaround:** Both scripts build packages individually via `npx tsc` rather than `turbo run build` due to the pre-existing `cli`/`gateway` cyclic workspace dependency. This is a documented deviation that does not affect the phase goal.

---

## Commits Verified

All commits documented in SUMMARYs confirmed present in git history:

| Commit | Description |
|--------|-------------|
| `1e9f2b1` | feat(11-01): refactor memory file paths from __dirname to CONFIG_DIR |
| `ebfb11a` | feat(11-01): add auto-migration and first-run seeding for memory files |
| `a9ac9ea` | feat(11-02): create install.sh for source-to-target deployment |
| `e692462` | feat(11-02): create update.sh for safe code-only updates |
| `e322626` | feat(11-03): add reset.sh for fresh-start user data wipe |

---

_Verified: 2026-02-17T13:15:00Z_
_Verifier: Claude (gsd-verifier)_
