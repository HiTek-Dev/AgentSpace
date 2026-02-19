---
phase: quick
plan: 7
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/dist.sh
  - scripts/upload-cdn.sh
  - scripts/remote-install.sh
  - .env.example
autonomous: true
must_haves:
  truths:
    - "scripts/dist.sh builds all backend packages and Tauri app, producing dist/ artifacts"
    - "scripts/upload-cdn.sh uploads dist artifacts to BunnyCDN storage zone"
    - "scripts/remote-install.sh downloads from CDN and installs on ARM64 Mac"
  artifacts:
    - path: "scripts/dist.sh"
      provides: "Build pipeline producing dist/tek-backend-arm64.tar.gz, dist/Tek_0.1.0_aarch64.dmg, dist/version.json"
    - path: "scripts/upload-cdn.sh"
      provides: "CDN upload via curl PUT to BunnyCDN Storage API"
    - path: "scripts/remote-install.sh"
      provides: "Curl-pipe installer for ARM64 Mac"
    - path: ".env.example"
      provides: "Template with BunnyCDN variables"
  key_links:
    - from: "scripts/dist.sh"
      to: "scripts/upload-cdn.sh"
      via: "dist/ directory artifacts"
      pattern: "dist/tek-backend"
    - from: "scripts/upload-cdn.sh"
      to: "scripts/remote-install.sh"
      via: "CDN URLs"
      pattern: "tekpartner.b-cdn.net/tek/dist"
---

<objective>
Build a complete distribution pipeline: build script that creates dist artifacts (backend tarball + Tauri DMG), upload script to BunnyCDN, and a curl-based remote installer that downloads from CDN and installs on ARM64 Macs.

Purpose: Enable distributing Tek without requiring users to clone the repo and build from source.
Output: 4 shell scripts/config files for build, upload, and remote install.
</objective>

<execution_context>
@/Users/hitekmedia/.claude/get-shit-done/workflows/execute-plan.md
@/Users/hitekmedia/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@scripts/install.sh (existing install script - reuse build order, rsync excludes, memory seeding, bin symlink patterns)
@scripts/update.sh (existing update script - reuse build order)
@apps/desktop/src-tauri/tauri.conf.json (Tauri bundle config - product name "Tek", version "0.1.0", targets ["dmg", "app"])
@package.json (root package.json - version field, monorepo config)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create dist.sh build script and .env.example</name>
  <files>scripts/dist.sh, .env.example</files>
  <action>
Create `scripts/dist.sh` (chmod +x):

1. Set `set -euo pipefail`, derive `SOURCE_DIR` same as install.sh
2. Clean and create `dist/` and `dist/staging/` directories
3. Build all Node.js packages using EXACT same build order from install.sh:
   - core, db, gateway (pass 1, suppress errors), cli, gateway (pass 2), telegram
   - Run `pnpm install` first
4. Build Tauri desktop app:
   ```
   cd apps/desktop && pnpm tauri build --target aarch64-apple-darwin
   ```
5. Create backend staging directory mirroring install.sh rsync:
   - `rsync -a` from `$SOURCE_DIR/packages/` to `dist/staging/packages/` with SAME excludes as install.sh (src/, *.tsbuildinfo, .turbo/, memory-files/, .env, tsconfig*.json, vitest.config.*, biome.json)
   - Copy root files: package.json, pnpm-lock.yaml, pnpm-workspace.yaml to `dist/staging/`
   - Rsync root node_modules to `dist/staging/node_modules/`
   - Rsync per-package node_modules (core, db, cli, gateway, telegram) to `dist/staging/packages/$pkg/node_modules/`
   - Copy memory template files: `mkdir -p dist/staging/memory-files && cp packages/db/memory-files/*.md dist/staging/memory-files/`
6. Create tarball: `tar -czf dist/tek-backend-arm64.tar.gz -C dist/staging .`
7. Copy DMG from Tauri build output:
   ```
   cp apps/desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Tek_0.1.0_aarch64.dmg dist/
   ```
   (Use glob or ls to find exact DMG filename if version changes)
8. Create `dist/version.json`:
   ```json
   {
     "version": "<from package.json>",
     "commit": "<git rev-parse --short HEAD>",
     "date": "<ISO 8601 UTC>",
     "arch": "aarch64",
     "platform": "darwin"
   }
   ```
9. Print summary: file sizes and paths of all 3 artifacts
10. Clean up staging dir: `rm -rf dist/staging`

