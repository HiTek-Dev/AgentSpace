# Development Deployment Guide - CRITICAL FOR DEV WORK

## Overview
This document is critical for developers working on the Tek codebase. It explains how to properly install, test, and clean up development builds.

## Key Architectural Points

### Installation Structure
- **Source Code**: `/Users/drew-mini/Documents/GitHub/tek` (git repository)
- **Development Installation**: `~/.local/tek/` (synced built artifacts)
- **Configuration**: `~/.config/tek/` (includes install-path file)
- **CLI Binary**: `~/tek/bin/tek` (symlink to CLI)

### Why This Matters
The development setup maintains a clean separation between:
1. **Source code** (git repo - NEVER delete)
2. **Built artifacts** (synced to ~/.local/tek - safe to delete)
3. **Configuration** (config and database - can be reset)

## Development Installation Process

### Quick Setup (Recommended)
```bash
# One command to build, install, and set up dev environment
bash scripts/dev-install.sh
```

### Manual Steps (If Needed)
```bash
# 1. Build from source
npm run build

# 2. Create config directory
mkdir -p ~/.config/tek

# 3. Record installation path (CRITICAL - enables uninstall)
echo ~/.local/tek > ~/.config/tek/install-path

# 4. Sync packages to local installation
rsync -a --delete \
  --exclude='src/' \
  --exclude='*.tsbuildinfo' \
  --exclude='.turbo/' \
  --exclude='memory-files/' \
  --exclude='.env' \
  --exclude='tsconfig*.json' \
  --exclude='vitest.config.*' \
  --exclude='biome.json' \
  packages/ ~/.local/tek/packages/

# 5. Start using Tek
tek gateway start
tek chat
```

## After Making Changes

### After Source Changes
1. Build: `npm run build`
2. Sync: `bash scripts/dev-install.sh` (syncs new artifacts)
3. Restart gateway: `tek gateway stop && tek gateway start`

### After Database Schema Changes
1. Build: `npm run build`
2. Sync: `bash scripts/dev-install.sh`
3. Delete database to force recreation: `rm ~/.config/tek/tek.db`
4. Restart gateway: `tek gateway start` (recreates database with new schema)

### After New Dependencies Added
1. Update package.json as needed
2. Build: `npm run build`
3. Sync: `bash scripts/dev-install.sh`
4. Restart: `tek gateway stop && tek gateway start`

## Clean Installation (Full Reset)

```bash
# Complete uninstall (removes everything)
tek uninstall

# Or manual cleanup:
rm -rf ~/.local/tek
rm -rf ~/.config/tek
rm ~/tek/bin/tek

# Then fresh install:
bash scripts/dev-install.sh
```

## Important: The install-path File

**This file is CRITICAL for development work.**

Located at: `~/.config/tek/install-path`

Contains: The path to the installation directory (`~/.local/tek`)

**Why it matters**:
- Without it, `tek uninstall` cannot find the installation and will refuse to run
- It allows the system to properly locate and validate the installation
- It enables clean uninstalls and fresh builds

**If you lose it**:
```bash
mkdir -p ~/.config/tek
echo ~/.local/tek > ~/.config/tek/install-path
```

## Troubleshooting Development Issues

### "tek command not found"
- Run fresh install: `bash scripts/dev-install.sh`
- Or reload shell: `exec $SHELL`

### "Gateway won't start"
- Check logs: `tek gateway logs`
- Kill orphaned processes: `pkill -f gateway`
- Delete old database: `rm ~/.config/tek/tek.db`
- Restart: `tek gateway start`

### Database errors after schema changes
- Delete the database (NOT the config directory): `rm ~/.config/tek/tek.db`
- Gateway will recreate it with the new schema on next start
- This is safe - only schema changes trigger this, not data preservation issues

### Changes not appearing in CLI
- Did you rebuild? `npm run build`
- Did you sync? `bash scripts/dev-install.sh`
- Did you restart gateway? `tek gateway stop && tek gateway start`

### "uninstall blocked - no .version file"
This means install-path is missing or pointing to the wrong location:
```bash
# Fix it:
echo ~/.local/tek > ~/.config/tek/install-path

# Then try uninstall:
tek uninstall
```

## Production vs Development

| Aspect | Production | Development |
|--------|-----------|-------------|
| Source | Packaged tarball | Git repository |
| Validation | .version file | packages structure |
| Install-path | Created by installer | Must create manually |
| Clean rebuild | Full tarball extraction | `bash scripts/dev-install.sh` |
| Database reset | Manual delete required | Manual delete required |

## Never Delete

⚠️ **CRITICAL**: Never delete the source repository (`/Users/drew-mini/Documents/GitHub/tek`)

The validation function checks for `.git` directory to prevent accidental deletion of the source code.

Safe to delete:
- `~/.local/tek/` - All rebuilt artifacts
- `~/.config/tek/` - Configuration and database
- `~/tek/bin/tek` - CLI symlink

## Summary Checklist

- [ ] Use `bash scripts/dev-install.sh` for fresh dev setup
- [ ] Run it again after building changes
- [ ] Delete `~/.config/tek/tek.db` after schema changes
- [ ] Keep `~/.config/tek/install-path` file intact
- [ ] Restart gateway after syncing: `tek gateway stop && tek gateway start`
- [ ] Never manually delete the source `/Users/drew-mini/Documents/GitHub/tek`
