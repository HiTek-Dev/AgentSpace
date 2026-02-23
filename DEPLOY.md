# Tek Deployment and Installation Guide

This document describes the complete process for building, packaging, distributing, and installing Tek across different environments.

## Overview

Tek uses a three-stage deployment process:
1. **Build**: Compile TypeScript, bundle applications
2. **Package**: Create distributable archives with all dependencies
3. **Install**: Extract and set up the installation with proper configuration management

## Architecture

### Installation Paths

- **Installation Base**: `~/.local/tek/` - Contains built artifacts and dependencies
- **Configuration**: `~/.config/tek/` - Stores configuration, keys, and metadata
- **Binary Symlink**: `~/tek/bin/tek` - CLI executable (symlink to packaged CLI)
- **PATH Entry**: `~/.zshrc` - Entry added to make `tek` command available globally

### Distribution Structure

The distributable package has this structure (minimal size, dependencies installed during installation):
```
tek-v0.0.34/
├── packages/
│   ├── cli/
│   │   ├── dist/              # Compiled CLI code
│   │   └── package.json
│   ├── core/
│   │   ├── dist/
│   │   └── package.json
│   ├── db/
│   ├── gateway/
│   └── telegram/
├── apps/
│   └── desktop/
│       └── dist/              # Desktop app built assets
├── pnpm-lock.yaml             # Lock file for reproducible installs
├── pnpm-workspace.yaml        # Workspace configuration
├── package.json               # Root package manifest
├── install.sh                 # Installation script
├── .version                   # Version file
└── README.md                  # Installation instructions
```

**Size Benefits**: Only ~100MB for the tarball (vs 8GB+ when including node_modules)

## Building Releases

### Prerequisites
- Node.js 18+
- pnpm 8+
- macOS tools (for tarball creation)

### Build Process

Run the build script from the repository root:

```bash
bash scripts/build/build-release.sh
```

This script:
1. Extracts version from `package.json`
2. Runs `pnpm build` to compile all packages
3. Creates distribution directory structure at `.build/tek-vX.Y.Z/`
4. Copies built artifacts from:
   - `packages/{cli,core,db,gateway,telegram}/dist`
   - `apps/desktop/dist`
5. Includes `node_modules/` for dependency resolution
6. Creates compressed tarball at `.release/tek-vX.Y.Z-macos.tar.gz`
7. Generates SHA256 checksums at `.release/tek-vX.Y.Z-macos.sha256`

**Output**:
```
.release/
├── tek-v0.0.34-macos.tar.gz   # ~100MB compressed (dependencies installed on install)
├── tek-v0.0.34-macos.sha256   # SHA256 checksum
└── README.md                  # Installation instructions
```

**What Gets Built**:
- All TypeScript packages are compiled (`packages/*/dist`)
- Desktop app is built with Vite (`apps/desktop/dist`)
- pnpm lock file is included for reproducible installs
- Dependencies are NOT bundled (saves ~8GB of space)

### Verifying the Build

```bash
# Verify tarball integrity
shasum -a 256 -c .release/tek-v0.0.34-macos.sha256

# Check contents
tar -tzf .release/tek-v0.0.34-macos.tar.gz | head -20
```

## Distribution

### Local Testing

For local testing (emulating CDN distribution):

```bash
# 1. Extract to a temporary location
cd /tmp
tar -xzf /path/to/.release/tek-v0.0.34-macos.tar.gz
cd tek-v0.0.34

# 2. Run installer
./install.sh
```

### CDN Distribution

To distribute releases:

1. Upload tarball and checksum to CDN:
   ```
   s3://releases.tek.ai/v0.0.34/tek-v0.0.34-macos.tar.gz
   s3://releases.tek.ai/v0.0.34/tek-v0.0.34-macos.sha256
   ```

2. Users can then install via:
   ```bash
   curl -L https://releases.tek.ai/v0.0.34/tek-v0.0.34-macos.tar.gz | tar -xz
   cd tek-v0.0.34
   ./install.sh
   ```

## Installation

### Installation Modes

