#!/usr/bin/env bash
# Rebuild and restart all Booklet services from current working tree.
# Does NOT git-pull — use deploy-local.sh for that.
# Called automatically by the pre-push hook and manually when needed.
#
# What it covers, in order:
#   1. npm ci for the root app and every workspace.
#   2. A copy of every build output, for rollback.
#   3. A build of every workspace that has one (booklet-api-client, which the
#      MCP server loads from dist/, and booklet-cli, which the verify suite
#      runs), then the Next.js app.
#   4. PM2 reload of booklet-app and booklet-mcp.
#   5. scripts/health-check.sh. A failure here rolls the builds back.
#   6. Both production-verify suites against the live site. A failure here
#      does not roll back (see below) and exits 2. SKIP_VERIFY=1 skips them.
#
# Rollback: before building, each build output is copied aside. We copy
# rather than move so the PM2 process still serving the old build never sees
# it disappear mid-request. If the post-reload health check fails, the copies
# are restored, PM2 is reloaded so the last-known-good build serves traffic,
# and the health check runs once more to confirm the rollback is healthy. The
# script still exits non-zero on a failed deploy (even after a successful
# rollback) so the pre-push hook reports the push as having failed to deploy.
#
# What a rollback cannot cover: the MCP server runs from mcp-server/src, not
# from a build, and the working tree stays at the new commit. The log names
# the commit that was live before, to check out by hand if the MCP server is
# what broke. And data: a migration run by the new build is not undone.
#
# A failed verify suite does not roll back for the second reason, and because
# the suites can fail on things a rollback would not fix (the tunnel, npm).
set -euo pipefail

# Production runs on Node 24 (see .nvmrc). Put that install first on PATH so
# npm, the build and anything PM2 spawns all use it, whatever Node the
# calling shell has active.
NODE_BIN="$HOME/.nvm/versions/node/v24.19.0/bin"
if [[ ! -x "$NODE_BIN/node" ]]; then
  echo "Node 24 not found at $NODE_BIN. Install it (nvm install 24.19.0) or update NODE_BIN here, in scripts/redeploy.sh, scripts/pm2-startup.sh, .githooks/pre-push and ecosystem.config.js." >&2
  exit 1
fi
export PATH="$NODE_BIN:$PATH"

source "$(dirname "${BASH_SOURCE[0]}")/lib/pm2-path.sh"

REPO="/Users/ashwinsathian/Documents/Personal/booklet"
LOG_DIR="$HOME/.booklet-deploy-logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/redeploy-$(date +%Y%m%d-%H%M%S).log"

# Every build output a deploy replaces. `.next` is Next.js's default
# (next.config.ts sets no `distDir`); the two dist/ folders come from tsup.
BUILD_OUTPUTS=(".next" "packages/shared/dist" "packages/cli/dist")
# The commit of the last deploy that passed its health check.
DEPLOYED_COMMIT_FILE="$HOME/.booklet/deployed-commit"

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
log "=== Booklet redeploy started ==="
log "    Commit: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
log "    Log:    $LOG"

echo ""
log "── Syncing pm2-startup.sh to ~/.booklet/ ────────────"
# launchd reads from ~/.booklet/ (not ~/Documents, which TCC blocks).
# Keep the deployed copy in sync with the repo on every redeploy.
if [[ -f "$REPO/scripts/pm2-startup.sh" ]]; then
  if ! cmp -s "$REPO/scripts/pm2-startup.sh" "$HOME/.booklet/pm2-startup.sh"; then
    cp "$REPO/scripts/pm2-startup.sh" "$HOME/.booklet/pm2-startup.sh"
    chmod +x "$HOME/.booklet/pm2-startup.sh"
    xattr -d com.apple.provenance "$HOME/.booklet/pm2-startup.sh" 2>/dev/null || true
    # The watchdog is a long-running bash loop: it keeps running the copy
    # it started with until it is restarted. It only supervises; restarting
    # it does not touch the apps.
    if launchctl kickstart -k "gui/$(id -u)/com.booklet.pm2" 2>/dev/null; then
      log "    pm2-startup.sh changed — watchdog restarted"
    else
      log "    pm2-startup.sh changed — could not restart com.booklet.pm2; it runs the old copy until next login"
    fi
  fi
fi

echo ""
log "── Installing dependencies (npm workspaces — one install covers"
log "   the root app and mcp-server/packages/*) ───────────"
run "npm ci --prefer-offline"

