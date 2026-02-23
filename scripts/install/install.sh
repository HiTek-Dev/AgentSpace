#!/bin/bash
set -e

# Tek Installer
# Handles clean installs and updates with proper data preservation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION=$(cat "$SCRIPT_DIR/.version")
INSTALL_BASE_DIR="${HOME}/.local/tek"
CONFIG_DIR="${HOME}/.config/tek"
OLD_INSTALL_DIR="${HOME}/tek"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Tek v${VERSION} Installer${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check for existing installation
if [ -f "$CONFIG_DIR/install-path" ]; then
  EXISTING_INSTALL=$(cat "$CONFIG_DIR/install-path")
  echo -e "${YELLOW}Found existing installation at: $EXISTING_INSTALL${NC}"
  echo ""
  echo "Choose an option:"
  echo "  1) Update (preserve configuration and keys)"
  echo "  2) Clean install (clear all config and keys)"
  echo "  3) Cancel"
  echo ""
  read -p "Enter choice (1-3): " CHOICE

  case $CHOICE in
    1)
      echo -e "${BLUE}Updating...${NC}"
      BACKUP_DIR="$CONFIG_DIR/.backup-$(date +%s)"
      mkdir -p "$BACKUP_DIR"
      echo "Backing up config to: $BACKUP_DIR"
      cp -r "$CONFIG_DIR"/* "$BACKUP_DIR/" 2>/dev/null || true
      INSTALL_MODE="update"
      ;;
    2)
      echo -e "${YELLOW}Clean install mode${NC}"
      echo ""
      read -p "Delete ALL configuration and keys? (type 'DELETE' to confirm): " CONFIRM
      if [ "$CONFIRM" = "DELETE" ]; then
        rm -rf "$CONFIG_DIR"
        if [ -f "$OLD_INSTALL_DIR/bin/tek" ]; then
          rm -f "$OLD_INSTALL_DIR/bin/tek"
        fi
        INSTALL_MODE="clean"
        echo -e "${GREEN}✓ Configuration cleared${NC}"
      else
        echo "Cancelled."
        exit 0
      fi
      ;;
    3)
      echo "Cancelled."
      exit 0
      ;;
    *)
      echo "Invalid choice."
      exit 1
      ;;
  esac
else
  INSTALL_MODE="clean"
  echo -e "${BLUE}Fresh install${NC}"
fi

echo ""

# Install files
echo "Installing files..."
mkdir -p "$INSTALL_BASE_DIR"
cp -r "$SCRIPT_DIR"/* "$INSTALL_BASE_DIR/" 2>/dev/null || true
rm -f "$INSTALL_BASE_DIR/install.sh" "$INSTALL_BASE_DIR/README.md"

echo -e "${GREEN}✓ Files installed to: $INSTALL_BASE_DIR${NC}"

# Install dependencies
echo "Installing dependencies..."
if command -v pnpm &> /dev/null; then
  echo "Using pnpm to install dependencies..."
  cd "$INSTALL_BASE_DIR"
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  cd - > /dev/null
  echo -e "${GREEN}✓ Dependencies installed${NC}"
else
  echo -e "${YELLOW}⚠ pnpm not found in PATH - skipping dependency installation${NC}"
  echo "   To install dependencies manually later, run:"
  echo "   cd $INSTALL_BASE_DIR && pnpm install"
fi

# Create binary directory
mkdir -p "$OLD_INSTALL_DIR/bin"

# Set up symlink
ln -sf "$INSTALL_BASE_DIR/packages/cli/dist/index.js" "$OLD_INSTALL_DIR/bin/tek"
chmod +x "$INSTALL_BASE_DIR/packages/cli/dist/index.js"
echo -e "${GREEN}✓ CLI symlink: $OLD_INSTALL_DIR/bin/tek${NC}"

# Set up PATH entry
if [ ! -f "${HOME}/.zshrc" ]; then
  touch "${HOME}/.zshrc"
fi

if ! grep -q "$OLD_INSTALL_DIR/bin" "${HOME}/.zshrc"; then
  cat >> "${HOME}/.zshrc" << EOF

# Tek AI Agent Gateway
export PATH="$OLD_INSTALL_DIR/bin:\$PATH"
EOF
  echo -e "${GREEN}✓ PATH configured in ~/.zshrc${NC}"
fi

# Record installation path
mkdir -p "$CONFIG_DIR"
echo "$INSTALL_BASE_DIR" > "$CONFIG_DIR/install-path"

echo ""

# Next steps
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""

if [ "$INSTALL_MODE" = "update" ]; then
  echo "Configuration preserved. Reload your shell and test:"
  echo "  exec \$SHELL"
  echo "  tek --version"
else
  echo "Run this to set up:"
  echo "  exec \$SHELL              # Reload shell"
  echo "  tek init                  # Configure API keys"
  echo "  tek gateway               # Start gateway"
  echo "  tek chat                  # Start chatting"
fi

echo ""
echo "For help:"
echo "  tek --help"
echo "  tek gateway logs           # View gateway logs"
