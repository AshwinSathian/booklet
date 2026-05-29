#!/usr/bin/env bash
# Rebuild and restart all Readable services from current working tree.
# Does NOT git-pull — use deploy-local.sh for that.
# Called automatically by the pre-push hook and manually when needed.
set -euo pipefail

REPO="/Users/ashwinsathian/Documents/Personal/readable/readable"
LOG_DIR="$HOME/.readable-deploy-logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/redeploy-$(date +%Y%m%d-%H%M%S).log"

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
log "── Installing root dependencies ──────────────────────"
run "npm ci --prefer-offline"

echo ""
log "── Installing MCP server dependencies ────────────────"
run "npm ci --prefix mcp-server --prefer-offline"

echo ""
log "── Building Next.js (production) ────────────────────"
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
bash "$REPO/scripts/health-check.sh" 2>&1 | tee -a "$LOG"

echo ""
log "=== Redeploy complete ==="
log "    Full log: $LOG"
