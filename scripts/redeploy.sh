#!/usr/bin/env bash
# Rebuild and restart all Readable services from current working tree.
# Does NOT git-pull — use deploy-local.sh for that.
# Called automatically by the pre-push hook and manually when needed.
#
# Rollback: before building, the current build output ($BUILD_DIR) is copied
# aside to $BUILD_DIR_BACKUP. We copy rather than move so the PM2 process
# still serving the old build never sees $BUILD_DIR disappear mid-request
# during the build. If the post-reload health check fails, we restore that
# backup over the broken build, reload PM2 again so the last-known-good build
# serves traffic, and re-run health checks once more to confirm the rollback
# itself is healthy. The script still exits non-zero on a failed deploy (even
# after a successful rollback) so the pre-push hook reports the push as
# having failed to deploy — only the live-traffic outcome changes.
set -euo pipefail

REPO="/Users/ashwinsathian/Documents/Personal/readable/readable"
LOG_DIR="$HOME/.readable-deploy-logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/redeploy-$(date +%Y%m%d-%H%M%S).log"

# Next.js build output dir — next.config.ts has no custom `distDir`, so this
# is the framework default. Update this if that ever changes.
BUILD_DIR=".next"
BUILD_DIR_BACKUP=".next.previous"

# Dual-sink: timestamps to log file, clean output to terminal
log() {
  local msg="[$(date +%H:%M:%S)] $*"
  echo "$msg" | tee -a "$LOG"
}
run() {
  # Run a command, stream output to both sinks, fail fast on error
  log "$ $*"
  eval "$*" 2>&1 | tee -a "$LOG"
}

cd "$REPO"
log "=== Readable redeploy started ==="
log "    Commit: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
log "    Log:    $LOG"

echo ""
log "── Syncing pm2-startup.sh to ~/.readable/ ────────────"
# launchd reads from ~/.readable/ (not ~/Documents, which TCC blocks).
# Keep the deployed copy in sync with the repo on every redeploy.
if [[ -f "$REPO/scripts/pm2-startup.sh" ]]; then
  cp "$REPO/scripts/pm2-startup.sh" "$HOME/.readable/pm2-startup.sh"
  chmod +x "$HOME/.readable/pm2-startup.sh"
  xattr -d com.apple.provenance "$HOME/.readable/pm2-startup.sh" 2>/dev/null || true
fi

echo ""
log "── Installing dependencies (npm workspaces — one install covers"
log "   the root app and mcp-server/packages/*, see"
log "   PLAN-backend-auth-migration.md) ────────────────────"
run "npm ci --prefer-offline"

echo ""
log "── Backing up previous build output ──────────────────"
# Clear any stale backup left over from a previous failed rollback attempt.
rm -rf "$BUILD_DIR_BACKUP"
if [[ -d "$BUILD_DIR" ]]; then
  run "cp -a '$BUILD_DIR' '$BUILD_DIR_BACKUP'"
  HAVE_PREVIOUS_BUILD=true
else
  log "    No existing $BUILD_DIR — nothing to back up (first deploy?)"
  HAVE_PREVIOUS_BUILD=false
fi

echo ""
log "── Building Next.js (production) ────────────────────"
# If this fails, `set -e` stops the script right here — PM2 was never
# touched, so there's nothing to roll back and no point reloading anything.
run "NODE_ENV=production npm run build"

echo ""
log "── Reloading PM2 processes from ecosystem.config.js ──"
# `pm2 reload ecosystem.config.js --update-env` re-reads the config file
# (picks up any env changes) and performs a zero-downtime reload for each
# process. Start processes that aren't registered yet.
if pm2 jlist 2>/dev/null | python3 -c \
    "import sys,json; procs=json.load(sys.stdin); exit(0 if any(p['name']=='readable-app' for p in procs) else 1)" 2>/dev/null; then
  run "pm2 reload ecosystem.config.js --update-env"
else
  log "readable-app not found in PM2 — starting from ecosystem.config.js"
  run "pm2 start ecosystem.config.js"
fi

# Ensure readable-mcp is registered in PM2 (it may be missing after a fresh setup)
if ! pm2 jlist 2>/dev/null | python3 -c \
    "import sys,json; procs=json.load(sys.stdin); exit(0 if any(p['name']=='readable-mcp' for p in procs) else 1)" 2>/dev/null; then
  log "readable-mcp not found in PM2 — starting it now"
  run "pm2 start ecosystem.config.js --only readable-mcp"
fi

run "pm2 save"

echo ""
log "── Waiting 6 s for processes to settle ──────────────"
sleep 6

echo ""
log "── Running health checks ─────────────────────────────"
# From here on, PM2 is running the new build, so a failure needs a rollback
# rather than an immediate `set -e` exit — wrap in `if` to capture the
# pipeline's exit status without tripping set -e.
HEALTH_OK=true
if ! bash "$REPO/scripts/health-check.sh" 2>&1 | tee -a "$LOG"; then
  HEALTH_OK=false
fi

if [[ "$HEALTH_OK" == "true" ]]; then
  echo ""
  log "── Cleaning up build backup ──────────────────────────"
  rm -rf "$BUILD_DIR_BACKUP"

  echo ""
  log "=== Redeploy complete ==="
  log "    Full log: $LOG"
  exit 0
fi

# ── Health check failed — roll back to the last-known-good build ───────────
echo ""
log "── Health check FAILED — rolling back to previous build ──────────────"

if [[ "$HAVE_PREVIOUS_BUILD" != "true" ]]; then
  log "No previous build to roll back to (this looks like the first deploy)."
  log "Broken build remains live — manual intervention required."
  log "=== Redeploy FAILED — no rollback possible ==="
  log "    Full log: $LOG"
  exit 1
fi

run "rm -rf '$BUILD_DIR'"
run "mv '$BUILD_DIR_BACKUP' '$BUILD_DIR'"

echo ""
log "── Reloading PM2 with restored build ──────────────────"
run "pm2 reload ecosystem.config.js --update-env"
run "pm2 save"

echo ""
log "── Waiting 6 s for processes to settle ──────────────"
sleep 6

echo ""
log "── Re-running health checks after rollback ───────────"
ROLLBACK_HEALTH_OK=true
if ! bash "$REPO/scripts/health-check.sh" 2>&1 | tee -a "$LOG"; then
  ROLLBACK_HEALTH_OK=false
fi

echo ""
if [[ "$ROLLBACK_HEALTH_OK" == "true" ]]; then
  log "Rollback successful — previous build is live and passing health checks."
  log "=== Redeploy FAILED (rolled back to last-known-good build) ==="
  log "    Full log: $LOG"
else
  log "=============================================================="
  log "  ROLLBACK ALSO FAILED — manual intervention required"
  log "=============================================================="
  log "    Full log: $LOG"
fi
exit 1
