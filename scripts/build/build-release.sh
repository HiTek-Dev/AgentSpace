#!/bin/bash
set -e

# Build Tek Release Package
# Creates distributable archives: tek-vX.Y.Z-macos.tar.gz and tek-vX.Y.Z.dmg

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION=$(grep '"version"' "$REPO_DIR/package.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
BUILD_DIR="$REPO_DIR/.build"
RELEASE_DIR="$REPO_DIR/.release"
INSTALL_DIR="$BUILD_DIR/tek-v$VERSION"

echo "🔨 Building Tek v$VERSION"
echo ""

# Step 1: Clean and build
echo "Step 1: Building source code..."
rm -rf "$BUILD_DIR" "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
cd "$REPO_DIR"
pnpm build
echo "✓ Build complete"
echo ""

# Step 2: Create distribution directory structure
echo "Step 2: Creating distribution package..."
mkdir -p "$INSTALL_DIR/packages"
mkdir -p "$INSTALL_DIR/apps"
mkdir -p "$INSTALL_DIR/bin"

# Copy packages (only dist and package.json, skip node_modules)
for pkg in cli core db gateway telegram; do
  mkdir -p "$INSTALL_DIR/packages/$pkg"
  cp -r "$REPO_DIR/packages/$pkg/dist" "$INSTALL_DIR/packages/$pkg/"
  cp "$REPO_DIR/packages/$pkg/package.json" "$INSTALL_DIR/packages/$pkg/"
done

# Copy apps (desktop)
mkdir -p "$INSTALL_DIR/apps/desktop"
cp -r "$REPO_DIR/apps/desktop/dist" "$INSTALL_DIR/apps/desktop/"

# Copy root pnpm files (for dependency resolution during installation)
cp "$REPO_DIR/pnpm-lock.yaml" "$INSTALL_DIR/"
cp "$REPO_DIR/package.json" "$INSTALL_DIR/"
cp "$REPO_DIR/pnpm-workspace.yaml" "$INSTALL_DIR/" 2>/dev/null || true

# Copy installer script
cp "$REPO_DIR/scripts/install/install.sh" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/install.sh"

# Create version file
echo "$VERSION" > "$INSTALL_DIR/.version"

# Create README
cat > "$INSTALL_DIR/README.md" << 'EOF'
# Tek v{VERSION}

Self-hosted AI agent platform with secure credential management.

## Installation

Run the installer:
```bash
./install.sh
```

This will:
- Check for existing installation
- Handle updates or clean installs
- Set up CLI in ~/.local/bin or /usr/local/bin
- Configure ~/.config/tek

## What's Included

- **CLI**: Command-line interface (`tek` command)
- **Gateway**: WebSocket server for agents
- **Telegram**: Telegram bot integration
- **Desktop**: macOS desktop application

## Next Steps

After installation:
```bash
tek init          # Set up API keys and configuration
tek gateway       # Start the gateway
tek chat          # Start chatting with agents
```

For full documentation, visit: https://github.com/anthropics/tek
EOF

sed -i '' "s/{VERSION}/$VERSION/g" "$INSTALL_DIR/README.md"

echo "✓ Distribution package created"
echo ""

# Step 3: Create tarball
echo "Step 3: Creating tarball..."
cd "$BUILD_DIR"
tar -czf "$RELEASE_DIR/tek-v$VERSION-macos.tar.gz" "tek-v$VERSION/"
TARBALL_SIZE=$(du -h "$RELEASE_DIR/tek-v$VERSION-macos.tar.gz" | cut -f1)
echo "✓ Tarball: tek-v$VERSION-macos.tar.gz ($TARBALL_SIZE)"
echo ""

# Step 4: Create DMG for desktop app (stub for now)
echo "Step 4: Preparing desktop app..."
echo "⚠ Desktop DMG creation requires macOS tools (hdiutil)"
echo "   Skipping DMG for now - tarball contains all files"
echo ""

# Step 5: Generate checksums
echo "Step 5: Generating checksums..."
cd "$RELEASE_DIR"
shasum -a 256 "tek-v$VERSION-macos.tar.gz" > "tek-v$VERSION-macos.sha256"
cat "tek-v$VERSION-macos.sha256"
echo ""

echo "✅ Build complete!"
echo ""
echo "Release files in: $RELEASE_DIR"
echo ""
echo "To test locally:"
echo "  tar -xzf $RELEASE_DIR/tek-v$VERSION-macos.tar.gz"
echo "  cd tek-v$VERSION"
echo "  ./install.sh"
