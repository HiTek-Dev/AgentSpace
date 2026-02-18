#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="$HOME/.config/tek"
RUNTIME="$CONFIG_DIR/runtime.json"

echo "WARNING: This will delete ALL Tek user data:"
echo "  - Configuration ($CONFIG_DIR/config.json)"
echo "  - Database ($CONFIG_DIR/tek.db)"
echo "  - Memory files ($CONFIG_DIR/memory/)"
echo "  - Runtime state ($CONFIG_DIR/runtime.json)"
echo ""

read -p "Type 'RESET' to confirm: " confirm
[ "$confirm" != "RESET" ] && echo "Cancelled." && exit 0

# Stop gateway if running
if [ -f "$RUNTIME" ]; then
  PID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$RUNTIME','utf-8')).pid)" 2>/dev/null || echo "")
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "Stopping gateway (PID $PID)..."
    kill "$PID"
    sleep 2
  fi
fi

# Remove all user data
rm -rf "$CONFIG_DIR"

echo ""
echo "All user data removed."
echo ""
echo "Note: Keychain credentials (API keys) are stored separately in the OS keychain."
echo "To remove them, run: tek keys remove <provider>"
echo ""
echo "To set up Tek from scratch, run: tek init"