echo ""
log "── Backing up previous build outputs ─────────────────"
# Before anything is built, so the copies are what is live right now.
HAVE_PREVIOUS_BUILD=false
for out in "${BUILD_OUTPUTS[@]}"; do
  # Clear any stale backup left over from a previous failed rollback attempt.
  rm -rf "$out.previous"
  if [[ -d "$out" ]]; then
    run "cp -a '$out' '$out.previous'"
    [[ "$out" == ".next" ]] && HAVE_PREVIOUS_BUILD=true
  else
    log "    No existing $out — nothing to back up"
  fi
done

echo ""
log "── Building packages/shared (booklet-api-client) ─────"
# mcp-server imports the *built* dist/ output of this workspace package
# (not its TS source), so it must be built before mcp-server can start.
# npm ci does not do this automatically — only next build (below) is wired
# into the root "build" script. A checkout that's never had this built
# locally will crash booklet-mcp with MODULE_NOT_FOUND on dist/index.cjs.
run "npm run build --workspace=packages/shared"

echo ""
log "── Building every other workspace that has a build ───"
# booklet-cli today; a workspace added later is built without this script
# being edited, and one with no build script (mcp-server runs from source)
# is skipped. Not `--workspaces`: that would build packages/shared a second
# time, wiping the dist/ the live MCP server loads for longer than needed.
# The verify suite at the end runs the CLI from packages/cli/dist, so a
# stale build there fails it.
OTHER_WORKSPACES=$(npm query .workspace | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    for (const w of JSON.parse(s)) if (w.location !== "packages/shared" && w.scripts && w.scripts.build) console.log(w.location);
  });')
for ws in $OTHER_WORKSPACES; do
  run "npm run build --workspace=$ws"
done

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
    "import sys,json; procs=json.load(sys.stdin); exit(0 if any(p['name']=='booklet-app' for p in procs) else 1)" 2>/dev/null; then
  run "pm2 reload ecosystem.config.js --update-env"
else
  log "booklet-app not found in PM2 — starting from ecosystem.config.js"
  run "pm2 start ecosystem.config.js"
fi

# Ensure booklet-mcp is registered in PM2 (it may be missing after a fresh setup)
if ! pm2 jlist 2>/dev/null | python3 -c \
    "import sys,json; procs=json.load(sys.stdin); exit(0 if any(p['name']=='booklet-mcp' for p in procs) else 1)" 2>/dev/null; then
  log "booklet-mcp not found in PM2 — starting it now"
  run "pm2 start ecosystem.config.js --only booklet-mcp"
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
  log "── Cleaning up build backups ─────────────────────────"
  for out in "${BUILD_OUTPUTS[@]}"; do rm -rf "$out.previous"; done
  git rev-parse HEAD > "$DEPLOYED_COMMIT_FILE"

  if [[ "${SKIP_VERIFY:-}" == "1" ]]; then
    echo ""
    log "=== Redeploy complete (verify suites skipped: SKIP_VERIFY=1) ==="
    log "    Full log: $LOG"
    exit 0
  fi

  echo ""
  log "── Verifying the live site (both production-verify suites) ──"
  # Against the public hostnames, through the tunnel, as a visitor would.
  # Each suite creates its own account and pages and removes them.
  # Both suites also read the database directly, to clean up after
  # themselves. They default to this Mac's; a caller's MONGODB_URI wins.
  VERIFY_OK=true
  export MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/booklet?directConnection=true}"
  if ! TEST_BASE_URL=https://booklet.ashwinsathian.com TEST_API_BASE_URL=https://booklet-api.ashwinsathian.com \
      npx playwright test --config=scripts/production-verify/playwright.config.ts 2>&1 | tee -a "$LOG"; then
    VERIFY_OK=false
  fi
  if ! node scripts/production-verify/cli-mcp-verify.mjs 2>&1 | tee -a "$LOG"; then
    VERIFY_OK=false
  fi

  echo ""
  if [[ "$VERIFY_OK" == "true" ]]; then
    log "=== Redeploy complete, verified ==="
    log "    Full log: $LOG"
    exit 0
  fi
  log "=============================================================="
  log "  The new build is LIVE and healthy, and a verify suite FAILED."
  log "  Nothing was rolled back. Read the failures above."
  log "=============================================================="
  log "    Full log: $LOG"
  exit 2
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

for out in "${BUILD_OUTPUTS[@]}"; do
  if [[ -d "$out.previous" ]]; then
    run "rm -rf '$out'"
    run "mv '$out.previous' '$out'"
  fi
done
if [[ -f "$DEPLOYED_COMMIT_FILE" ]]; then
  log "    Builds restored. The source tree is still at $(git rev-parse --short HEAD);"
  log "    the last healthy deploy was $(cut -c1-7 "$DEPLOYED_COMMIT_FILE"). The MCP server runs from source:"
  log "    if it is what failed, check that commit out and run this script again."
fi

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
