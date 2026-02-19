# Tek -- Install & Update Procedure

## Prerequisites

- **macOS** with Apple Silicon (M1/M2/M3/M4)
- **Node.js >= 22** (`node -v` to check)
- **API key** for at least one LLM provider (Anthropic recommended)

## 1. Quick Install (Recommended)

One command to download and install everything:

```bash
curl -fsSL https://tekpartner.b-cdn.net/tek/dist/install.sh | bash
```

This will:

1. Check you're on an ARM64 Mac with Node.js 22+
2. Ask where to install (default: `~/tek`)
3. Download pre-built backend packages and desktop app
4. Extract backend, create `bin/tek` symlink
5. Install Tek.app to `/Applications`
6. Seed default personality and memory files
7. Offer to add `tek` to your PATH automatically

After install, follow the on-screen instructions:

```bash
# Open a new terminal, then:
tek init          # Setup wizard (API keys, model selection, security mode)
tek gateway start # Start the gateway server
tek chat          # Start chatting
```

Open the **Tek desktop app** from `/Applications` or Spotlight for the GUI experience.

### Custom install directory

```bash
curl -fsSL https://tekpartner.b-cdn.net/tek/dist/install.sh | bash -s -- /custom/path
```

## 2. Install from Source (Development)

For contributing or building from source:

```bash
git clone https://github.com/HiTek-Dev/tek.git
cd tek
pnpm install
scripts/install.sh ~/tek
```

### Add to your PATH

```bash
echo 'export PATH="$HOME/tek/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Run onboarding

```bash
tek init
```

This walks you through:

1. Choosing a security mode (Full Control or Limited Control)
2. Adding API keys (stored in macOS Keychain, not on disk)
3. Selecting a default model from the full provider catalog (with recommendations marked)
4. Configuring model aliases (fast, balanced, premium)
5. Creating `~/.config/tek/config.json`
6. Generating an auth token

Already set up? Running `tek init` again lets you skip any step that already has a value -- just select "Keep current" to move on.

### Start the gateway

```bash
tek gateway start
```

You should see: `gateway listening on 127.0.0.1:3271`

Use `tek gateway stop` to shut it down, or `tek gateway status` to check if it's running.

### Start chatting

```bash
tek chat
```

## 3. Updating

### From CDN (recommended)

Re-run the same install command. It detects the existing install, preserves your config/data, and updates the backend + desktop app:

```bash
curl -fsSL https://tekpartner.b-cdn.net/tek/dist/install.sh | bash
```

### From source

```bash
cd tek
git pull
scripts/update.sh ~/tek
```

**What updates preserve:**

- `~/.config/tek/config.json` (your settings)
- `~/.config/tek/tek.db` (your conversations, threads, memories)
- `~/.config/tek/memory/` (SOUL.md, MEMORY.md, daily logs)
- macOS Keychain entries (API keys)

## 4. Fresh Start (Reset)

To wipe all user data and start from scratch (keeps the installed code):

```bash
scripts/reset.sh
```

Requires you to type `RESET` to confirm. Then run `tek init` again.

## 5. Uninstalling

```bash
tek uninstall
```

This removes **everything**:

- Install directory (`~/tek` or wherever you installed)
- Config/data directory (`~/.config/tek/`)
- API keys from macOS Keychain
- Desktop app (`/Applications/Tek.app`)
- Launchd plist, if present
- PATH entry from `~/.zshrc`

Type `UNINSTALL` to confirm.

### Manual uninstall

If the CLI is already deleted or broken:

```bash
rm -rf ~/tek                    # Install directory
rm -rf ~/.config/tek            # Config and data
rm -rf /Applications/Tek.app    # Desktop app
# Edit ~/.zshrc and remove the line containing tek/bin
# Open Keychain Access.app and delete entries with service "tek"
```

## File Locations

| What             | Where                                                  |
| ---------------- | ------------------------------------------------------ |
| Installed code   | `~/tek/` (or your chosen directory)                    |
| Desktop app      | `/Applications/Tek.app`                                |
| Config file      | `~/.config/tek/config.json`                            |
| SQLite database  | `~/.config/tek/tek.db`                                 |
| Personality      | `~/.config/tek/memory/SOUL.md`                         |
| Long-term memory | `~/.config/tek/memory/MEMORY.md`                       |
| Daily logs       | `~/.config/tek/memory/daily/`                          |
| Runtime info     | `~/.config/tek/runtime.json` (only while gateway runs) |
| API keys         | macOS Keychain (service: `tek`)                        |
| Version info     | `~/tek/.version`                                       |
| CLI binary       | `~/tek/bin/tek`                                        |

## Telegram Setup (Optional)

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Add the bot token to your config:
   ```bash
   # Edit ~/.config/tek/config.json, add:
   # "telegram": { "botToken": "YOUR_BOT_TOKEN" }
   ```
3. Start the Telegram service:
   ```bash
   node ~/tek/packages/telegram/dist/index.js
   ```
4. In Telegram, send `/start` to your bot, then `/pair`
5. Enter the pairing code shown

## Troubleshooting

**Build fails with turbo errors:**
The install/update scripts build packages individually with `npx tsc` to avoid a known turbo issue with the cli/gateway cyclic workspace dependency. If you see turbo-related errors during manual builds, use the scripts instead.

**sqlite-vec or better-sqlite3 issues:**
These are native modules compiled for your platform. The install script copies the pre-built binaries from the source repo's node_modules. If you change Node.js versions, re-run the install or update script to rebuild.

**Gateway won't start after update:**
Check that the update script ran successfully. Look for errors in the build output. Try `tek gateway start 2>&1` to see startup errors.

**Memory files not found:**
On first run after the Phase 11 update, memory files auto-migrate from the old location (inside the package tree) to `~/.config/tek/memory/`. If you see a migration notice on stderr, this is expected and only happens once.

## Distribution (Developers)

Build and upload new releases:

```bash
# Build all artifacts (backend tarball + Tauri DMG)
scripts/dist.sh

# Upload to CDN
scripts/upload-cdn.sh

# Users can then install/update with:
# curl -fsSL https://tekpartner.b-cdn.net/tek/dist/install.sh | bash
```