The installer supports two modes: **Clean Install** and **Update**.

#### Clean Install
First-time installation. Prompts for confirmation to proceed:

```bash
./install.sh
# Output:
# Tek v0.0.34 Installer
# Fresh install
# Installing files...
# ✓ Files installed to: ~/.local/tek
# Installing dependencies...
# Using pnpm to install dependencies...
# ✓ Dependencies installed
# ✓ CLI symlink: ~/tek/bin/tek
# ✓ PATH configured in ~/.zshrc
# ✓ Installation complete!
#
# Run this to set up:
#   exec $SHELL              # Reload shell
#   tek init                 # Configure API keys
#   tek gateway              # Start gateway
#   tek chat                 # Start chatting
```

**Prerequisites**: pnpm must be installed. If not present, installation will skip dependencies and show instructions to install manually.

#### Update Mode
Updates existing installation while preserving configuration and keys:

```bash
./install.sh
# Output:
# Tek v0.0.34 Installer
# Found existing installation at: ~/.local/tek
#
# Choose an option:
#   1) Update (preserve configuration and keys)
#   2) Clean install (clear all config and keys)
#   3) Cancel
```

Selecting option 1:
- Backs up current config to `~/.config/tek/.backup-[timestamp]/`
- Updates binary files and dependencies
- Preserves all configuration and API keys
- Ready to use immediately

Selecting option 2:
- Requires typing "DELETE" to confirm
- Removes all configuration and keys
- Equivalent to clean install on existing system

### Installer Script Details

**Location**: `scripts/install/install.sh`

**Key Features**:
- Automatic detection of existing installations via `~/.config/tek/install-path`
- Safe backup system for configuration preservation
- Colored output for better UX
- Two-level confirmation for destructive operations
- Automatic PATH configuration
- Post-install instructions based on mode

**Files Created**:
- `~/.local/tek/` - Installation directory with all artifacts
- `~/tek/bin/tek` - Symlink to CLI (for backwards compatibility)
- `~/.config/tek/` - Configuration directory
- `~/.config/tek/install-path` - Records installation path for future updates

## Post-Installation Setup

After successful installation:

### 1. Reload Shell
```bash
exec $SHELL
# Or manually source config
source ~/.zshrc
```

### 2. Initialize Configuration
First time only:
```bash
tek init
```

This prompts for:
- Anthropic API key
- Optional: Web search API key (Brave)
- Optional: Telegram bot token
- Local model preference (Ollama vs Remote)

### 3. Start Gateway
Terminal 1:
```bash
tek gateway
# Output:
# Gateway started on 127.0.0.1:3271 (PID 12345)
#   Logs: tek gateway logs
```

### 4. Start Using Tek

Terminal 2:
```bash
# CLI interface
tek chat

# Or use desktop app (if installed)
tek desktop
```

## Verification

### Verify Installation

```bash
# Check CLI works
tek --version
# Output: Tek v0.0.34

# Check gateway can start
tek gateway &
sleep 2
# Check logs
tek gateway logs | tail -20

# Test API call
curl -i http://127.0.0.1:3271/health
```

### Gateway Startup Checks

When the gateway starts, it performs these checks:

```
✓ WebSocket server listening
✓ Telegram bot configured
✓ Database connected
✓ Skills loaded (4 tools available)
Gateway startup: 4/4 checks passed
```

If Telegram is not configured:
```
○ Telegram bot (not configured)
```

### Troubleshooting Installation Issues

**Problem**: `tek` command not found
- **Solution**: Ensure `source ~/.zshrc` was run, or start new terminal

**Problem**: Gateway won't start
- **Solution**: Check logs: `tek gateway logs` or check port 3271 is free: `lsof -i :3271`

**Problem**: Module resolution errors
- **Solution**: Ensure installation used proper tarball distribution. Development installs may have module resolution issues due to pnpm monorepo structure.

## Updating Tek

To update to a newer version:

