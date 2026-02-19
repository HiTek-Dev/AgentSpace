#!/usr/bin/env bash
set -euo pipefail

# Tek CDN Upload Script
# Uploads dist/ artifacts to BunnyCDN storage zone.
# Requires .env with BunnyCDN credentials.
# Usage: scripts/upload-cdn.sh

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Tek CDN Uploader"
echo "================"
echo ""

# 1. Load .env
if [ ! -f "$SOURCE_DIR/.env" ]; then
  echo "Error: .env file not found at $SOURCE_DIR/.env"
  echo "Copy .env.example to .env and fill in your BunnyCDN API key."
  exit 1
fi
set -a
# shellcheck source=/dev/null
source "$SOURCE_DIR/.env"
set +a

# 2. Validate required env vars
MISSING=""
for var in BUNNYCDN_API_KEY BUNNYCDN_STORAGE_ZONE BUNNY_STORAGE_URL BUNNY_UPLOAD_BASE_PATH; do
  if [ -z "${!var:-}" ]; then
    MISSING="$MISSING $var"
  fi
done
if [ -n "$MISSING" ]; then
  echo "Error: Missing required environment variables:$MISSING"
  echo "Check your .env file."
  exit 1
fi

# 3. Verify dist artifacts exist
DIST_DIR="$SOURCE_DIR/dist"
if [ ! -f "$DIST_DIR/tek-backend-arm64.tar.gz" ]; then
  echo "Error: dist/tek-backend-arm64.tar.gz not found. Run scripts/dist.sh first."
  exit 1
fi
if [ ! -f "$DIST_DIR/version.json" ]; then
  echo "Error: dist/version.json not found. Run scripts/dist.sh first."
  exit 1
fi
DMG_FILE=$(ls "$DIST_DIR/"*.dmg 2>/dev/null | head -1)
if [ -z "$DMG_FILE" ]; then
  echo "Error: No .dmg file found in dist/. Run scripts/dist.sh first."
  exit 1
fi
DMG_NAME=$(basename "$DMG_FILE")

# 4. Upload artifacts
UPLOAD_BASE="$BUNNY_STORAGE_URL/$BUNNYCDN_STORAGE_ZONE/$BUNNY_UPLOAD_BASE_PATH"

echo "Uploading version.json..."
curl --fail -X PUT \
  -H "AccessKey: $BUNNYCDN_API_KEY" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"$DIST_DIR/version.json" \
  "$UPLOAD_BASE/version.json"
echo " OK"

echo "Uploading tek-backend-arm64.tar.gz..."
curl --fail -X PUT \
  -H "AccessKey: $BUNNYCDN_API_KEY" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"$DIST_DIR/tek-backend-arm64.tar.gz" \
  "$UPLOAD_BASE/tek-backend-arm64.tar.gz"
echo " OK"

echo "Uploading $DMG_NAME..."
curl --fail -X PUT \
  -H "AccessKey: $BUNNYCDN_API_KEY" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"$DMG_FILE" \
  "$UPLOAD_BASE/$DMG_NAME"
echo " OK"

# 5. Upload remote installer script
echo "Uploading install.sh..."
curl --fail -X PUT \
  -H "AccessKey: $BUNNYCDN_API_KEY" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"$SOURCE_DIR/scripts/remote-install.sh" \
  "$UPLOAD_BASE/install.sh"
echo " OK"

# 6. Print success
PULL_ZONE="${BUNNY_PULL_ZONE_URL:-https://tekpartner.b-cdn.net}"
echo ""
echo "Artifacts uploaded to CDN:"
echo "  $PULL_ZONE/$BUNNY_UPLOAD_BASE_PATH/version.json"
echo "  $PULL_ZONE/$BUNNY_UPLOAD_BASE_PATH/tek-backend-arm64.tar.gz"
echo "  $PULL_ZONE/$BUNNY_UPLOAD_BASE_PATH/$DMG_NAME"
echo "  $PULL_ZONE/$BUNNY_UPLOAD_BASE_PATH/install.sh"
echo ""
echo "Install command:"
echo "  curl -fsSL $PULL_ZONE/$BUNNY_UPLOAD_BASE_PATH/install.sh | bash"