Create `.env.example` with:
```
# BunnyCDN Configuration
BUNNYCDN_API_KEY=
BUNNYCDN_STORAGE_ZONE=tekpartner
BUNNY_STORAGE_URL=https://storage.bunnycdn.com
BUNNY_PULL_ZONE_URL=https://tekpartner.b-cdn.net
BUNNY_UPLOAD_BASE_PATH=tek/dist
```
  </action>
  <verify>Run `bash -n scripts/dist.sh` to syntax-check. Verify .env.example exists with all 5 BunnyCDN variables.</verify>
  <done>dist.sh passes syntax check, .env.example contains BUNNYCDN_API_KEY, BUNNYCDN_STORAGE_ZONE, BUNNY_STORAGE_URL, BUNNY_PULL_ZONE_URL, BUNNY_UPLOAD_BASE_PATH</done>
</task>

<task type="auto">
  <name>Task 2: Create upload-cdn.sh and remote-install.sh</name>
  <files>scripts/upload-cdn.sh, scripts/remote-install.sh</files>
  <action>
**scripts/upload-cdn.sh** (chmod +x):

1. `set -euo pipefail`
2. Load .env from `SOURCE_DIR/.env` using `set -a; source .env; set +a` pattern
3. Validate required env vars are set: BUNNYCDN_API_KEY, BUNNYCDN_STORAGE_ZONE, BUNNY_STORAGE_URL, BUNNY_UPLOAD_BASE_PATH. Exit 1 with message if any missing.
4. Verify dist/ artifacts exist: tek-backend-arm64.tar.gz, version.json, and any .dmg file. Exit 1 if missing.
5. For each artifact (version.json, tek-backend-arm64.tar.gz, Tek_*.dmg), upload via:
   ```
   curl --fail -X PUT \
     -H "AccessKey: $BUNNYCDN_API_KEY" \
     -H "Content-Type: application/octet-stream" \
     --data-binary @"dist/$FILE" \
     "$BUNNY_STORAGE_URL/$BUNNYCDN_STORAGE_ZONE/$BUNNY_UPLOAD_BASE_PATH/$FILE"
   ```
6. Also upload `scripts/remote-install.sh` as `install.sh` to CDN (so users can curl it):
   ```
   curl --fail -X PUT \
     -H "AccessKey: $BUNNYCDN_API_KEY" \
     -H "Content-Type: application/octet-stream" \
     --data-binary @"scripts/remote-install.sh" \
     "$BUNNY_STORAGE_URL/$BUNNYCDN_STORAGE_ZONE/$BUNNY_UPLOAD_BASE_PATH/install.sh"
   ```
7. Print success with CDN URLs using BUNNY_PULL_ZONE_URL:
   ```
   echo "Artifacts uploaded to CDN:"
   echo "  $BUNNY_PULL_ZONE_URL/$BUNNY_UPLOAD_BASE_PATH/version.json"
   echo "  $BUNNY_PULL_ZONE_URL/$BUNNY_UPLOAD_BASE_PATH/tek-backend-arm64.tar.gz"
   echo "  $BUNNY_PULL_ZONE_URL/$BUNNY_UPLOAD_BASE_PATH/Tek_0.1.0_aarch64.dmg"
   echo ""
   echo "Install command:"
   echo "  curl -fsSL $BUNNY_PULL_ZONE_URL/$BUNNY_UPLOAD_BASE_PATH/install.sh | bash"
   ```

**scripts/remote-install.sh** (chmod +x):

This is the script end-users download and pipe to bash. Must be SELF-CONTAINED (no dependencies on repo).

1. `set -euo pipefail`
2. CDN base URL hardcoded: `CDN_BASE="https://tekpartner.b-cdn.net/tek/dist"`
3. Platform check: `uname -s` must be "Darwin" and `uname -m` must be "arm64". Exit with error message if not.
4. Check Node.js >= 22 (same check as install.sh). Exit with install instructions if missing.
5. Ask for install dir: `read -p "Install directory [$HOME/tek]: " INSTALL_DIR; INSTALL_DIR="${INSTALL_DIR:-$HOME/tek}"`
6. Create temp dir: `TMPDIR=$(mktemp -d)` with trap cleanup: `trap 'rm -rf "$TMPDIR"' EXIT`
7. Download artifacts with progress:
   ```
   echo "Downloading version info..."
   curl -fsSL "$CDN_BASE/version.json" -o "$TMPDIR/version.json"
   VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMPDIR/version.json','utf-8')).version)")
   echo "Installing Tek v$VERSION..."
   echo "Downloading backend packages..."
   curl -fSL --progress-bar "$CDN_BASE/tek-backend-arm64.tar.gz" -o "$TMPDIR/tek-backend-arm64.tar.gz"
   echo "Downloading desktop app..."
   curl -fSL --progress-bar "$CDN_BASE/Tek_0.1.0_aarch64.dmg" -o "$TMPDIR/Tek.dmg"
   ```
