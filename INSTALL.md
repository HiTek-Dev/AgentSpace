# AgentSpace — Install & Update Procedure

## Prerequisites

- **Node.js >= 22** (`node -v` to check)
- **pnpm 9.x** (`npm install -g pnpm`)
- **Git** (for cloning the source repo)
- **API key** for at least one LLM provider (Anthropic recommended)

## 1. Fresh Install

### Clone the source repo

```bash
git clone https://github.com/hitekmedia/AgentSpace.git
cd AgentSpace
```

### Run the install script

```bash
scripts/install.sh ~/agentspace
```

This builds from source and deploys to `~/agentspace`. You can specify any directory.

**What the script does:**
1. Checks Node.js >= 22 and pnpm are available
2. Runs `pnpm install` in the source repo
3. Builds all 5 packages with a two-pass strategy (gateway pass 1 → cli → gateway pass 2) to resolve the cli↔gateway cyclic dependency
4. Creates the install directory and rsyncs built artifacts (no source files, no dev configs)
5. Copies root node_modules and per-package node_modules (native modules like better-sqlite3 work at the target)
6. Seeds default personality (`SOUL.md`) and memory (`MEMORY.md`) to `~/.config/agentspace/memory/` if not already present
7. Creates a `bin/agentspace` symlink
8. Writes a `.version` file with commit hash and timestamps

### Add to your PATH

```bash
# Add to ~/.zshrc or ~/.bashrc:
export PATH="$HOME/agentspace/bin:$PATH"
```

Then reload your shell: `source ~/.zshrc`

### Run onboarding

```bash
agentspace init
```

This walks you through:
1. Choosing a security mode (Full Control or Limited Control)
2. Adding API keys (stored in macOS Keychain, not on disk)
3. Creating `~/.config/agentspace/config.json`
4. Generating an auth token

### Start the gateway

```bash
# Terminal 1:
node ~/agentspace/packages/gateway/dist/index.js
# You should see: gateway listening on 127.0.0.1:3271
```

### Start chatting

```bash
# Terminal 2:
agentspace chat
```

## 2. Updating

When you've pulled new changes to the source repo:

```bash
cd AgentSpace
git pull
scripts/update.sh ~/agentspace
```

**What the script does:**
1. Checks the install directory exists (errors if not — run install.sh first)
2. Stops the gateway if it's running (reads PID from `~/.config/agentspace/runtime.json`)
3. Runs `pnpm install` and rebuilds all packages from source
4. Rsyncs updated built artifacts to the install directory
5. Syncs node_modules (picks up new/updated dependencies)
6. Updates `.version` file (preserves original `installedAt` date, updates `updatedAt`)

**What it does NOT touch:**
- `~/.config/agentspace/config.json` (your settings)
- `~/.config/agentspace/agentspace.db` (your conversations, threads, memories)
- `~/.config/agentspace/memory/` (SOUL.md, MEMORY.md, daily logs)
- macOS Keychain entries (API keys)

After updating, restart the gateway:
```bash
node ~/agentspace/packages/gateway/dist/index.js
```

## 3. Fresh Start (Reset)

To wipe all user data and start from scratch:

```bash
scripts/reset.sh
```

**What it does:**
1. Shows a warning listing everything that will be deleted
2. Requires you to type `RESET` to confirm (any other input cancels)
3. Stops the gateway if running
4. Removes the entire `~/.config/agentspace/` directory

**What it does NOT remove:**
- The installed code (`~/agentspace/` stays intact)
- API keys in macOS Keychain (remove manually with `agentspace keys remove <provider>`)

After resetting, run onboarding again: `agentspace init`

## File Locations

| What | Where |
|------|-------|
| Installed code | `~/agentspace/` (or your chosen directory) |
| Config file | `~/.config/agentspace/config.json` |
| SQLite database | `~/.config/agentspace/agentspace.db` |
| Personality | `~/.config/agentspace/memory/SOUL.md` |
| Long-term memory | `~/.config/agentspace/memory/MEMORY.md` |
| Daily logs | `~/.config/agentspace/memory/daily/` |
| Runtime info | `~/.config/agentspace/runtime.json` (only while gateway runs) |
| API keys | macOS Keychain (service: `agentspace`) |
| Version info | `~/agentspace/.version` |
| CLI binary | `~/agentspace/bin/agentspace` |

## Telegram Setup (Optional)

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Add the bot token to your config:
   ```bash
   # Edit ~/.config/agentspace/config.json, add:
   # "telegram": { "botToken": "YOUR_BOT_TOKEN" }
   ```
3. Start the Telegram service:
   ```bash
   node ~/agentspace/packages/telegram/dist/index.js
   ```
4. In Telegram, send `/start` to your bot, then `/pair`
5. Enter the pairing code shown

## Troubleshooting

**Build fails with turbo errors:**
The install/update scripts build packages individually with `npx tsc` to avoid a known turbo issue with the cli/gateway cyclic workspace dependency. If you see turbo-related errors during manual builds, use the scripts instead.

**sqlite-vec or better-sqlite3 issues:**
These are native modules compiled for your platform. The install script copies the pre-built binaries from the source repo's node_modules. If you change Node.js versions, re-run the install or update script to rebuild.

**Gateway won't start after update:**
Check that the update script ran successfully. Look for errors in the build output. Try `node ~/agentspace/packages/gateway/dist/index.js 2>&1` to see startup errors.

**Memory files not found:**
On first run after the Phase 11 update, memory files auto-migrate from the old location (inside the package tree) to `~/.config/agentspace/memory/`. If you see a migration notice on stderr, this is expected and only happens once.