```bash
# Download and extract new version
cd /tmp
tar -xzf /path/to/.release/tek-v0.0.35-macos.tar.gz
cd tek-v0.0.35

# Run installer
./install.sh
# Select option 1 (Update, preserve configuration)
```

The installer will:
1. Detect existing installation
2. Prompt for update vs. clean install
3. Backup current configuration
4. Install new files
5. Preserve all keys and configuration

## Development vs Production

### Development Installation
```bash
# For development, work directly in repo
cd /path/to/tek
pnpm build
pnpm dev  # Various dev commands
```

Module resolution works directly due to pnpm workspace configuration.

### Production Installation
```bash
# For production, use distributed packages
tar -xzf tek-v0.0.34-macos.tar.gz
cd tek-v0.0.34
./install.sh
```

Module resolution uses:
1. Node's standard resolution with bundled `node_modules`
2. File path imports as fallback
3. Workspace package imports

## File Locations Reference

```
~/.local/tek/                    # Installation root
  packages/
    cli/dist/                    # CLI executable
    gateway/dist/                # Gateway server
    telegram/dist/               # Telegram bot
    core/dist/                   # Core utilities
    db/dist/                      # Database layer
  node_modules/                  # Dependencies
  .version                       # Version file

~/tek/bin/tek                    # CLI symlink

~/.config/tek/                   # Configuration root
  install-path                   # Path to installation
  .backup-[timestamp]/           # Backup from previous install
  keys.json                      # API keys (encrypted)
  config.json                    # User configuration
  db.sqlite                      # Session database

~/.zshrc                         # Shell configuration
  # Contains: export PATH="~/tek/bin:$PATH"
```

## Continuous Integration / CI Setup

For automated releases:

```bash
#!/bin/bash
# ci/build-release.sh

# 1. Run tests
pnpm test

# 2. Build release
bash scripts/build/build-release.sh

# 3. Upload to CDN
aws s3 cp .release/tek-v*.tar.gz s3://releases.tek.ai/v0.0.34/
aws s3 cp .release/tek-v*.sha256 s3://releases.tek.ai/v0.0.34/

# 4. Create GitHub release
gh release create v0.0.34 .release/tek-v*.tar.gz
```

## Troubleshooting Common Issues

### Module Resolution Fails After Installation
**Symptom**: `Error: Cannot find module '@tek/telegram'`
**Cause**: Working directory not properly set or incorrect path
**Solution**:
- Ensure installation used tarball distribution (not dev repo)
- Check `~/.config/tek/install-path` points to `~/.local/tek`
- Verify `~/.local/tek/node_modules` exists and contains `@tek/*` symlinks

### Telegram Bot Not Responding
**Symptom**: Messages to Telegram bot not acknowledged
**Cause**: Token not configured or bot not started
**Solution**:
1. Check token is set: `tek init` → enter bot token
2. Verify gateway sees it: `tek gateway logs | grep -i telegram`
3. Restart gateway: `tek gateway restart` (if supported)

### Clean Install Doesn't Clear Everything
**Symptom**: Old configuration persists after "clean" install
**Cause**: Backup not deleted or wrong directory cleared
**Solution**:
```bash
# Manual cleanup
rm -rf ~/.config/tek/
rm -f ~/tek/bin/tek
# Re-run installer
./install.sh
```

## Version Management

Versions follow semantic versioning: `MAJOR.MINOR.PATCH` (e.g., `0.0.34`)

- Version is defined in `package.json` at root
- Build script extracts version automatically
- Version is embedded in:
  - Tarball name: `tek-v0.0.34-macos.tar.gz`
  - CLI output: `tek --version`
  - Distribution directory: `tek-v0.0.34/`

To release a new version:
1. Update `package.json` version field
2. Run `bash scripts/build/build-release.sh`
3. Upload `.release/` contents to CDN

## Next Steps

- [ ] Set up CI/CD pipeline for automated releases
- [ ] Create macOS DMG builder for desktop app distribution
- [ ] Set up CDN infrastructure (S3, CloudFront, etc.)
- [ ] Create installer download page
- [ ] Set up update checker in CLI
- [ ] Create uninstaller script