8. Extract backend:
   ```
   mkdir -p "$INSTALL_DIR"
   tar -xzf "$TMPDIR/tek-backend-arm64.tar.gz" -C "$INSTALL_DIR"
   ```
9. Create bin symlink (same as install.sh):
   ```
   mkdir -p "$INSTALL_DIR/bin"
   ln -sf "../packages/cli/dist/index.js" "$INSTALL_DIR/bin/tek"
   chmod +x "$INSTALL_DIR/packages/cli/dist/index.js"
   ```
10. Seed memory files (same as install.sh):
    ```
    CONFIG_DIR="$HOME/.config/tek"
    mkdir -p "$CONFIG_DIR/memory/daily"
    if [ ! -f "$CONFIG_DIR/memory/SOUL.md" ]; then
      cp "$INSTALL_DIR/memory-files/SOUL.md" "$CONFIG_DIR/memory/"
      cp "$INSTALL_DIR/memory-files/MEMORY.md" "$CONFIG_DIR/memory/"
      echo "Seeded default personality and memory files."
    fi
    ```
11. Write .version file (same format as dist.sh version.json but with installedAt):
    ```
    COMMIT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMPDIR/version.json','utf-8')).commit)")
    NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    cat > "$INSTALL_DIR/.version" << VEOF
    { "version": "$VERSION", "sourceCommit": "$COMMIT", "installedAt": "$NOW", "updatedAt": "$NOW", "nodeVersion": "$(node -v)" }
    VEOF
    ```
12. Install DMG:
    ```
    echo "Installing Tek desktop app..."
    MOUNT_POINT=$(hdiutil attach "$TMPDIR/Tek.dmg" -nobrowse -quiet | tail -1 | awk '{print $NF}')
    # Handle mount point that may have spaces
    MOUNT_POINT=$(hdiutil attach "$TMPDIR/Tek.dmg" -nobrowse -quiet | grep "/Volumes" | sed 's/.*\(\/Volumes\/.*\)/\1/')
    cp -R "$MOUNT_POINT/Tek.app" /Applications/
    hdiutil detach "$MOUNT_POINT" -quiet
    echo "Tek.app installed to /Applications/"
    ```
13. Print success with PATH instructions (same as install.sh):
    ```
    echo ""
    echo "Tek v$VERSION installed successfully!"
    echo ""
    echo "Add to PATH (add to ~/.zshrc):"
    echo "  export PATH=\"$INSTALL_DIR/bin:\$PATH\""
    echo ""
    echo "Then run:"
    echo "  tek init"
    ```
  </action>
  <verify>Run `bash -n scripts/upload-cdn.sh` and `bash -n scripts/remote-install.sh` to syntax-check both scripts.</verify>
  <done>Both scripts pass bash syntax check. upload-cdn.sh loads .env, validates vars, uploads 4 files (3 artifacts + install.sh) via curl PUT. remote-install.sh checks ARM64 Mac, downloads from CDN, extracts backend, mounts DMG, installs app, seeds memory, creates symlink.</done>
</task>

</tasks>

<verification>
- `bash -n scripts/dist.sh` exits 0
- `bash -n scripts/upload-cdn.sh` exits 0
- `bash -n scripts/remote-install.sh` exits 0
- `.env.example` contains all 5 BunnyCDN variables
- All 3 scripts are executable (chmod +x)
- dist.sh reuses exact build order from install.sh
- remote-install.sh is self-contained (no repo dependencies, hardcoded CDN URL)
</verification>

<success_criteria>
- 4 files created: scripts/dist.sh, scripts/upload-cdn.sh, scripts/remote-install.sh, .env.example
- Build pipeline: dist.sh builds packages + Tauri, creates tarball + copies DMG + writes version.json
- Upload pipeline: upload-cdn.sh loads .env, uploads artifacts to BunnyCDN via curl PUT
- Install pipeline: remote-install.sh is a standalone curl-pipe installer for ARM64 Mac that downloads from CDN, extracts, installs DMG, seeds config
</success_criteria>

<output>
After completion, create `.planning/quick/7-build-distribution-pipeline-build-script/7-SUMMARY.md`
</output>
