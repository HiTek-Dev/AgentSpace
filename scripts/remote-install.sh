#!/usr/bin/env bash
set -euo pipefail

# Tek Remote Installer
# Downloads pre-built artifacts from CDN and installs on ARM64 Mac.
# Usage: curl -fsSL https://tekpartner.b-cdn.net/tek/dist/install.sh | bash

CDN_BASE="https://tekpartner.b-cdn.net/tek/dist"

echo "Tek Installer"
echo "============="
echo ""

# 1. Platform check
OS=$(uname -s)
ARCH=$(uname -m)
if [ "$OS" != "Darwin" ]; then
  echo "Error: Tek currently supports macOS only. Detected: $OS"
  exit 1
fi
if [ "$ARCH" != "arm64" ]; then
  echo "Error: Tek currently supports Apple Silicon (ARM64) only. Detected: $ARCH"
  exit 1
fi

# 2. Check Node.js >= 22
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is not installed."
  echo "Install Node.js 22 or later: https://nodejs.org/"
  exit 1
fi
node -e "if(parseInt(process.version.slice(1))<22){console.error('Error: Node.js 22+ required, found '+process.version);process.exit(1)}"
echo "Node.js $(node -v) OK"

# 3. Ask for install directory
if [ -t 0 ]; then
  printf "Install directory [%s/tek]: " "$HOME"
  read -r INSTALL_DIR
  INSTALL_DIR="${INSTALL_DIR:-$HOME/tek}"
else
  INSTALL_DIR="$HOME/tek"
fi

echo ""
echo "Installing to: $INSTALL_DIR"

# 4. Create temp dir with cleanup trap
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# 5. Download artifacts
echo ""
echo "Downloading version info..."
curl -fsSL "$CDN_BASE/version.json" -o "$TMPDIR/version.json"
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMPDIR/version.json','utf-8')).version)")
echo "Installing Tek v$VERSION..."

echo "Downloading backend packages..."
curl -fSL --progress-bar "$CDN_BASE/tek-backend-arm64.tar.gz" -o "$TMPDIR/tek-backend-arm64.tar.gz"

echo "Downloading desktop app..."
curl -fSL --progress-bar "$CDN_BASE/Tek_0.1.0_aarch64.dmg" -o "$TMPDIR/Tek.dmg"

# 6. Extract backend
echo ""
echo "Extracting backend..."
mkdir -p "$INSTALL_DIR"
tar -xzf "$TMPDIR/tek-backend-arm64.tar.gz" -C "$INSTALL_DIR"

# 7. Create bin symlink
mkdir -p "$INSTALL_DIR/bin"
ln -sf "../packages/cli/dist/index.js" "$INSTALL_DIR/bin/tek"
chmod +x "$INSTALL_DIR/packages/cli/dist/index.js"

# 8. Seed memory files
CONFIG_DIR="$HOME/.config/tek"
mkdir -p "$CONFIG_DIR/memory/daily"
if [ ! -f "$CONFIG_DIR/memory/SOUL.md" ]; then
  cp "$INSTALL_DIR/memory-files/SOUL.md" "$CONFIG_DIR/memory/"
  cp "$INSTALL_DIR/memory-files/MEMORY.md" "$CONFIG_DIR/memory/"
  echo "Seeded default personality and memory files."
fi

# 9. Write .version file
COMMIT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMPDIR/version.json','utf-8')).commit)")
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$INSTALL_DIR/.version" <<VEOF
{
  "version": "$VERSION",
  "sourceCommit": "$COMMIT",
  "installedAt": "$NOW",
  "updatedAt": "$NOW",
  "nodeVersion": "$(node -v)"
}
VEOF

# 10. Install DMG
echo ""
echo "Installing Tek desktop app..."
MOUNT_POINT=$(hdiutil attach "$TMPDIR/Tek.dmg" -nobrowse -quiet | grep "/Volumes" | sed 's/.*\(\/Volumes\/.*\)/\1/')
if [ -z "$MOUNT_POINT" ]; then
  echo "Warning: Could not mount DMG. You can install the desktop app manually from $TMPDIR/Tek.dmg"
else
  cp -R "$MOUNT_POINT/Tek.app" /Applications/
  hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
  echo "Tek.app installed to /Applications/"
fi

# 11. Print success
echo ""
echo "Tek v$VERSION installed successfully!"
echo ""
echo "Add to PATH (add to ~/.zshrc):"
echo "  export PATH=\"$INSTALL_DIR/bin:\$PATH\""
echo ""
echo "Then run:"
echo "  tek init"
