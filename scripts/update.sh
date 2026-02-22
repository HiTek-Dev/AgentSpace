#!/usr/bin/env bash
set -euo pipefail

# Tek Update Script
# Now a thin wrapper around install.sh, which handles both fresh installs and updates.
# Usage: scripts/update.sh [INSTALL_DIR]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/install.sh" "$@"
