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
log "── Installing root dependencies ──────────────────────"
run "npm ci --prefer-offline"

echo ""
log "── Installing MCP server dependencies ────────────────"
run "npm ci --prefix mcp-server --prefer-offline"

echo ""
log "── Building Next.js (production) ────────────────────"
run "NODE_ENV=production npm run build"

echo ""
log "── Restarting PM2 processes ──────────────────────────"
run "pm2 restart readable-app --update-env"
run "pm2 restart readable-mcp --update-env"
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
