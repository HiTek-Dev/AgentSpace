#!/usr/bin/env bash
set -euo pipefail

# Tek Development Installation Script
# Sets up a development installation of Tek for local testing and development.
# This is different from production installations — it maintains the development
# environment but allows proper uninstall and clean builds.
#
# Usage: scripts/dev-install.sh
# Note: This script is for developers working on the Tek codebase, not end users.

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_DIR="${HOME}/.local/tek"
CONFIG_DIR="${HOME}/.config/tek"

echo "Tek Development Installation"
echo "============================"
echo "Source:      $SOURCE_DIR"
echo "Install Dir: $INSTALL_DIR"
echo "Config Dir:  $CONFIG_DIR"
echo ""

# 1. Build from source
echo "Building from source..."
cd "$SOURCE_DIR" && npm run build
echo "✓ Build complete"
echo ""

# 2. Create config directory
echo "Setting up config directory..."
mkdir -p "$CONFIG_DIR"
echo "✓ Config directory created"
echo ""

# 3. Record installation path (required for uninstall to work)
echo "Recording installation path..."
echo "$INSTALL_DIR" > "$CONFIG_DIR/install-path"
echo "✓ Installation path recorded at $CONFIG_DIR/install-path"
echo ""

# 4. Sync packages to local installation
echo "Syncing packages to local installation..."
rsync -a --delete \
  --exclude='src/' \
  --exclude='*.tsbuildinfo' \
  --exclude='.turbo/' \
  --exclude='memory-files/' \
  --exclude='.env' \
  --exclude='tsconfig*.json' \
  --exclude='vitest.config.*' \
  --exclude='biome.json' \
  "$SOURCE_DIR/packages/" "$INSTALL_DIR/packages/"
echo "✓ Packages synced"
echo ""

# 5. Verify installation
if [ -d "$INSTALL_DIR/packages/cli/dist" ] && [ -d "$INSTALL_DIR/packages/gateway/dist" ]; then
  echo "✓ Development installation complete!"
  echo ""
  echo "Next steps:"
  echo "  1. Start gateway:    tek gateway start"
  echo "  2. Start chatting:   tek chat"
  echo "  3. Check status:     tek gateway status"
  echo ""
  echo "To uninstall (clean everything):"
  echo "  tek uninstall"
else
  echo "✗ Installation verification failed"
  exit 1
fi
